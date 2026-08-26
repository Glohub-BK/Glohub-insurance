/**
 * 보험사 공시실 — 약관 원본을 받을 수 있는 곳.
 *
 * 왜 우리가 대신 받아다 주지 않는가:
 * 각 사 공시실은 검색 결과를 세션·POST 로 그리고 PDF 주소도 매번 달라진다. 긁어오면
 * 오늘은 되고 다음 달에 조용히 깨진다. 게다가 약관은 보험사의 저작물이라 우리가 사본을
 * 만들어 재배포할 자리가 아니다. 그래서 **원본은 공식 공시실에서 받게 하고**,
 * 사용자가 받은 파일을 앱에 넣으면 그때부터 우리가 보관·해석한다.
 *
 * 보험업감독규정상 보험사는 **판매중지된 옛 상품의 약관도** 공시실에 보관해야 한다.
 * 2016년에 가입한 계약도 여기서 찾을 수 있다는 뜻이다.
 */

export type Disclosure = {
  /** 공시실 「상품목록 및 기초서류(보험약관)」 페이지 */
  url: string;
  /** 화면에 적을 안내. 사이트마다 메뉴 이름이 달라 그대로 옮긴다. */
  hint: string;
};

/** 생명보험협회·손해보험협회 통합 공시. 개별 보험사를 모를 때 여기로 보낸다. */
export const ASSOCIATION: Record<'life' | 'nonlife', Disclosure> = {
  nonlife: {
    url: 'https://kpub.knia.or.kr/search/searchResult.do',
    hint: '손해보험협회 통합공시 — 상품명으로 검색하세요',
  },
  life: {
    url: 'https://pub.insure.or.kr',
    hint: '생명보험협회 공시실 — 상품비교공시에서 상품명으로 검색하세요',
  },
};

/**
 * 보험사별 공시실. 키는 회사명에 들어 있는 조각이다.
 *
 * 신용정보원은 회사명을 마스킹해 보낼 때가 있어(`**손해보험`) 정확 일치로는 못 찾는다.
 * 조각 포함으로 찾고, 못 찾으면 협회 통합공시로 보낸다 — 빈손으로 돌려보내지 않는다.
 */
const INSURERS: { match: string[]; kind: 'life' | 'nonlife'; disclosure: Disclosure }[] = [
  {
    match: ['메리츠'],
    kind: 'nonlife',
    disclosure: {
      url: 'https://www.meritzfire.com/disclosure/product-announcement/product-list.do',
      hint: '공시실 › 상품공시 › 상품목록',
    },
  },
  {
    match: ['삼성화재'],
    kind: 'nonlife',
    disclosure: {
      url: 'https://www.samsungfire.com/publication/P_U02_03_04_200.html',
      hint: '공시실 › 상품공시',
    },
  },
  {
    match: ['KB손해', 'KB손보'],
    kind: 'nonlife',
    disclosure: {
      url: 'https://www.kbinsure.co.kr/CG802030001.ec',
      hint: '공시실 › 상품목록(약관)',
    },
  },
  {
    match: ['DB손해', 'DB손보', '동부화재'],
    kind: 'nonlife',
    disclosure: {
      url: 'https://www.idbins.com/FWMAIV1534.do',
      hint: '공시실 › 상품목록 및 기초서류(보험약관)',
    },
  },
  {
    match: ['롯데손해', '롯데손보'],
    kind: 'nonlife',
    disclosure: {
      url: 'https://www.lotteins.co.kr/web/C/D/H/cdh170.jsp',
      hint: '공시실 › 상품공시',
    },
  },
  {
    match: ['현대해상'],
    kind: 'nonlife',
    disclosure: {
      url: 'https://www.hi.co.kr/',
      hint: '공시실 › 상품공시 › 상품목록 및 기초서류',
    },
  },
  {
    match: ['한화생명'],
    kind: 'life',
    disclosure: {
      url: 'https://www.hanwhalife.com/main/disclosure/goods/disclosurenotice/DF_GDDN000_P10000.do',
      hint: '공시실 › 상품공시실 › 상품목록',
    },
  },
  {
    match: ['미래에셋생명'],
    kind: 'life',
    disclosure: {
      url: 'https://life.miraeasset.com/micro/disclosure/index.do',
      hint: '공시실 › 상품공시실',
    },
  },
];

/** 생명보험사인지. 회사명만으로 가르는 대략의 규칙이다. */
function kindOf(insurerName: string): 'life' | 'nonlife' {
  return /생명|라이프|life/i.test(insurerName) ? 'life' : 'nonlife';
}

export function disclosureFor(insurerName: string | null | undefined): Disclosure {
  const name = (insurerName ?? '').replace(/\s/g, '');
  if (name.length > 0) {
    for (const entry of INSURERS) {
      if (entry.match.some((m) => name.includes(m))) return entry.disclosure;
    }
  }
  return ASSOCIATION[kindOf(name)];
}

/**
 * 공시실 검색창에 넣을 말.
 *
 * 상품명에 붙은 판매채널·연도 꼬리표("(무)", "1906", "다이렉트")까지 그대로 넣으면
 * 검색이 0건으로 나오는 경우가 많다. 핵심 이름만 남긴다.
 */
export function searchTermFor(productName: string | null | undefined): string {
  return (productName ?? '')
    .replace(/^\(무\)|^\(유\)/g, '')
    .replace(/\d{4}$/g, '')
    .replace(/\((인터넷|다이렉트|무배당|유배당)\)/g, '')
    .trim();
}
