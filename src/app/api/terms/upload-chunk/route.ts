import { NextResponse } from 'next/server';
import { getCurrentHousehold } from '@/lib/repo/household';
import { CHUNK_BYTES, MAX_CHUNKS, purgeStaleChunks, saveChunk } from '@/lib/repo/upload-chunk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 큰 약관 PDF 의 조각 하나를 받는다.
 *
 * Vercel 서버리스는 요청 본문을 4.5MB 로 자르므로, 클라이언트가 3MB 조각으로 나눠
 * 순서대로 보낸다. 마지막에 /api/terms/upload (JSON) 가 이어붙여 저장한다.
 * 본문은 multipart 가 아니라 날바이트 — 조각에 포장을 씌울 이유가 없다.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get('uploadId') ?? '';
  const seq = Number(url.searchParams.get('seq'));

  if (!UUID.test(uploadId) || !Number.isInteger(seq) || seq < 0 || seq >= MAX_CHUNKS) {
    return NextResponse.json({ ok: false, message: '조각 정보가 올바르지 않아요.' }, { status: 400 });
  }

  const household = await getCurrentHousehold().catch(() => null);
  if (!household) {
    return NextResponse.json({ ok: false, message: '먼저 내 보험을 조회해 주세요.' }, { status: 409 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > CHUNK_BYTES + 1024) {
    return NextResponse.json({ ok: false, message: '조각 크기가 올바르지 않아요.' }, { status: 400 });
  }

  // 첫 조각이 들어올 때 방치된 조각을 치운다. 별도 스케줄러를 두지 않기 위해서다.
  if (seq === 0) await purgeStaleChunks().catch(() => undefined);

  await saveChunk(uploadId, seq, bytes);
  return NextResponse.json({ ok: true, seq });
}
