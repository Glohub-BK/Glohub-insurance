import { describe, expect, it } from 'vitest';
import { COVERAGE_CATEGORIES } from '../src/lib/domain/coverage-category';
import {
  SAMPLE_CANDIDATES,
  SAMPLE_COVERAGES,
  SAMPLE_MATRIX,
  SAMPLE_MEMBERS,
  SAMPLE_POLICIES,
} from '../src/lib/demo/sample';
import { matchIncident } from '../src/lib/domain/incident-match';

/**
 * 예시 가구는 화면을 채우는 더미가 아니라 "이 앱이 무엇을 잡아주는가"를 보여주는 시나리오다.
 * 그 시나리오가 깨지면 첫 화면의 설득력이 사라지므로 테스트로 고정한다.
 */
describe('예시 가구', () => {
  it('모든 계약은 실재하는 구성원에게 속한다', () => {
    const names = new Set(SAMPLE_MEMBERS.map((m) => m.display_name));
    for (const p of SAMPLE_POLICIES) expect(names).toContain(p.member_name);
  });

  it('모든 담보는 실재하는 계약에 속한다', () => {
    const ids = new Set(SAMPLE_POLICIES.map((p) => p.id));
    for (const c of SAMPLE_COVERAGES) expect(ids).toContain(c.policy_id);
  });

  it('보장 맵은 구성원 × 전체 카테고리를 빠짐없이 채운다', () => {
    expect(SAMPLE_MATRIX).toHaveLength(SAMPLE_MEMBERS.length * COVERAGE_CATEGORIES.length);
    for (const m of SAMPLE_MEMBERS) {
      const cats = SAMPLE_MATRIX.filter((c) => c.member_id === m.member_id).map((c) => c.category);
      expect(new Set(cats).size).toBe(COVERAGE_CATEGORIES.length);
    }
  });

  it('보장 맵의 담보 수가 실제 담보 목록과 일치한다', () => {
    const policyMember = new Map(SAMPLE_POLICIES.map((p) => [p.id, p.member_name]));
    for (const cell of SAMPLE_MATRIX) {
      const actual = SAMPLE_COVERAGES.filter(
        (c) => policyMember.get(c.policy_id) === cell.display_name && c.category === cell.category,
      ).length;
      expect(Number(cell.coverage_count)).toBe(actual);
    }
  });

  it('첫째에게 배상책임 공백이 있다 — 이 앱이 잡아주는 바로 그 구멍이다', () => {
    const child = SAMPLE_MEMBERS.find((m) => m.relation === '자녀');
    expect(child).toBeDefined();
    const cell = SAMPLE_MATRIX.find(
      (c) => c.member_id === child!.member_id && c.category === 'liability',
    );
    expect(cell).toBeDefined();
    expect(Number(cell!.coverage_count)).toBe(0);
  });

  it('본인·배우자 중 한 명 이상은 배상책임을 가지고 있다 — 그래야 안내할 대상이 있다', () => {
    const adults = SAMPLE_MEMBERS.filter((m) => !m.is_minor).map((m) => m.member_id);
    const covered = SAMPLE_MATRIX.filter(
      (c) => adults.includes(c.member_id) && c.category === 'liability' && Number(c.coverage_count) > 0,
    );
    expect(covered.length).toBeGreaterThan(0);
  });

  it('예시 후보로 대표 사고 문장이 진단된다', () => {
    const result = matchIncident('아이가 친구 안경을 깨뜨렸어요', SAMPLE_CANDIDATES);
    expect(result.kind).toBe('matched');
    if (result.kind !== 'matched') return;
    // 첫째에게는 배상책임이 없지만, 부모 계약의 가족일상생활배상책임이 후보로 잡혀야 한다.
    expect(result.noCoverage).toBe(false);
    expect(result.coverages[0].category).toBe('liability');
  });

  it('금액은 문자열이 아니라 숫자로 들어간다 — 화면에서 그대로 더한다', () => {
    for (const c of SAMPLE_CANDIDATES) {
      if (c.amount !== null) expect(typeof c.amount).toBe('number');
    }
  });
});
