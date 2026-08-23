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

/** "756,000원" → 756000. 마스킹(*)이 섞이면 신뢰할 수 없으므로 null. */
export function parseAmount(value: string | undefined | null): number | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (text.length === 0) return null;
  if (text.includes('*')) return null;
  const cleaned = text.replace(/[^0-9.-]/g, '');
  if (cleaned.length === 0) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
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
