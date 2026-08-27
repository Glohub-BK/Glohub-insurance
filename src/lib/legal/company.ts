/**
 * 사업자 정보.
 *
 * 놓칠뻔은 글로버브가 운영하는 서비스다. 사업자 표시는 글로버브(glohub.co.kr)와
 * 같은 값을 쓰고, 문서 경로도 같은 스킴(`/legal/...`)을 따른다 — 같은 곳이 만든
 * 서비스라는 걸 사용자가 알아볼 수 있어야 한다.
 *
 * 전자상거래법·정보통신망법상 표시 의무 항목이므로 화면 하단에 항상 노출한다.
 */
export const COMPANY = {
  serviceName: '놓칠뻔',
  operator: '글로버브 (Glohub)',
  representative: '강병구',
  businessNumber: '358-77-00541',
  email: 'glohub@glohub.co.kr',
  site: 'https://glohub.co.kr',
  /** 개인정보 보호책임자. 개인정보보호법 제31조상 지정·공개 의무. */
  privacyOfficer: { name: '강병구', role: '대표', email: 'glohub@glohub.co.kr' },
} as const;

/** 문서마다 시행일을 따로 둔다. 하나를 고칠 때 나머지 날짜가 함께 밀리면 안 된다. */
export const EFFECTIVE_FROM = '2026-09-01';
