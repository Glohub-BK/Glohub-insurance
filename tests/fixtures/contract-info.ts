import type { CodefContractInfoData } from '@/lib/codef/types';

/**
 * CODEF 개발가이드 출력부 예시를 그대로 옮긴 픽스처.
 * 마스킹(**), 잘린 상태값("정"), 빈 문자열 등 실제 응답의 지저분한 형태를 그대로 둔다.
 */
export const sampleContractInfo: CodefContractInfoData = {
  resActualLossContractList: [
    {
      resNumber: '1',
      resCompanyNm: '**손해보험',
      resCompanyNmCode: 'N**',
      resPolicyNumber: '201623******',
      resPolicyNumberHid: '20162********',
      resInsuranceName: '(무)**건강보험',
      resContractStatus: '정',
      resPhoneNo: '상*******',
      resHomePage: 'www.*******.co.kr',
      resInsuredPerson: '홍**',
      resCoverageLists: [
        {
          resNumber: '1',
          commStartDate: '20160530',
          commEndDate: '20310530',
          resType: '실손의료비',
          resCoverageName: '상해의료',
          resCoverageAmount: '500000',
          resCoverageStatus: '정상',
        },
      ],
    },
  ],
  resFlatRateContractList: [
    {
      resNumber: '1',
      commStartDate: '20120905',
      commEndDate: '20920519',
      resCompanyNm: '**손해보험',
      resCompanyNmCode: 'N**',
      resPolicyNumber: '201**',
      resPolicyNumberHid: '20162********',
      resInsuranceName: '(무)**건강보험',
      resContractor: '홍**',
      resContractStatus: '정상',
      resPremium: '756000',
      resPaymentCycle: '매월납',
      resPaymentPeriod: '20년',
      resCoverageLists: [
        {
          resNumber: '1',
          resInsuredPerson: '홍**',
          resCoverageName: '재해장해(80%이상)',
          resCoverageAmount: '1250000',
          resAgreementType: '상해80%이상후유장해',
          resCoverageStatus: '해지',
          resCoverageCode: 'A3301',
        },
        {
          resNumber: '2',
          resInsuredPerson: '홍**',
          resCoverageName: '가족일상생활중배상책임',
          resCoverageAmount: '100000000',
          resAgreementType: '배상책임',
          resCoverageStatus: '정상',
          resCoverageCode: 'B1101',
        },
      ],
    },
  ],
  resCarContractList: [],
  resPropertyContractList: [
    {
      resNumber: '1',
      resCompanyNm: '**화재',
      resInsuranceName: '(무)우리집안심보험',
      resContractStatus: '정상',
      resPremium: '',
      resPaymentCycle: '일시납',
      commStartDate: '20240101',
      commEndDate: '종신',
      resCoverageLists: [
        {
          resNumber: '1',
          resCoverageName: '주택화재손해',
          resCoverageAmount: '50,000,000',
          resCoverageStatus: '정상',
          resObject: '아파트',
        },
      ],
    },
  ],
  resSavingsContractList: [],
};
