import { describe, expect, it } from 'vitest';
import {
  computeTotals,
  CORE_CATEGORIES,
  type MatrixCell,
  type MemberSyncRow,
  type PolicyRow,
} from '@/lib/repo/dashboard';

function member(name: string): MemberSyncRow {
  return {
    member_id: name,
    household_id: 'h1',
    display_name: name,
    relation: '본인',
    last_run_id: null,
    last_run_status: null,
    last_synced_at: null,
    last_policy_count: null,
    is_minor: false,
    guardian_consent_at: null,
  };
}

function cell(memberId: string, category: MatrixCell['category'], coverageCount: string): MatrixCell {
  return {
    member_id: memberId,
    display_name: memberId,
    category,
    category_label: category,
    sort_order: 1,
    policy_count: coverageCount === '0' ? '0' : '1',
    coverage_count: coverageCount,
    total_amount: '0',
    needs_review_count: '0',
  };
}

function policy(over: Partial<PolicyRow> = {}): PolicyRow {
  return {
    id: 'p1',
    member_name: '본인',
    contract_kind: 'flat_rate',
    insurer_name: 'A생명',
    product_name: 'A보험',
    policy_no: null,
    status: '유지',
    start_date: null,
    end_date: null,
    premium: null,
    payment_cycle: null,
    coverage_count: '0',
    terms_doc_count: '0',
    ...over,
  };
}

describe('computeTotals — 보장 공백', () => {
  // pg 는 count() 를 문자열로 돌려준다. 예전에 === 0 으로 비교해 공백이 항상 0으로 나왔다.
  it('coverage_count 가 문자열 "0" 이어도 공백으로 센다', () => {
    const matrix = CORE_CATEGORIES.map((c) => cell('m1', c, '0'));
    const totals = computeTotals([member('m1')], matrix, []);
    expect(totals.gapCount).toBe(CORE_CATEGORIES.length);
  });

  it('담보가 있으면 공백으로 세지 않는다', () => {
    const matrix = [cell('m1', 'actual_loss', '2'), cell('m1', 'liability', '0')];
    expect(computeTotals([member('m1')], matrix, []).gapCount).toBe(1);
  });

  it('핵심이 아닌 카테고리는 비어 있어도 공백이 아니다', () => {
    const matrix = [cell('m1', 'savings', '0'), cell('m1', 'fire', '0')];
    expect(computeTotals([member('m1')], matrix, []).gapCount).toBe(0);
  });

  it('구성원이 여럿이면 칸 수만큼 누적된다', () => {
    const matrix = [cell('m1', 'death', '0'), cell('m2', 'death', '0')];
    expect(computeTotals([member('m1'), member('m2')], matrix, []).gapCount).toBe(2);
  });
});

describe('computeTotals — 월 환산 보험료', () => {
  it('납입주기별로 월 기준으로 환산한다', () => {
    const policies = [
      policy({ id: 'a', premium: '100000', payment_cycle: '월납' }),
      policy({ id: 'b', premium: '300000', payment_cycle: '분기납' }),
      policy({ id: 'c', premium: '1200000', payment_cycle: '연납' }),
    ];
    expect(computeTotals([], [], policies).monthlyPremium).toBe(300000);
  });

  it('일시납은 월 부담이 없으므로 0으로 본다', () => {
    const policies = [policy({ premium: '5000000', payment_cycle: '일시납' })];
    expect(computeTotals([], [], policies).monthlyPremium).toBe(0);
  });

  it('납입주기를 모르면 합산하지 않는다', () => {
    const policies = [policy({ premium: '100000', payment_cycle: null })];
    expect(computeTotals([], [], policies).monthlyPremium).toBe(0);
  });

  it('보험료가 null 이어도 던지지 않는다', () => {
    const policies = [policy({ premium: null, payment_cycle: '월납' })];
    expect(computeTotals([], [], policies).monthlyPremium).toBe(0);
  });

  it('해지·만기 계약은 월 보험료에 넣지 않는다', () => {
    const policies = [
      policy({ id: 'a', premium: '100000', payment_cycle: '월납', status: '유지' }),
      policy({ id: 'b', premium: '900000', payment_cycle: '월납', status: '해지' }),
    ];
    const totals = computeTotals([], [], policies);
    expect(totals.monthlyPremium).toBe(100000);
    expect(totals.activePolicyCount).toBe(1);
  });
});

describe('computeTotals — 검수 대상', () => {
  it('needs_review_count 문자열을 합산한다', () => {
    const matrix: MatrixCell[] = [
      { ...cell('m1', 'other', '3'), needs_review_count: '2' },
      { ...cell('m1', 'hospital', '1'), needs_review_count: '1' },
    ];
    expect(computeTotals([], matrix, []).reviewCount).toBe(3);
  });

  it('빈 입력이면 전부 0', () => {
    expect(computeTotals([], [], [])).toEqual({
      memberCount: 0,
      activePolicyCount: 0,
      monthlyPremium: 0,
      gapCount: 0,
      reviewCount: 0,
    });
  });
});
