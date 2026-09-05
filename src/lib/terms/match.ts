import type { Clause } from './parse';

/**
 * 사고 유형 ↔ 약관 조항 연결.
 *
 * 조항을 고르는 기준은 키워드 점수 하나뿐이고, 문턱을 넘지 못하면 **아무것도 고르지
 * 않는다**. 엉뚱한 조항을 근거랍시고 보여주는 것이 근거를 안 보여주는 것보다 나쁘다.
 * 화면은 조항이 없으면 "예시 문구"라고 밝히고 넘어간다.
 */

export type RuleId =
  | 'liability-damage'
  | 'injury-fracture'
  | 'outpatient'
  | 'car'
  | 'water-leak'
  | 'diagnosis';

/**
 * 인용 조항을 고르는 키. 규칙 id 그대로가 기본이지만, 자동차 사고는 물적/인명
 * 갈래에 따라 근거 조항이 완전히 다르다 — 「옆차를 긁었어요」의 근거는 대물배상
 * 조항이어야지, 자기신체사고 조항이면 엉뚱한 원문 인용이 된다(실사례).
 * 화면이 사고 문장을 보고 갈래 키를 골라 온다.
 */
export type CitationKey = RuleId | 'car-property' | 'car-person';

type Spec = {
  /** 반드시 하나는 들어 있어야 하는 말. 없으면 후보에서 뺀다. */
  must: string[];
  /** 있으면 점수를 더하는 말. */
  should: string[];
  /** 있으면 점수를 크게 깎는 말 — 보통 면책·제외 조항이다. */
  avoid: string[];
};

const SPECS: Record<CitationKey, Spec> = {
  'liability-damage': {
    must: ['배상책임', '법률상의 배상책임', '법률상 배상책임'],
    should: ['일상생활', '타인', '재물', '손해', '피보험자'],
    avoid: ['보상하지 않는', '면책', '제외'],
  },
  'injury-fracture': {
    must: ['골절'],
    should: ['상해', '진단', '지급', '보험기간'],
    avoid: ['보상하지 않는', '면책'],
  },
  outpatient: {
    must: ['통원'],
    should: ['외래', '처방조제비', '공제', '보상'],
    avoid: ['보상하지 않는', '면책'],
  },
  car: {
    must: ['자동차상해', '자기신체사고', '대인배상', '무보험'],
    should: ['사고', '피보험자동차', '보상'],
    avoid: ['보상하지 않는', '면책'],
  },
  // 물적 사고(옆차 긁음·문콕): 근거는 대물배상·자기차량손해 조항이다.
  'car-property': {
    must: ['대물배상', '자기차량손해'],
    should: ['재물', '훼손', '피보험자동차', '법률상', '손해배상'],
    avoid: ['보상하지 않는', '면책'],
  },
  // 인명 사고(사람을 치었거나 내가 다쳤을 때).
  'car-person': {
    must: ['대인배상', '자기신체사고', '자동차상해', '무보험'],
    should: ['상해', '사망', '피보험자동차', '보상'],
    avoid: ['보상하지 않는', '면책'],
  },
  'water-leak': {
    must: ['누수', '급배수', '수도관', '누출'],
    should: ['시설', '손해', '배상'],
    avoid: ['보상하지 않는', '면책'],
  },
  diagnosis: {
    must: ['진단확정', '진단비'],
    should: ['질병', '지급', '최초', '보험기간'],
    avoid: ['보상하지 않는', '면책'],
  },
};

export type Scored<T> = { clause: T; score: number };

/** 점수가 이 아래면 "못 찾았다"로 본다. 근거 없는 인용을 내보내지 않기 위한 문턱이다. */
export const MIN_SCORE = 3;

export function scoreClause(rule: CitationKey, clause: Pick<Clause, 'body' | 'title'>): number {
  const spec = SPECS[rule];
  const text = `${clause.title ?? ''} ${clause.body}`;

  if (!spec.must.some((k) => text.includes(k))) return 0;

  let score = 3; // must 통과
  for (const k of spec.should) if (text.includes(k)) score += 1;
  for (const k of spec.avoid) if (text.includes(k)) score -= 4;

  // 표제에 핵심어가 있으면 그 조가 바로 그 담보다.
  if (spec.must.some((k) => (clause.title ?? '').includes(k))) score += 2;

  return score;
}

export function pickClause<T extends Pick<Clause, 'body' | 'title'>>(
  rule: CitationKey,
  clauses: T[],
): Scored<T> | null {
  let best: Scored<T> | null = null;
  for (const clause of clauses) {
    const score = scoreClause(rule, clause);
    if (score >= MIN_SCORE && (!best || score > best.score)) best = { clause, score };
  }
  return best;
}

export function citationKeys(): CitationKey[] {
  return Object.keys(SPECS) as CitationKey[];
}

/**
 * 모든 규칙의 must 어휘. 조항 후보를 **DB 단계에서** 좁히는 데 쓴다.
 *
 * 예전에는 가구의 조항을 `order by ord limit 400` 으로 잘라서 가져왔다. 그런데 ord 는
 * 문서 안에서의 순서라, 전체를 ord 로 정렬하면 **모든 약관의 앞부분만** 남는다.
 * 일상생활배상책임 같은 특별약관은 약관 뒤쪽에 있어 한 건도 후보에 들어오지 못했다 —
 * 그래서 「(회사의 손해배상책임)」 같은 앞쪽 조항이 근거로 인용됐다.
 *
 * 자를 거라면 위치가 아니라 **관련성**으로 잘라야 한다. 규칙이 늘면 이 목록도 따라 는다.
 */
export function citationMustTerms(): string[] {
  const all = citationKeys().flatMap((key) => SPECS[key].must);
  // 짧은 말이 긴 말을 포함하면 긴 쪽은 버린다 ('배상책임' 이 '법률상 배상책임' 을 덮는다).
  const sorted = [...new Set(all)].sort((a, b) => a.length - b.length);
  return sorted.filter((term, i) => !sorted.slice(0, i).some((shorter) => term.includes(shorter)));
}
