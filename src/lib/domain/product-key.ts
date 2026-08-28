/**
 * 상품 식별키.
 *
 * 핵심 사실 하나: **약관은 사용자별 데이터가 아니라 상품별 데이터다.**
 * 「(무)메리츠 올바른 암보험1906」의 약관은 그 상품에 가입한 모든 사람에게 똑같다.
 * 그러니 사용자마다 한 번씩 받아 올릴 이유가 없다 — 한 사람이 올리면 같은 상품에
 * 가입한 다른 사람들은 아무것도 하지 않아도 된다.
 *
 * 이 키가 그 연결을 만든다.
 *
 * ⚠ 상품명 끝의 숫자(1812, 1906)는 **개정 회차**다. 같은 이름이라도 회차가 다르면
 * 약관이 다르므로 절대 지우지 않는다. 공시실 검색어를 만들 때만 떼어낸다
 * (`searchTermFor`) — 그건 검색 편의고, 이건 동일성 판단이다.
 */

/** 회사명은 마스킹되어 올 때가 있다(`**손해보험`). 마스킹 문자를 키에 넣으면 매칭이 깨진다. */
function normalizeInsurer(name: string | null | undefined): string {
  return (name ?? '')
    .replace(/[*\s]/g, '')
    .replace(/주식회사|㈜/g, '')
    .replace(/보험$/, '')
    .toLowerCase();
}

function normalizeProduct(name: string | null | undefined): string {
  return (name ?? '')
    // CODEF 와 공시실이 같은 상품을 「다이렉트+가정보장보험」/「다이렉트가정보장보험」처럼
    // '+' 유무만 다르게 준다. 장식 문자일 뿐이라 동일성 판단에서 지운다 —
    // 실제로 이 차이 때문에 같은 상품이 카드 두 장으로 갈라졌다.
    .replace(/[\s+·]/g, '')
    .replace(/^\((무|유)\)/, '')
    .replace(/무배당|유배당/g, '')
    .toLowerCase();
}

/**
 * 회사·상품을 합친 키. 둘 중 하나라도 비면 null 이다 —
 * 반쪽짜리 키로 엮으면 다른 상품의 약관을 내 계약에 붙이게 된다.
 */
export function productKeyOf(
  insurerName: string | null | undefined,
  productName: string | null | undefined,
): string | null {
  const insurer = normalizeInsurer(insurerName);
  const product = normalizeProduct(productName);
  if (insurer.length === 0 || product.length < 2) return null;
  return `${insurer}::${product}`;
}
