import type { CoverageCategory } from './coverage-category';
import { amountBasisOf, displayAmount, type AmountBasis } from './coverage-basis';

/**
 * 사고 서술 → 적용 가능한 담보 찾기.
 *
 * 지금은 전부 규칙 기반이다. LLM 은 나중에 이 규칙이 못 잡은 문장을 넘겨받는 자리에 붙인다.
 * 규칙으로 잡히는 건은 근거가 명확하고 재현되므로, 규칙을 먼저 태우는 순서를 유지한다.
 *
 * 이 모듈은 금액을 계산하지 않는다. 약관에 적힌 한도와 자기부담금을 그대로 옮길 뿐이다.
 * (손해사정업 경계 — 확정 지급액 산정은 하지 않는다)
 */

export type IncidentRule = {
  id: string;
  label: string;
  /** 하나라도 포함되면 후보. 많이 맞을수록 점수가 높다. */
  keywords: string[];
  /** 이 사고에 해당하는 담보 카테고리. 앞에 올수록 우선. */
  categories: CoverageCategory[];
  /**
   * 담보 **이름**이 이 패턴에 맞아야 「직접 해당」으로 올린다.
   *
   * 카테고리만으로 거르면 너무 넓다. 감기로 통원했는데 골절진단비·암진단비까지
   * 31건이 줄줄이 나오던 게 그 때문이었다. 이름까지 봐야 이 사고와 정말 상관있는
   * 담보만 앞에 세울 수 있다.
   */
  direct: RegExp;
  /** 이름이 여기 걸리면 이 사고와 무관하므로 목록에서 아예 뺀다. */
  exclude?: RegExp;
  /**
   * 이 **계약 종류**의 담보는 이 사고에 쓰지 않는다.
   *
   * 담보 이름만으로는 못 거른다. 자동차보험의 「대물배상」은 이름에 '자동차'가 없어서
   * 일상생활배상책임과 구분되지 않는다. 실제로 「아이가 안경을 깨뜨렸어요」에
   * KB 자동차보험 대물배상 10억이 떴다 — 정작 우리 면책 안내에는 "자동차 사고는
   * 면책"이라고 적혀 있는데도.
   */
  excludeKinds?: string[];
  /**
   * 이름이 이 패턴에 맞으면 exclude·excludeKinds 를 무시하고 살린다.
   *
   * 일상생활배상책임은 이름에 「(대인·대물)」이 붙거나, 운전자·자동차보험
   * (contract_kind 'car')의 특약으로 들어오는 경우가 흔하다. 자동차 담보를
   * 걸러내려던 exclude 가 정작 일배책까지 지워서 「아이가 물건 파손」에
   * "담보 없음" 이 나왔다 — 실제로 일배책을 가진 사용자가 겪은 일이다.
   * 걸러내기(exclude)보다 살리기(allow)가 항상 이긴다.
   */
  allowDespiteExclusion?: RegExp;
  headline: string;
  lead: string;
  note: string;
  /** 약관 조항 원문. 인용 없이는 결과를 확정하지 않는다. */
  quote: string;
  docs: string[];
  route: string;
  warn: string;
};

export const INCIDENT_RULES: IncidentRule[] = [
  {
    id: 'liability-damage',
    label: '타인 물건 파손',
    keywords: ['안경', '파손', '깨', '망가', '부쉈', '부수', '부서', '물건', '장난감', '자전거', '휴대폰', '핸드폰', '유리', '긁어', '고장', '떨어뜨'],
    categories: ['liability'],
    direct: /배상책임|일상생활|가족일상|가족생활|자녀배상|파손/,
    // '대인|대물' 을 이름 제외에 두지 않는다 — 「가족생활배상책임(대인·대물)」까지 지워
    // "담보 없음" 오탐을 냈다. 자동차보험의 대물배상은 excludeKinds('car')가 막는다.
    exclude: /자동차|차량|운전|자차/,
    excludeKinds: ['car', 'savings'],
    // 담보명 표기는 회사마다 다르다: 가족일상생활 / 가족생활 / 일상배상 / 자녀배상.
    allowDespiteExclusion: /일상생활|가족일상|가족생활|생활배상|일상배상|자녀배상/,
    headline: '청구 가능성 높음',
    lead: '남의 물건을 망가뜨린 사고는 배상책임 담보로 처리합니다.',
    note: '자녀 본인 계약이 없어도, 부모 계약의 이 특약은 주민등록상 동거 가족을 함께 보장하는 것이 일반적입니다. 자녀 이름으로 담보가 없다고 포기하지 마세요.',
    quote:
      '피보험자가 일상생활 중 우연한 사고로 타인의 신체나 재물에 손해를 입혀 부담하는 법률상 배상책임을 보상합니다. 피보험자에는 기명피보험자의 배우자 및 생계를 같이하는 동거 친족을 포함합니다.',
    docs: [
      '사고 경위서 (언제·어디서·어떻게)',
      '파손된 물건 사진',
      '수리비 견적서 또는 영수증',
      '피해자 신분증·계좌 사본',
      '보험금 청구서',
    ],
    route: '해당 보험사 앱 또는 고객센터로 접수',
    warn: '고의 사고, 직무 수행 중 사고, 자동차·항공기 사고는 면책입니다.',
  },
  {
    id: 'injury-fracture',
    label: '넘어져서 다침 · 골절',
    keywords: ['골절', '넘어', '다쳤', '부러', '깁스', '타박', '상해', '계단', '삐', '인대'],
    categories: ['actual_loss', 'diagnosis', 'surgery', 'hospital', 'disability'],
    direct: /상해|재해|골절|깁스|외상|사고|후유장해|깊은상처/,
    excludeKinds: ['car', 'savings'],
    exclude: /질병|암|뇌|심근|심장|간|신장|폐|치매|간병|치아|치과|임신|출산|화상|사망|납입면제|운전자|벌금|변호사|배상책임|화재|가재/,
    headline: '두 갈래로 청구하세요',
    lead: '넘어져 다친 사고는 실손의료비와 상해 정액담보를 동시에 청구할 수 있습니다.',
    note: '실손은 실제 낸 돈을 돌려받고, 골절진단비 같은 정액담보는 진단만으로 정액이 나옵니다. 둘은 별개라 중복 청구가 됩니다. 이걸 몰라 정액담보를 놓치는 경우가 가장 많습니다.',
    quote:
      '피보험자가 보험기간 중 상해의 직접결과로써 골절 상태가 되었을 때 골절진단비를 지급합니다. 동일한 사고로 두 종류 이상의 골절이 발생한 경우에도 1회에 한하여 지급합니다.',
    docs: [
      '진단서 (부위·상병코드 포함)',
      '진료비 영수증·세부산정내역서',
      'X-ray 판독 소견서',
      '보험금 청구서',
    ],
    route: '실손은 실손24, 정액담보는 보험사 앱에서 별도 접수',
    warn: '음주·무면허 상태의 사고, 기존 질환으로 인한 골절은 지급이 제한될 수 있습니다.',
  },
  {
    id: 'outpatient',
    label: '병원 통원·진료',
    keywords: ['감기', '병원', '통원', '진료', '외래', '약값', '처방', '진료비', '의원', '치료'],
    categories: ['actual_loss', 'hospital'],
    direct: /통원|외래|처방|조제|의료비|실손|실비/,
    excludeKinds: ['car', 'savings'],
    exclude: /입원|수술|진단|사망|장해|간병|일당|암|뇌|심근|치아|치과|화상|골절|배상책임|운전자|화재/,
    headline: '실손으로 청구하세요',
    lead: '통원 진료비는 실손의료비 담보 대상입니다. 다만 자기부담금을 넘겨야 실익이 있습니다.',
    note: '진료비가 3만원이면 자기부담금을 뺀 1~2만원 수준이 남습니다. 금액이 작아도 실손24로는 서류 없이 1분이면 접수됩니다.',
    quote:
      '피보험자가 질병으로 인하여 병원에 통원하여 치료를 받은 경우 외래제비용, 외래수술비 및 처방조제비를 보상합니다. 다만 각 세대별로 정한 공제금액을 차감합니다.',
    docs: ['진료비 영수증', '진료비 세부산정내역서 (10만원 초과 시)', '처방전 (약제비 청구 시)'],
    route: '실손24 앱 — 병원에서 서류 전송, 별도 제출 불필요',
    warn: '건강검진, 예방접종, 미용 목적 진료는 보상하지 않습니다.',
  },
  {
    id: 'car',
    label: '자동차 사고',
    keywords: ['주차', '접촉', '자동차', '범퍼', '차량', '운전', '추돌', '견인', '차를'],
    categories: ['driver'],
    direct: /자동차|대물|대인|자기차량|자차|운전자|교통|벌금|변호사|형사합의|견인/,
    excludeKinds: ['savings'],
    exclude: /일상생활|가족일상/,
    headline: '자동차보험으로 처리하세요',
    lead: '차량 사고는 대물배상과 자기차량손해로 나뉩니다. 일상생활배상책임으로는 처리되지 않습니다.',
    note: '수리비가 자기부담금과 보험료 할증분을 합친 금액보다 작다면 자비 처리가 유리합니다. 견적을 먼저 받아보세요.',
    quote:
      '피보험자가 피보험자동차를 소유·사용·관리하는 동안 생긴 피보험자동차의 사고로 인하여 다른 사람의 재물을 없애거나 훼손하여 법률상 손해배상책임을 짐으로써 입은 손해를 보상합니다.',
    docs: ['사고 현장 사진 (전체·근접)', '블랙박스 영상', '상대 차량 정보·연락처', '수리 견적서'],
    route: '자동차보험사 사고접수 센터',
    warn: '일상생활배상책임 담보는 자동차 사고를 면책합니다. 자동차보험으로만 처리됩니다.',
  },
  {
    id: 'water-leak',
    label: '누수 피해',
    keywords: ['누수', '젖', '곰팡이', '윗집', '아랫집', '벽지', '물이샜', '배관'],
    categories: ['liability', 'fire'],
    direct: /배상책임|일상생활|급배수|누출|누수|주택|화재|가재|재물/,
    excludeKinds: ['car', 'savings'],
    exclude: /자동차|차량|운전/,
    allowDespiteExclusion: /일상생활|가족일상|가족생활|생활배상|급배수/,
    headline: '가해자 보험을 먼저 확인하세요',
    lead: '윗집 누수 피해는 윗집의 일상생활배상책임에서 나옵니다. 우리 계약이 아니라 상대 계약이 먼저입니다.',
    note: '우리 계약에 화재·재물 담보가 있어도 누수는 화재담보 대상이 아닙니다. 다만 급배수시설 누출 손해 특약이 붙어 있으면 우리 보험으로도 가능합니다.',
    quote:
      '피보험자가 주거용으로 사용하는 주택의 소유·사용·관리로 인한 우연한 사고로 타인의 신체나 재물에 손해를 입혀 법률상 배상책임을 부담함으로써 입은 손해를 보상합니다.',
    docs: ['누수 부위·피해 사진', '누수 원인 진단서 (설비업체)', '수리·복구 견적서', '관리사무소 확인서'],
    route: '가해 세대가 자신의 보험사에 접수 → 우리는 피해자로 서류 제출',
    warn: '노후 배관의 점진적 누수는 “우연한 사고”가 아니라며 다툼이 생기는 대표 유형입니다.',
  },
  {
    id: 'diagnosis',
    label: '중대질병 진단',
    keywords: ['암', '뇌졸중', '뇌출혈', '심근경색', '진단받', '악성', '종양'],
    categories: ['diagnosis', 'surgery', 'hospital', 'actual_loss'],
    direct: /암|뇌|심근|심장|진단|악성|종양|항암|방사선|표적|유사암|상피내/,
    excludeKinds: ['car', 'savings'],
    exclude: /상해|재해|골절|치아|치과|운전자|벌금|변호사|배상책임|화재|가재|자동차|임신|출산/,
    headline: '진단만으로 나오는 담보가 있습니다',
    lead: '중대질병은 진단 확정만으로 정액이 지급되는 담보가 있습니다. 치료비 청구와 별개입니다.',
    note: '진단비는 치료를 받기 전에도 청구할 수 있습니다. 진단 확정일이 기준이므로 조직검사 결과지를 받는 즉시 접수하세요.',
    quote:
      '피보험자가 보험기간 중 암으로 진단확정된 경우 최초 1회에 한하여 암진단비를 지급합니다. 암의 진단확정은 병리 또는 진단검사의학 전문의 자격증을 가진 자에 의하여 내려져야 합니다.',
    docs: ['진단서 (상병코드 포함)', '조직검사 결과지', '진료비 영수증', '보험금 청구서'],
    route: '보험사 앱 또는 담당 설계사',
    warn: '가입 후 90일 면책기간, 1~2년 내 감액지급 조건이 붙는 경우가 많습니다. 가입일을 확인하세요.',
  },
];

/** 화면에 뿌릴 담보 한 줄. DB coverage + policy 조인 결과다. */
export type CoverageCandidate = {
  policyId: string;
  memberName: string;
  insurerName: string;
  productName: string;
  /** 계약 종류. 'car' 면 자동차보험이다 — 담보 이름만으로는 알 수 없다. */
  contractKind?: string;
  category: CoverageCategory;
  name: string;
  amount: number | null;
  coverageStatus: string;
};

export type MatchedCoverage = CoverageCandidate & {
  rank: number;
  /** 지급 방식. 실손·정액·일당은 단위가 달라 서로 더할 수 없다. */
  basis: AmountBasis;
  /**
   * 화면에 실제로 쓸 금액.
   * 저장된 값이 말이 안 되면(옛 파서가 자릿수를 이어붙인 수십조) null 이 된다.
   */
  shownAmount: number | null;
};

export type MatchResult =
  | {
      kind: 'matched';
      rule: IncidentRule;
      /** 이 사고에 **직접** 해당하는 담보. 카테고리 우선순위 → 가입금액 순. */
      coverages: MatchedCoverage[];
      /**
       * 카테고리는 맞지만 담보 이름이 이 사고와 직접 이어지지 않는 것들.
       * 지우지는 않는다 — 판단은 사람이 한다. 다만 접어서 뒤에 둔다.
       */
      related: MatchedCoverage[];
      /** 규칙은 맞았지만 보유 담보가 없을 때 true */
      noCoverage: boolean;
      score: number;
    }
  | { kind: 'unknown' };

const ACTIVE_STATUSES_EXCLUDED = ['해지', '소멸', '실효'];

export function normalizeQuery(text: string): string {
  return (text ?? '').replace(/\s/g, '');
}

/** 규칙 하나가 문장에 얼마나 맞는지. 맞은 키워드 수. */
export function scoreRule(rule: IncidentRule, query: string): number {
  const q = normalizeQuery(query);
  if (q.length === 0) return 0;
  return rule.keywords.filter((k) => q.includes(k)).length;
}

export function pickRule(text: string): { rule: IncidentRule; score: number } | null {
  let best: IncidentRule | null = null;
  let bestScore = 0;
  for (const rule of INCIDENT_RULES) {
    const score = scoreRule(rule, text);
    // 동점이면 먼저 정의된 규칙이 이긴다. 배열 순서가 곧 우선순위다.
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }
  return best ? { rule: best, score: bestScore } : null;
}

export function matchIncident(text: string, candidates: CoverageCandidate[]): MatchResult {
  const picked = pickRule(text);
  if (!picked) return { kind: 'unknown' };

  const { rule } = picked;
  const order = new Map(rule.categories.map((c, i) => [c, i]));

  // 이름이 allow 패턴에 맞으면 어떤 제외 규칙도 이기지 못한다.
  // 「일상생활중배상책임(대인·대물)」이 '대물' 에 걸려 사라지는 일을 막는다.
  const allowed = (c: CoverageCandidate) =>
    Boolean(rule.allowDespiteExclusion?.test(squash(c.name)));

  const inScope = candidates
    .filter((c) => order.has(c.category))
    .filter((c) => !ACTIVE_STATUSES_EXCLUDED.includes(c.coverageStatus))
    // 이름이 이 사고와 명백히 무관하면 목록에 올리지 않는다.
    // 감기로 통원했는데 암진단비까지 나열되던 게 여기서 걸러진다.
    .filter((c) => allowed(c) || !(rule.exclude && rule.exclude.test(squash(c.name))))
    // 계약 종류로도 거른다. 자동차보험 담보를 일상 사고에 붙이면 안 된다.
    // 단, 자동차보험에 특약으로 붙은 일상생활배상책임은 allow 가 살린다.
    .filter(
      (c) => allowed(c) || !(rule.excludeKinds && c.contractKind && rule.excludeKinds.includes(c.contractKind)),
    );

  const decorated = dedupe(inScope).map((c) => {
    const basis = amountBasisOf(c.name, c.category);
    return {
      ...c,
      rank: order.get(c.category) ?? 99,
      basis,
      shownAmount: displayAmount(c.amount, basis),
    };
  });

  const byRankThenAmount = (a: MatchedCoverage, b: MatchedCoverage) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (b.shownAmount ?? 0) - (a.shownAmount ?? 0);
  };

  // 원인(다쳐서/아파서)과 반대편 담보는 직접 해당으로 올리지 않는다.
  const cause = causeOf(text);
  const isDirect = (c: MatchedCoverage) =>
    rule.direct.test(squash(c.name)) && !contradictsCause(c.name, cause);

  const coverages = decorated.filter(isDirect).sort(byRankThenAmount);
  const related = decorated.filter((c) => !isDirect(c)).sort(byRankThenAmount);

  return {
    kind: 'matched',
    rule,
    coverages,
    related,
    // 직접 해당하는 담보가 하나도 없으면 "없다"고 말한다.
    // 곁가지만 남았는데 찾았다고 하면 그게 더 나쁘다.
    noCoverage: coverages.length === 0,
    score: picked.score,
  };
}

/**
 * 같은 계약의 같은 담보가 두 줄로 오는 경우가 있다(대상기관이 갱신 이력을 그대로 준다).
 * 화면에 같은 카드를 두 번 세우면 "두 건 청구할 수 있다"로 읽힌다.
 */
/** 담보 하나가 결과에서 어디로 갔는지. 화면이 아니라 진단 도구가 읽는다. */
export type CoverageFate =
  | 'direct' // 직접 해당으로 표시됨
  | 'related' // 참고 목록으로 밀림 (direct 패턴 불일치)
  | 'cause-mismatch' // 사고 원인(상해/질병)과 상충해 참고로 밀림
  | 'excluded-name' // 이름이 exclude 패턴에 걸림
  | 'excluded-kind' // 계약 종류가 excludeKinds 에 걸림
  | 'excluded-status' // 해지·소멸·실효
  | 'out-of-category'; // 이 규칙이 보는 카테고리가 아님

export type MatchExplanation = {
  ruleId: string | null;
  rows: { candidate: CoverageCandidate; fate: CoverageFate; detail: string }[];
};

/**
 * matchIncident 와 같은 판정을 담보마다 이유와 함께 되돌려준다.
 *
 * "일배책이 있는데 왜 담보 없음이냐" 는 물음에 코드를 열지 않고 답하기 위한 도구다.
 * 판정 순서는 matchIncident 와 동일해야 하며, 어긋나면 테스트가 잡는다.
 */
export function explainMatch(text: string, candidates: CoverageCandidate[]): MatchExplanation {
  const picked = pickRule(text);
  if (!picked) return { ruleId: null, rows: [] };
  const { rule } = picked;
  const order = new Map(rule.categories.map((c, i) => [c, i]));
  const cause = causeOf(text);

  const rows = candidates.map((c) => {
    const name = squash(c.name);
    const allowed = Boolean(rule.allowDespiteExclusion?.test(name));
    const fate: { fate: CoverageFate; detail: string } = (() => {
      if (!order.has(c.category))
        return { fate: 'out-of-category', detail: `카테고리 ${c.category} 는 이 규칙 대상이 아님` };
      if (ACTIVE_STATUSES_EXCLUDED.includes(c.coverageStatus))
        return { fate: 'excluded-status', detail: `상태 ${c.coverageStatus}` };
      if (!allowed && rule.exclude && rule.exclude.test(name))
        return { fate: 'excluded-name', detail: `이름이 제외 패턴 ${rule.exclude} 에 걸림` };
      if (!allowed && rule.excludeKinds && c.contractKind && rule.excludeKinds.includes(c.contractKind))
        return { fate: 'excluded-kind', detail: `계약 종류 ${c.contractKind}` };
      if (!rule.direct.test(name))
        return { fate: 'related', detail: `직접 패턴 ${rule.direct} 불일치 → 참고 목록` };
      if (contradictsCause(c.name, cause))
        return { fate: 'cause-mismatch', detail: `사고 원인(${cause})과 상충 → 참고 목록` };
      return {
        fate: 'direct',
        detail: allowed ? 'allow 패턴이 제외 규칙을 이기고 살림' : '직접 해당',
      };
    })();
    return { candidate: c, ...fate };
  });

  return { ruleId: rule.id, rows };
}

function dedupe(items: CoverageCandidate[]): CoverageCandidate[] {
  const seen = new Set<string>();
  const out: CoverageCandidate[] = [];
  for (const c of items) {
    const key = `${c.policyId}|${squash(c.name)}|${c.amount ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** 담보명은 띄어쓰기·괄호가 제각각이라 비교 전에 눌러둔다. */
function squash(name: string): string {
  return (name ?? '').replace(/[\s()（）[\]]/g, '');
}

/**
 * 다쳐서인가, 아파서인가.
 *
 * 국내 담보는 같은 보장을 상해형·질병형으로 나눠 판다. 감기로 통원했는데 「상해통원의료비」를
 * 앞에 세우면 틀린 안내다. 문장에서 원인을 읽어 반대편 담보를 뒤로 물린다.
 * 판단이 안 서면 null 을 돌려주고 아무것도 거르지 않는다 — 애매할 때 지우는 쪽이 더 위험하다.
 */
export type IncidentCause = 'injury' | 'illness';

const INJURY_WORDS = ['넘어', '다쳤', '다침', '부러', '골절', '삐', '접질', '베였', '데였', '화상', '부딪', '충돌', '사고', '깁스', '타박', '상해', '외상'];
const ILLNESS_WORDS = ['감기', '몸살', '독감', '염증', '질환', '질병', '아파', '아팠', '열이', '병이', '진단받', '암', '뇌졸중', '뇌출혈', '심근경색', '종양', '위염', '장염', '알레르기', '피부염'];

export function causeOf(text: string): IncidentCause | null {
  const q = normalizeQuery(text);
  const injury = INJURY_WORDS.filter((w) => q.includes(w)).length;
  const illness = ILLNESS_WORDS.filter((w) => q.includes(w)).length;
  if (injury === illness) return null;
  return injury > illness ? 'injury' : 'illness';
}

/** 담보명이 원인과 반대편이면 true. 상해형/질병형이 이름에 드러난 담보만 걸린다. */
export function contradictsCause(name: string, cause: IncidentCause | null): boolean {
  if (cause === null) return false;
  const n = squash(name);
  const isInjuryCoverage = /^(상해|재해)/.test(n);
  const isIllnessCoverage = /^질병/.test(n);
  if (cause === 'injury') return isIllnessCoverage;
  return isInjuryCoverage;
}

/**
 * 계약별로 묶는다.
 *
 * 사람이 읽는 순서는 「이 사고 → 내가 든 이 보험 → 그 안의 이 담보 → 이 금액 → 이렇게 접수」다.
 * 담보만 평평하게 늘어놓으면 어느 보험사에 무엇을 넣어야 하는지가 사라진다.
 */
export type PolicyGroup = {
  policyId: string;
  memberName: string;
  insurerName: string;
  productName: string;
  coverages: MatchedCoverage[];
};

export function groupByPolicy(coverages: MatchedCoverage[]): PolicyGroup[] {
  const groups = new Map<string, PolicyGroup>();
  for (const c of coverages) {
    const key = c.policyId;
    const found = groups.get(key);
    if (found) {
      found.coverages.push(c);
      continue;
    }
    groups.set(key, {
      policyId: c.policyId,
      memberName: c.memberName,
      insurerName: c.insurerName,
      productName: c.productName,
      coverages: [c],
    });
  }
  // 계약 순서는 첫 담보의 순위를 따른다 — 가장 직접적인 담보를 가진 계약이 먼저다.
  return [...groups.values()];
}

/** 보험금 청구권 소멸시효 3년. 사고일에서 남은 일수를 센다. */
export function daysUntilExpiry(occurredOn: Date, today: Date): number {
  const expiry = new Date(
    Date.UTC(occurredOn.getUTCFullYear() + 3, occurredOn.getUTCMonth(), occurredOn.getUTCDate()),
  );
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((expiry.getTime() - t) / 86_400_000);
}
