import { NextResponse } from 'next/server';
import { ingestTermsPdf } from '@/lib/terms/ingest';
import { assembleUpload, deleteUpload, MAX_CHUNKS } from '@/lib/repo/upload-chunk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 약관 PDF 는 수백 페이지짜리도 있다. KB 운전자·자동차 약관이 실제로 60초를 넘겨
 * 504 로 죽었다. Fluid compute(신규 프로젝트 기본)에서는 Hobby 도 300초까지 허용된다.
 * 배포가 이 값을 거부하면 Vercel 프로젝트 설정에서 Fluid Compute 를 켜야 한다.
 */
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 약관 파일 업로드 — 두 갈래, 한 파이프라인.
 *
 *   1. multipart(FormData): 4MB 이하 파일이 한 번에 온다.
 *   2. JSON {uploadId, chunkCount, ...}: 그보다 큰 파일. 클라이언트가 3MB 조각으로
 *      /api/terms/upload-chunk 에 나눠 넣은 뒤, 이 요청이 이어붙인다.
 *      (Vercel 서버리스는 요청 본문을 4.5MB 로 자른다 — 413 다섯 번 맞고 만든 구조다)
 *
 * 서버 액션이 아니라 라우트 핸들러인 이유: 서버 액션 본문은 기본 1MB 로 잘린다.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  // ── 갈래 2: 조각 업로드 마무리 ─────────────────────────────────────────
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as {
      uploadId?: unknown;
      chunkCount?: unknown;
      fileName?: unknown;
      policyId?: unknown;
    } | null;

    const uploadId = typeof body?.uploadId === 'string' && UUID.test(body.uploadId) ? body.uploadId : null;
    const chunkCount =
      typeof body?.chunkCount === 'number' && Number.isInteger(body.chunkCount) ? body.chunkCount : 0;
    if (!uploadId || chunkCount < 1 || chunkCount > MAX_CHUNKS) {
      return NextResponse.json({ ok: false, message: '업로드 정보가 올바르지 않아요.' }, { status: 400 });
    }

    const bytes = await assembleUpload(uploadId, chunkCount);
    if (!bytes) {
      await deleteUpload(uploadId);
      return NextResponse.json(
        { ok: false, message: '조각이 다 도착하지 않았어요. 처음부터 다시 올려주세요.' },
        { status: 409 },
      );
    }

    const result = await ingestTermsPdf({
      bytes,
      fileName: typeof body?.fileName === 'string' ? body.fileName : 'terms.pdf',
      policyId: typeof body?.policyId === 'string' && body.policyId.trim() ? body.policyId.trim() : null,
    });
    // 성공이든 실패든 조각은 여기서 끝이다. 남겨두면 다음 시도와 섞인다.
    await deleteUpload(uploadId);
    return NextResponse.json(result.body, { status: result.status });
  }

  // ── 갈래 1: 한 번에 온 파일 ───────────────────────────────────────────
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: '파일을 읽지 못했어요.' }, { status: 400 });
  }

  const file = form.get('file');
  const policyId = String(form.get('policyId') ?? '').trim() || null;
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: '약관 파일을 골라주세요.' }, { status: 400 });
  }

  const result = await ingestTermsPdf({
    bytes: new Uint8Array(await file.arrayBuffer()),
    fileName: file.name || 'terms.pdf',
    policyId,
  });
  return NextResponse.json(result.body, { status: result.status });
}
