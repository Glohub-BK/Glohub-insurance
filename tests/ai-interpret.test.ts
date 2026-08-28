import { describe, expect, it } from 'vitest';
import {
  buildInterpretPrompt,
  INCIDENT_TYPE_IDS,
  INTERPRET_SCHEMA,
  validateInterpretation,
} from '@/lib/domain/ai-interpret';
import { INCIDENT_RULES, matchIncident, type CoverageCandidate } from '@/lib/domain/incident-match';

function cov(over: Partial<CoverageCandidate> = {}): CoverageCandidate {
  return {
    policyId: 'p1',
    memberName: '나',
    insurerName: 'DB손해보험',
    productName: '가정보장보험',
    category: 'liability',
    name: '가족생활배상책임담보',
    amount: 100_000_000,
    contractKind: 'flat_rate',
    coverageStatus: '정상',
    ...over,
  };
}

describe('사고유형 카탈로그', () => {
  it('규칙 전부 + other 로 구성된다 — 규칙이 늘면 자동으로 따라온다', () => {
    expect(INCIDENT_TYPE_IDS).toEqual([...INCIDENT_RULES.map((r) => r.id), 'other']);
    expect(INTERPRET_SCHEMA.properties.incidentType.enum).toEqual(INCIDENT_TYPE_IDS);
  });

  it('프롬프트에 규칙 카탈로그가 들어간다', () => {
    const { system, user } = buildInterpretPrompt('아들이 장난감을 부서뜨렸어요');
    for (const r of INCIDENT_RULES) expect(system).toContain(r.id);
    expect(user).toContain('부서뜨렸어요');
  });
});

describe('validateInterpretation — 해석기 출력 검증', () => {
  it('올바른 해석은 통과한다', () => {
    const v = validateInterpretation({
      incidentType: 'liability-damage',
      normalizedQuery: '피보험자의 자녀가 타인의 재물을 파손하여 법률상 배상책임 발생',
      keywords: ['배상책임', '재물', '파손'],
    });
    expect(v?.ruleId).toBe('liability-damage');
    expect(v?.keywords).toHaveLength(3);
  });

  it("'other' 는 ruleId null — 규칙 밖 사고", () => {
    const v = validateInterpretation({ incidentType: 'other', normalizedQuery: '반려견이 타인을 물어 상해 발생', keywords: [] });
    expect(v?.ruleId).toBeNull();
  });

  it('모르는 사고유형·깨진 입력은 null — 폴백(키워드)이 있다', () => {
    for (const raw of [
      null,
      42,
      { incidentType: '없는유형', normalizedQuery: '충분히 긴 문장입니다', keywords: [] },
      { incidentType: 'liability-damage', normalizedQuery: '', keywords: [] },
    ]) {
      expect(validateInterpretation(raw)).toBeNull();
    }
  });
});

describe('matchIncident forceRuleId — 해석기가 정한 규칙으로 매칭', () => {
  it('키워드가 하나도 없는 문장도 강제 규칙으로 담보를 찾는다', () => {
    // "박살냈어요" 는 어떤 키워드에도 없다 — 해석기가 liability-damage 로 분류했다고 하자.
    const r = matchIncident('조카가 이웃집 화분을 박살냈어요', [cov()], { forceRuleId: 'liability-damage' });
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.rule.id).toBe('liability-damage');
    expect(r.noCoverage).toBe(false);
  });

  it('모르는 규칙 id 면 기존 키워드 경로로 동작한다', () => {
    const r = matchIncident('아이가 물건을 파손했어요', [cov()], { forceRuleId: '없는규칙' });
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.rule.id).toBe('liability-damage');
  });
});
