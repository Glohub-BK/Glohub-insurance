import { getCurrentHousehold } from '../repo/household';
import { getMembers } from '../repo/dashboard';
import { MAX_TERMS_BYTES, isPdf, saveTermsDoc } from '../repo/terms-doc';
import { extractPdfText } from './pdf';
import { parseClauses } from './parse';
import { query } from '../db';

/**
 * 약관 PDF 바이트 → 검증 → 조항 추출 → 저장.
 *
 * 한 번에 온 파일이든 조각으로 모아 붙인 파일이든, 이 지점부터는 같은 길을 걷는다.
 * 두 경로가 각자 파이프라인을 가지면 한쪽만 고쳐지는 버그가 생긴다.
 */
export type IngestResult =
  | { status: 200; body: { ok: true; clauseCount: number; duplicate: boolean } }
  | { status: number; body: { ok: false; message: string } };

export async function ingestTermsPdf(input: {
  bytes: Uint8Array;
  fileName: string;
  policyId: string | null;
}): Promise<IngestResult> {
  const { bytes, fileName, policyId } = input;

  if (bytes.byteLength === 0) {
    return { status: 400, body: { ok: false, message: '빈 파일이에요.' } };
  }
  if (bytes.byteLength > MAX_TERMS_BYTES) {
    return { status: 400, body: { ok: false, message: '파일이 너무 큽니다. 40MB 이하만 올릴 수 있어요.' } };
  }
  if (!isPdf(bytes)) {
    return {
      status: 400,
      body: { ok: false, message: 'PDF 파일만 올릴 수 있어요. 보험사 공시실에서 받은 약관 PDF 를 골라주세요.' },
    };
  }

  const household = await getCurrentHousehold().catch(() => null);
  if (!household) {
    return { status: 409, body: { ok: false, message: '먼저 내 보험을 조회해 주세요.' } };
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
      return { status: 403, body: { ok: false, message: '이 계약에는 올릴 수 없어요.' } };
    }
    insurerName = rows[0].insurer_name;
    productName = rows[0].product_name;
  }

  let text: string;
  try {
    text = await extractPdfText(bytes);
  } catch (error) {
    console.error('[terms] PDF 읽기 실패', error);
    return {
      status: 400,
      body: { ok: false, message: 'PDF 를 열지 못했어요. 파일이 손상되었거나 암호가 걸려 있을 수 있어요.' },
    };
  }

  const clauses = parseClauses(text);
  if (clauses.length === 0) {
    return {
      status: 422,
      body: {
        ok: false,
        message:
          '조항을 하나도 찾지 못했어요. 스캔한 이미지 PDF 로 보입니다 — 공시실에서 글자를 복사할 수 있는 PDF 를 다시 받아주세요.',
      },
    };
  }

  const members = await getMembers(household.id);
  const me = members.find((m) => m.relation === '본인') ?? members[0];
  if (!me) {
    return { status: 409, body: { ok: false, message: '구성원을 찾지 못했어요.' } };
  }

  try {
    const saved = await saveTermsDoc({
      memberId: me.member_id,
      policyId,
      title: productName ?? fileName.replace(/\.pdf$/i, ''),
      fileName: fileName || 'terms.pdf',
      mime: 'application/pdf',
      bytes,
      insurerName,
      productName,
      clauses,
    });
    if (!saved.ok) return { status: 400, body: saved };
    return { status: 200, body: saved };
  } catch (error) {
    console.error('[terms] 저장 실패', error);
    return { status: 500, body: { ok: false, message: '저장하지 못했어요. 잠시 후 다시 시도해주세요.' } };
  }
}
