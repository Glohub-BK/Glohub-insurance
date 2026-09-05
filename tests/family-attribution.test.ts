import { describe, expect, it } from 'vitest';
import {
  attributedNameOf,
  buildAttributedMatrix,
  parseNewMemberInput,
  unmatchedInsuredNames,
} from '@/lib/domain/family-attribution';

/**
 * 실사례 기반: 계약자=본인 조회에 피보험자=배우자('박은진')·자녀 계약이 딸려 온다.
 * 이 계약들이 조회자 밑에 쌓이면 보장 맵이 거짓말을 한다.
 */

const MEMBERS = [
  { member_id: 'm1', display_name: '강병구' },
  { member_id: 'm2', display_name: '박은진' },
  { member_id: 'm3', display_name: '첫째' },
];
const NAMES = MEMBERS.map((m) => m.display_name);

describe('attributedNameOf — 계약을 피보험자에게 귀속', () => {
  it('피보험자명이 구성원과 일치하면 그 구성원에게', () => {
    expect(attributedNameOf({ member_name: '강병구', insured_name: '박은진' }, NAMES)).toBe('박은진');
  });

  it('공백 차이는 무시한다', () => {
    expect(attributedNameOf({ member_name: '강병구', insured_name: '박 은진' }, NAMES)).toBe('박은진');
  });

  it('피보험자명이 비면 조회자에게 (원래 동작)', () => {
    expect(attributedNameOf({ member_name: '강병구', insured_name: null }, NAMES)).toBe('강병구');
    expect(attributedNameOf({ member_name: '강병구', insured_name: '  ' }, NAMES)).toBe('강병구');
  });

  it('구성원에 없는 이름이면 조회자에게', () => {
    expect(attributedNameOf({ member_name: '강병구', insured_name: '김모르' }, NAMES)).toBe('강병구');
  });

  it('마스킹된 이름(김*진)은 추정 귀속하지 않는다', () => {
    expect(attributedNameOf({ member_name: '강병구', insured_name: '박*진' }, NAMES)).toBe('강병구');
  });
});

describe('unmatchedInsuredNames — 아직 가족에 없는 피보험자', () => {
  const policies = [
    { status: '유지', member_name: '강병구', insured_name: '박은진' },
    { status: '유지', member_name: '강병구', insured_name: '박은진' },
    { status: '유지', member_name: '강병구', insured_name: '강병구' },
    { status: '만기', member_name: '강병구', insured_name: '김옛날' }, // 만기는 제외
    { status: '유지', member_name: '강병구', insured_name: '박*진' }, // 마스킹 제외
    { status: '유지', member_name: '강병구', insured_name: null },
  ];

  it('구성원이 아닌 유지 계약 피보험자만 건수와 함께 돌려준다', () => {
    expect(unmatchedInsuredNames(policies, ['강병구'])).toEqual([{ name: '박은진', count: 2 }]);
  });

  it('이미 구성원이면 비어 있다', () => {
    expect(unmatchedInsuredNames(policies, NAMES)).toEqual([]);
  });
});

describe('buildAttributedMatrix — 피보험자 귀속 보장 맵', () => {
  const policies = [
    { id: 'p1', status: '유지', member_name: '강병구', insured_name: '강병구' },
    { id: 'p2', status: '유지', member_name: '강병구', insured_name: '박은진' }, // 실사례
    { id: 'p3', status: '만기', member_name: '강병구', insured_name: '강병구' },
  ];
  const coverages = [
    { policy_id: 'p1', category: 'diagnosis', amount: '10000000', coverage_status: '정상', confidence: '0.9' },
    { policy_id: 'p2', category: 'diagnosis', amount: '30000000', coverage_status: '정상', confidence: '0.9' },
    { policy_id: 'p2', category: 'liability', amount: '100000000', coverage_status: '정상', confidence: '0.7' },
    { policy_id: 'p2', category: 'surgery', amount: '500000', coverage_status: '해지', confidence: '0.9' }, // 제외
    { policy_id: 'p3', category: 'diagnosis', amount: '5000000', coverage_status: '정상', confidence: '0.9' }, // 만기 계약
  ] as const;

  const matrix = buildAttributedMatrix(
    MEMBERS,
    policies,
    coverages.map((c) => ({ ...c })),
  );
  const cell = (name: string, category: string) =>
    matrix.find((m) => m.display_name === name && m.category === category)!;

  it('배우자 피보험 계약의 담보가 배우자 칸으로 간다', () => {
    expect(cell('박은진', 'diagnosis').coverage_count).toBe('1');
    expect(cell('박은진', 'diagnosis').total_amount).toBe('30000000');
    expect(cell('박은진', 'liability').coverage_count).toBe('1');
    expect(cell('강병구', 'diagnosis').coverage_count).toBe('1'); // 본인 것만 남는다
  });

  it('구성원 × 전체 카테고리 격자를 모두 채운다 — 0 칸이 보장 공백이다', () => {
    expect(matrix.filter((m) => m.display_name === '첫째').length).toBeGreaterThan(0);
    expect(cell('첫째', 'liability').coverage_count).toBe('0');
  });

  it('만기 계약·해지 담보는 세지 않는다', () => {
    // p3(만기)의 진단 담보가 강병구 칸에 더해지지 않았다
    expect(cell('강병구', 'diagnosis').total_amount).toBe('10000000');
    expect(cell('박은진', 'surgery').coverage_count).toBe('0');
  });

  it('confidence 낮은 담보는 needs_review 로 센다', () => {
    expect(cell('박은진', 'liability').needs_review_count).toBe('1');
  });

  it('뷰와 같은 모양(문자열 숫자)을 유지한다', () => {
    const c = cell('강병구', 'diagnosis');
    expect(typeof c.coverage_count).toBe('string');
    expect(typeof c.total_amount).toBe('string');
    expect(typeof c.sort_order).toBe('number');
  });
});

describe('parseNewMemberInput — 가족 추가 입력 검증', () => {
  it('정상 입력을 통과시킨다', () => {
    const r = parseNewMemberInput({ name: ' 박은진 ', relation: '배우자', isMinor: false });
    expect(r).toEqual({ ok: true, value: { displayName: '박은진', relation: '배우자', isMinor: false } });
  });

  it('미성년 자녀는 법정대리인 동의가 있어야 한다', () => {
    expect(
      parseNewMemberInput({ name: '첫째', relation: '자녀', isMinor: true, guardianConsent: true }).ok,
    ).toBe(true);
    expect(parseNewMemberInput({ name: '첫째', relation: '자녀', isMinor: true }).ok).toBe(false);
  });

  it('미성년은 자녀 관계에서만 가능하다', () => {
    expect(
      parseNewMemberInput({ name: '누군가', relation: '배우자', isMinor: true, guardianConsent: true }).ok,
    ).toBe(false);
  });

  it('이름 길이·관계를 검증한다', () => {
    expect(parseNewMemberInput({ name: '', relation: '배우자' }).ok).toBe(false);
    expect(parseNewMemberInput({ name: 'ㄱ'.repeat(21), relation: '배우자' }).ok).toBe(false);
    expect(parseNewMemberInput({ name: '박은진', relation: '본인' }).ok).toBe(false);
    expect(parseNewMemberInput(null).ok).toBe(false);
  });
});
