import { createHash } from 'node:crypto';
import { classifyCoverage, type CoverageCategory } from '../domain/coverage-category';
import type { CodefContract, CodefContractInfoData, CodefCoverage } from './types';

export type ContractKind = 'flat_rate' | 'actual_loss' | 'car' | 'property' | 'savings';

export type PolicyStatus = '유지' | '실효' | '만기' | '해지' | '미상';
export type PaymentCycle = '월납' | '분기납' | '반기납' | '연납' | '일시납' | '기타';

export type NormalizedCoverage = {
  category: CoverageCategory;
  name: string;
  amount: number | null;
  agreementType: string | null;
  coverageCode: string | null;
  coverageStatus: string;
  insuredName: string | null;
  startDate: string | null;
  endDate: string | null;
  isWholeLife: boolean;
  confidence: number;
  raw: CodefCoverage;
};

export type NormalizedPolicy = {
  identityKey: string;
  contractKind: ContractKind;
  insurerName: string;
  insurerCode: string | null;
  productName: string;
  policyNo: string | null;
  policyNoHidden: string | null;
  policyholderName: string | null;
  insuredName: string | null;
  status: PolicyStatus;
  startDate: string | null;
  endDate: string | null;
  premium: number | null;
  paymentCycle: PaymentCycle | null;
  coverages: NormalizedCoverage[];
  raw: CodefContract;
};

const LIST_TO_KIND: Array<[keyof CodefContractInfoData, ContractKind]> = [
  ['resFlatRateContractList', 'flat_rate'],
  ['resActualLossContractList', 'actual_loss'],
  ['resCarContractList', 'car'],
  ['resPropertyContractList', 'property'],
  ['resSavingsContractList', 'savings'],
];

/** "20160530" → "2016-05-30". "종신"·빈값·형식 불일치는 null. */
export function parseDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  // 실재하지 않는 날짜(2월 30일 등)를 거른다.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function isWholeLife(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.includes('종신');
}

/**
 * 금액 문자열 → 원 단위 숫자.
 *
 * ⚠ 이전 구현은 숫자가 아닌 문자를 전부 지우고 남은 자릿수를 통째로 Number() 했다.
 * 그래서 "1일당 30,000원 (최대 180일)" 이 13000180 이 되고, 여러 금액이 한 칸에 담긴
 * 담보에서는 수십조가 나왔다. 실제로 화면에 10019.2억원이 찍혔다.
 * 지금은 **숫자 덩어리가 하나일 때만** 값으로 받아들이고, 애매하면 null(미상)로 둔다.
 * 모르는 걸 모른다고 하는 편이, 그럴듯한 큰 수를 지어내는 것보다 낫다.
 */
export function parseAmount(value: string | undefined | null): number | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (text.length === 0) return null;
  // 마스킹(*)이 섞이면 자릿수를 신뢰할 수 없다.
  if (text.includes('*')) return null;
  // 9가 열 자리 넘게 늘어선 값은 금액이 아니라 자리표시자다.
  // 실제 데이터에서 배상책임 담보 몇 건이 999,999,999,999 로 들어왔고,
  // 그 한 건이 합계에 얹혀 화면에 10019.2억원이 찍혔다.
  if (isPlaceholder(text)) return null;

  // 1) 한글 단위 표기를 먼저 편다. "3,000만원" → 30000000
  const scaled = parseKoreanUnits(text);
  if (scaled !== null) return scaled;

  // 2) 순수 숫자. 세기 전에 금액이 아닌 수식어("1일당", "최대 180일", "2종")를 걷어낸다.
  const groups = text.replace(QUALIFIER, ' ').match(/\d[\d,]*(?:\.\d+)?/g);
  if (!groups || groups.length !== 1) return null;
  const n = Number(groups[0].replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// 긴 단위가 먼저 와야 "5천만" 이 "5천"+"만" 으로 쪼개지지 않는다.
/**
 * 자리표시자 판별. 대상기관이 "한도 없음 / 실손 보상 / 미고지" 를 9로 채워 보내는 경우가 있다.
 * 9,999억짜리 개인 배상책임 담보는 존재하지 않으므로 금액으로 받아들이지 않는다.
 */
export function isPlaceholder(text: string): boolean {
  const digits = text.replace(/[^0-9]/g, '');
  return digits.length >= 10 && /^9+$/.test(digits);
}

const UNIT_SCALE: Record<string, number> = {
  억: 100_000_000,
  천만: 10_000_000,
  백만: 1_000_000,
  십만: 100_000,
  만: 10_000,
  천: 1_000,
};
const UNIT_PATTERN = /(\d[\d,]*(?:\.\d+)?)\s*(억|천만|백만|십만|만|천)/g;

/**
 * 금액이 아닌 수식어. "1일당 30,000원 (최대 180일)" 의 1 과 180 이 여기 걸린다.
 * 이걸 먼저 지워야 "숫자가 하나뿐인가" 를 제대로 셀 수 있다.
 */
const QUALIFIER = /\d[\d,]*\s*(?:일당|회당|인당|사고당|개월|일|회|년|세|명|건|종|급|주)/g;

/**
 * "1억5,000만원", "3천만원" 처럼 한글 단위가 붙은 표기를 원 단위로 편다.
 * 단위가 하나도 없으면 null 을 돌려 호출부가 순수 숫자 경로로 넘어가게 한다.
 */
export function parseKoreanUnits(text: string): number | null {
  const matches = [...text.matchAll(UNIT_PATTERN)];
  if (matches.length === 0) return null;

  // 단위는 반드시 억 → 만 → 천 순으로 내려가야 한다. 뒤집히면 두 개의 다른 금액이
  // 한 칸에 담긴 것이므로(예: "만기 3천 / 1억") 해석하지 않는다.
  let total = 0;
  let prev = Infinity;
  for (const [, digits, unit] of matches) {
    const scale = UNIT_SCALE[unit];
    if (scale >= prev) return null;
    prev = scale;
    const n = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(n)) return null;
    total += n * scale;
  }

  // 단위 뒤에 남은 자투리 원 단위("1만 5000원")까지 더한다.
  const tail = text.slice((matches.at(-1)?.index ?? 0) + matches.at(-1)![0].length);
  const rest = tail.match(/^\s*(\d[\d,]*)\s*원?\s*$/);
  if (rest) total += Number(rest[1].replace(/,/g, ''));

  return total > 0 ? total : null;
}

/**
 * 대상기관 계약상태 문자열을 우리 상태값으로 좁힌다.
 * CODEF 문서 예시: "정상", "청약철회", "해지", "만기", "소멸", "계약부활"
 * 실제 데이터에서 "정" 처럼 잘려 오는 사례가 있어 접두 매칭을 쓴다.
 */
export function normalizeStatus(value: string | undefined | null): PolicyStatus {
  const text = (value ?? '').replace(/\s/g, '');
  if (text.length === 0) return '미상';
  if (text.startsWith('정') || text.includes('부활')) return '유지';
  if (text.includes('청약철회') || text.startsWith('해')) return '해지';
  if (text.startsWith('만') || text.includes('소멸')) return '만기';
  if (text.includes('실효')) return '실효';
  return '미상';
}

export function normalizePaymentCycle(value: string | undefined | null): PaymentCycle | null {
  const text = (value ?? '').replace(/\s/g, '');
  if (text.length === 0) return null;
  if (text.includes('일시')) return '일시납';
  if (text.includes('월')) return '월납';
  if (text.includes('분기')) return '분기납';
  if (text.includes('반기')) return '반기납';
  if (text.includes('년') || text.includes('연')) return '연납';
  return '기타';
}

/**
 * 계약 동일성 키.
 *
 * 내보험다보여는 회사명과 증권번호를 마스킹해서 내려주므로 자연키를 쓸 수 없다.
 * 마스킹되어도 값 자체는 계약마다 안정적이므로, 확보 가능한 필드를 모두 이어붙여
 * 해시한다. 한 필드가 비어도 나머지로 구분된다.
 */
export function buildIdentityKey(kind: ContractKind, c: CodefContract): string {
  const parts = [
    kind,
    c.resCompanyNmCode ?? '',
    c.resCompanyNm ?? '',
    c.resPolicyNumberHid ?? '',
    c.resPolicyNumber ?? '',
    c.resInsuranceName ?? '',
    c.commStartDate ?? '',
  ].map((p) => p.replace(/\s/g, ''));

  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 32);
}

export function normalizeCoverage(raw: CodefCoverage): NormalizedCoverage {
  // 실손형은 resType 에 "실손의료비" 같은 구분이 따로 온다. 담보명과 합쳐 분류 정확도를 올린다.
  const nameForClassify = [raw.resType, raw.resCoverageName].filter(Boolean).join(' ');
  const classified = classifyCoverage(nameForClassify);

  return {
    category: classified.category,
    name: raw.resCoverageName?.trim() || raw.resType?.trim() || '(이름 없음)',
    amount: parseAmount(raw.resCoverageAmount),
    agreementType: raw.resAgreementType?.trim() || null,
    coverageCode: raw.resCoverageCode?.trim() || null,
    coverageStatus: raw.resCoverageStatus?.trim() || '정상',
    insuredName: raw.resInsuredPerson?.trim() || null,
    startDate: parseDate(raw.commStartDate),
    endDate: parseDate(raw.commEndDate),
    isWholeLife: isWholeLife(raw.commEndDate),
    confidence: classified.confidence,
    raw,
  };
}

export function normalizeContract(kind: ContractKind, raw: CodefContract): NormalizedPolicy {
  const coverages = (raw.resCoverageLists ?? []).map(normalizeCoverage);

  // 계약 단위 보장기간이 비어 있으면 담보들의 최소/최대로 채운다.
  const coverageStarts = coverages.map((c) => c.startDate).filter((d): d is string => d !== null);
  const coverageEnds = coverages.map((c) => c.endDate).filter((d): d is string => d !== null);

  const productName = raw.resInsuranceName?.trim() || raw.commCarName?.trim() || '(상품명 미상)';

  return {
    identityKey: buildIdentityKey(kind, raw),
    contractKind: kind,
    insurerName: raw.resCompanyNm?.trim() || '(보험사 미상)',
    insurerCode: raw.resCompanyNmCode?.trim() || null,
    productName,
    policyNo: raw.resPolicyNumber?.trim() || null,
    policyNoHidden: raw.resPolicyNumberHid?.trim() || null,
    policyholderName: raw.resContractor?.trim() || null,
    insuredName:
      raw.resInsuredPerson?.trim() || coverages.find((c) => c.insuredName)?.insuredName || null,
    status: normalizeStatus(raw.resContractStatus),
    startDate: parseDate(raw.commStartDate) ?? (coverageStarts.length ? coverageStarts.sort()[0] : null),
    endDate:
      parseDate(raw.commEndDate) ??
      (coverageEnds.length ? coverageEnds.sort()[coverageEnds.length - 1] : null),
    premium: parseAmount(raw.resPremium),
    paymentCycle: normalizePaymentCycle(raw.resPaymentCycle),
    coverages,
    raw,
  };
}

/**
 * 응답 전체를 계약 목록으로 편다.
 * 같은 계약이 두 리스트에 걸쳐 나오는 경우(정액형 + 실손형)는 identityKey 로 구분되어
 * 별도 계약으로 남는다 — 대상기관이 실제로 다른 계약으로 노출하기 때문이다.
 */
export function normalizeContractInfo(data: CodefContractInfoData): NormalizedPolicy[] {
  const out: NormalizedPolicy[] = [];
  for (const [key, kind] of LIST_TO_KIND) {
    const list = data[key];
    if (!Array.isArray(list)) continue;
    for (const item of list as CodefContract[]) {
      if (!item || typeof item !== 'object') continue;
      out.push(normalizeContract(kind, item));
    }
  }
  return out;
}
