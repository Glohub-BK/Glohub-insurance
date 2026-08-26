/**
 * 담보의 "지급 방식".
 *
 * 이 값을 만든 이유: 실손 5,000만원 · 입원일당 3만원 · 암진단비 3,000만원을 **더하면 안 된다.**
 * 세 숫자는 단위가 다르다 — 하나는 연간 한도, 하나는 하루치, 하나는 1회 정액이다.
 * 예전 화면은 이걸 그대로 합쳐 "약관상 한도 합계"라 적었고, 그래서 10019.2억원 같은
 * 숫자가 나왔다. 이제 성격을 붙여 구분해 보여주고, 합계는 내지 않는다.
 */

export const AMOUNT_BASES = ['actual', 'lumpsum', 'daily', 'unknown'] as const;
export type AmountBasis = (typeof AMOUNT_BASES)[number];

export const BASIS_LABEL: Record<AmountBasis, string> = {
  actual: '실손형',
  lumpsum: '정액형',
  daily: '일당형',
  unknown: '미상',
};

/** 금액 옆에 붙일 단위 설명. "3,000만원 (1회 정액)" 처럼 읽힌다. */
export const BASIS_SUFFIX: Record<AmountBasis, string> = {
  actual: '한도 · 실제 낸 돈만큼',
  lumpsum: '진단·수술 시 정액',
  daily: '1일당',
  unknown: '',
};

const DAILY = /일당|1일당|하루|일액/;
const ACTUAL = /실손|실비|의료비|비급여|급여|통원|외래|처방|조제/;

export function amountBasisOf(name: string, category: string): AmountBasis {
  const n = (name ?? '').replace(/\s/g, '');
  // 일당이 먼저다. "상해입원일당"은 의료비가 아니라 하루치다.
  if (DAILY.test(n)) return 'daily';
  // 배상책임·화재는 "실제 손해액을 한도 안에서" 보상한다. 진단만으로 나오는 정액이 아니다.
  if (category === 'actual_loss' || category === 'liability' || category === 'fire') return 'actual';
  if (ACTUAL.test(n)) return 'actual';
  if (category === 'savings' || category === 'other') return 'unknown';
  return 'lumpsum';
}

/**
 * 말이 되는 금액인지 본다.
 *
 * 이미 저장된 데이터에는 옛 파서가 만든 쓰레기 값이 남아 있다(자릿수를 이어붙인 수십조).
 * 다시 조회하거나 `npm run db:repair-amounts` 를 돌리기 전까지 화면이 그 값을 그대로
 * 보여주면 안 되므로, 표시 직전에 한 번 더 거른다.
 *
 * 개인 보험 담보의 가입금액이 100억을 넘는 경우는 없다. 일당형은 100만원을 넘지 않는다.
 */
export const MAX_LUMPSUM = 10_000_000_000; // 100억
export const MAX_DAILY = 1_000_000; // 100만

export function isSaneAmount(amount: number | null, basis: AmountBasis): boolean {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return false;
  if (!Number.isInteger(amount)) return false;
  return amount <= (basis === 'daily' ? MAX_DAILY : MAX_LUMPSUM);
}

/** 화면에 쓸 금액. 말이 안 되는 값은 null 로 내려 "확인 필요"로 표시하게 한다. */
export function displayAmount(amount: number | null, basis: AmountBasis): number | null {
  return isSaneAmount(amount, basis) ? amount : null;
}

/**
 * 보장 맵 칸의 카테고리 합계.
 *
 * 한 칸 안에서도 일당형과 정액형이 섞여 더해진다. 그래도 「이 분류에 얼마쯤 들어 있나」는
 * 쓸모가 있어 남기되, 값이 말이 안 되면 금액 대신 담보 수만 보여준다.
 * 가구 하나가 한 분류에 100억을 넘게 들 일은 없다.
 */
export function isSaneTotal(total: number): boolean {
  return Number.isFinite(total) && total > 0 && total <= MAX_LUMPSUM;
}
