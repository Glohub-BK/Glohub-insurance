import { NextResponse } from 'next/server';
import { getCurrentHousehold } from '@/lib/repo/household';
import { getMembers } from '@/lib/repo/dashboard';
import { MAX_TERMS_BYTES, isPdf, saveTermsDoc } from '@/lib/repo/terms-doc';
import { extractPdfText } from '@/lib/terms/pdf';
import { parseClauses } from '@/lib/terms/parse';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 약관 PDF 는 수백 페이지짜리도 있다. 서버리스 기본 제한(10초)으로는 두꺼운 약관에서
 * 조항을 다 뽑기 전에 잘린다. 사용자에게는 "올렸는데 아무 일도 안 일어남" 으로 보인다.
 * Vercel Hobby 플랜의 상한이 60초다.
 */
export const maxDuration = 60;

/**
 * 약관 파일 업로드.
 *
 * 서버 액션이 아니라 라우트 핸들러인 이유: 서버 액션 본문은 기본 1MB 로 잘린다.
 * 약관 PDF 는 보통 그보다 크다.
 *
 * 저장 전에 조항을 뽑는다. 조항이 하나도 안 잡히면 저장하지 않고 이유를 알려준다 —
 * 스캔한 이미지 PDF 를 받아두면 "넣었는데 인용이 안 바뀐다"가 된다.
 */
export async function POST(request: Request) {
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
  if (file.size > MAX_TERMS_BYTES) {
    return NextResponse.json(
      { ok: false, message: '파일이 너무 큽니다. 40MB 이하만 올릴 수 있어요.' },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ ok: false, message: '빈 파일이에요.' }, { status: 400 });
  }
  if (!isPdf(bytes)) {
    return NextResponse.json(
      { ok: false, message: 'PDF 파일만 올릴 수 있어요. 보험사 공시실에서 받은 약관 PDF 를 골라주세요.' },
      { status: 400 },
    );
  }

  const household = await getCurrentHousehold().catch(() => null);
  if (!household) {
    return NextResponse.json(
      { ok: false, message: '먼저 내 보험을 조회해 주세요.' },
      { status: 409 },
    );
  }

  // 계약을 지정했다면 우리 가구의 계약인지 확인한다. 화면을 거치지 않는 요청도 있다.
  let insurerName: string | null = null;
  let productName: string | null = null;
  if (policyId) {
    const rows = await query<{ insurer_name: string; product_name: string }>(
      `select p.insurer_name, p.product_name
         from policy p join member m on m.id = p.member_id
        where p.id = $1 and m.household_id = $2`,
      [policyId, household.id],
    );
    if (!rows[0]) {
      return NextResponse.json({ ok: false, message: '이 계약에는 올릴 수 없어요.' }, { status: 403 });
    }
    insurerName = rows[0].insurer_name;
    productName = rows[0].product_name;
  }

  let text: string;
  try {
    text = await extractPdfText(bytes);
  } catch (error) {
    console.error('[terms] PDF 읽기 실패', error);
    return NextResponse.json(
      { ok: false, message: 'PDF 를 열지 못했어요. 파일이 손상되었거나 암호가 걸려 있을 수 있어요.' },
      { status: 400 },
    );
  }

  const clauses = parseClauses(text);
  if (clauses.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          '조항을 하나도 찾지 못했어요. 스캔한 이미지 PDF 로 보입니다 — 공시실에서 글자를 복사할 수 있는 PDF 를 다시 받아주세요.',
      },
      { status: 422 },
    );
  }

  const members = await getMembers(household.id);
  const me = members.find((m) => m.relation === '본인') ?? members[0];
  if (!me) {
    return NextResponse.json({ ok: false, message: '구성원을 찾지 못했어요.' }, { status: 409 });
  }

  try {
    const saved = await saveTermsDoc({
      memberId: me.member_id,
      policyId,
      title: productName ?? file.name.replace(/\.pdf$/i, ''),
      fileName: file.name || 'terms.pdf',
      mime: 'application/pdf',
      bytes,
      insurerName,
      productName,
      clauses,
    });
    if (!saved.ok) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  } catch (error) {
    console.error('[terms] 저장 실패', error);
    return NextResponse.json(
      { ok: false, message: '저장하지 못했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
