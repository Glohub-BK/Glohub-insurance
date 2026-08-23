import type { CoverageCategory } from './coverage-category';

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
    keywords: ['안경', '파손', '깨', '망가', '부쉈', '부수', '물건', '자전거', '휴대폰', '핸드폰', '유리', '긁어'],
    categories: ['liability'],
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
  category: CoverageCategory;
  name: string;
  amount: number | null;
  coverageStatus: string;
};

export type MatchedCoverage = CoverageCandidate & { rank: number };

export type MatchResult =
  | {
      kind: 'matched';
      rule: IncidentRule;
      /** 카테고리 우선순위 → 가입금액 순 */
      coverages: MatchedCoverage[];
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

  const coverages = candidates
    .filter((c) => order.has(c.category))
    .filter((c) => !ACTIVE_STATUSES_EXCLUDED.includes(c.coverageStatus))
    .map((c) => ({ ...c, rank: order.get(c.category) ?? 99 }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return (b.amount ?? 0) - (a.amount ?? 0);
    });

  return { kind: 'matched', rule, coverages, noCoverage: coverages.length === 0, score: picked.score };
}

/** 보험금 청구권 소멸시효 3년. 사고일에서 남은 일수를 센다. */
export function daysUntilExpiry(occurredOn: Date, today: Date): number {
  const expiry = new Date(
    Date.UTC(occurredOn.getUTCFullYear() + 3, occurredOn.getUTCMonth(), occurredOn.getUTCDate()),
  );
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((expiry.getTime() - t) / 86_400_000);
}
