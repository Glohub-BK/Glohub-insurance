/**
 * CODEF 신용정보원(내보험다보여) 계약정보 API 응답 타입.
 * 출처: https://developer.codef.io/products/insurance/each/credit4u/contactInfo (2025-11-06 기준)
 *
 * 주의 — 응답 값 상당수가 대상기관에서 마스킹되어 내려온다.
 *   resCompanyNm  "**손해보험"
 *   resPolicyNumber "201623******"
 * 따라서 이 값들만으로 계약 동일성을 판단하면 안 된다. normalize.ts 의 identity_key 참고.
 */

export type CodefEnvironment = 'sandbox' | 'demo' | 'api';

export type CodefResult = {
  code: string;
  extraMessage?: string;
  message?: string;
  transactionId?: string;
};

/** 추가 인증(2-way)이 필요할 때 내려오는 페이로드 */
export type CodefTwoWayData = {
  continue2Way: true;
  method: string;
  jobIndex: number;
  threadIndex: number;
  jti: string;
  twoWayTimestamp: number | string;
  extraInfo?: {
    reqSecureNo?: string;
    reqSecureNoRefresh?: string;
    reqSMSAuthNo?: string;
    commSimpleAuth?: string;
  };
};

export type CodefCoverage = {
  resNumber?: string;
  resInsuredPerson?: string;
  resCoverageName?: string;
  resCoverageAmount?: string;
  resAgreementType?: string;
  resCoverageStatus?: string;
  resCoverageCode?: string;
  resType?: string;
  commStartDate?: string;
  commEndDate?: string;
  resObject?: string;
  resZipCode?: string;
};

export type CodefContract = {
  resNumber?: string;
  resCompanyNm?: string;
  resCompanyNmCode?: string;
  resPolicyNumber?: string;
  resPolicyNumberHid?: string;
  resInsuranceName?: string;
  resContractor?: string;
  resInsuredPerson?: string;
  resContractStatus?: string;
  resPremium?: string;
  resPaymentCycle?: string;
  resPaymentPeriod?: string;
  resPhoneNo?: string;
  resHomePage?: string;
  resDateOfContract?: string;
  commCarName?: string;
  resCarNo?: string;
  commStartDate?: string;
  commEndDate?: string;
  resCoverageLists?: CodefCoverage[];
};

export type CodefContractInfoData = {
  resFlatRateContractList?: CodefContract[];
  resActualLossContractList?: CodefContract[];
  resCarContractList?: CodefContract[];
  resPropertyContractList?: CodefContract[];
  resSavingsContractList?: CodefContract[];
  resActualLossPaymentList?: unknown[];
  resActualLossStatisticsList?: unknown[];
  resFlatRateStatisticsList?: unknown[];
};

export type CodefResponse<T> = {
  result: CodefResult;
  data: T;
};

/** 응답 코드 — 우리가 분기에 쓰는 것만 정의한다. */
export const CODEF_CODE = {
  SUCCESS: 'CF-00000',
  TWO_WAY_REQUIRED: 'CF-03002',
  PASSWORD_FORMAT: 'CF-12827',
  IDENTITY_VERIFICATION_REQUIRED: 'CF-12831',
} as const;

export function isTwoWayResponse(
  res: CodefResponse<unknown>,
): res is CodefResponse<CodefTwoWayData> {
  if (res.result.code !== CODEF_CODE.TWO_WAY_REQUIRED) return false;
  const d = res.data as { continue2Way?: unknown } | null;
  return Boolean(d && d.continue2Way === true);
}
