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

type Spec = {
  /** 반드시 하나는 들어 있어야 하는 말. 없으면 후보에서 뺀다. */
  must: string[];
  /** 있으면 점수를 더하는 말. */
  should: string[];
  /** 있으면 점수를 크게 깎는 말 — 보통 면책·제외 조항이다. */
  avoid: string[];
};

const SPECS: Record<RuleId, Spec> = {
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

export function scoreClause(rule: RuleId, clause: Pick<Clause, 'body' | 'title'>): number {
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
  rule: RuleId,
  clauses: T[],
): Scored<T> | null {
  let best: Scored<T> | null = null;
  for (const clause of clauses) {
    const score = scoreClause(rule, clause);
    if (score >= MIN_SCORE && (!best || score > best.score)) best = { clause, score };
  }
  return best;
}

export function ruleIds(): RuleId[] {
  return Object.keys(SPECS) as RuleId[];
}
