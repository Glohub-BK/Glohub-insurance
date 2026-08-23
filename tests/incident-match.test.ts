import { describe, expect, it } from 'vitest';
import {
  daysUntilExpiry,
  matchIncident,
  pickRule,
  scoreRule,
  INCIDENT_RULES,
  type CoverageCandidate,
} from '@/lib/domain/incident-match';
import { COVERAGE_CATEGORIES } from '@/lib/domain/coverage-category';

function cov(over: Partial<CoverageCandidate> = {}): CoverageCandidate {
  return {
    policyId: 'p1',
    memberName: '나',
    insurerName: 'DB손해보험',
    productName: '내생애든든종합보험1404',
    category: 'liability',
    name: '가족일상생활중배상책임',
    amount: 100_000_000,
    coverageStatus: '정상',
    ...over,
  };
}

describe('pickRule', () => {
  it.each([
    ['아이가 친구 안경을 깨뜨렸어요', 'liability-damage'],
    ['계단에서 넘어져서 손목이 골절됐어요', 'injury-fracture'],
    ['감기로 병원 다녀왔어요', 'outpatient'],
    ['주차하다 옆차를 긁었어요', 'car'],
    ['윗집 누수로 벽지가 젖었어요', 'water-leak'],
    ['암 진단받았습니다', 'diagnosis'],
  ])('%s → %s', (text, id) => {
    expect(pickRule(text)?.rule.id).toBe(id);
  });

  it('빈 문장이면 null', () => {
    expect(pickRule('')).toBeNull();
    expect(pickRule('   ')).toBeNull();
  });

  it('아무 키워드도 없으면 null', () => {
    expect(pickRule('오늘 날씨가 좋네요')).toBeNull();
  });

  it('undefined 가 들어와도 던지지 않는다', () => {
    expect(pickRule(undefined as unknown as string)).toBeNull();
  });

  it('키워드가 더 많이 맞는 규칙이 이긴다', () => {
    // '차'와 '주차'가 겹치지만 자동차 키워드가 더 많다
    expect(pickRule('주차장에서 차량 범퍼를 추돌했어요')?.rule.id).toBe('car');
  });

  it('띄어쓰기가 달라도 같은 결과', () => {
    expect(pickRule('아이가안경을깨뜨렸어요')?.rule.id).toBe('liability-damage');
    expect(pickRule('아 이 가 안 경 을 깨 뜨 렸 어 요')?.rule.id).toBe('liability-damage');
  });
});

describe('scoreRule', () => {
  it('맞은 키워드 수를 센다', () => {
    const rule = INCIDENT_RULES.find((r) => r.id === 'injury-fracture')!;
    expect(scoreRule(rule, '계단에서 넘어져 골절')).toBe(3); // 골절, 넘어, 계단
  });

  it('빈 문장은 0', () => {
    expect(scoreRule(INCIDENT_RULES[0], '')).toBe(0);
  });
});

describe('matchIncident', () => {
  it('해당 카테고리 담보만 골라낸다', () => {
    const r = matchIncident('아이가 안경을 깨뜨렸어요', [
      cov(),
      cov({ category: 'death', name: '일반상해사망' }),
      cov({ category: 'fire', name: '주택화재손해' }),
    ]);
    expect(r.kind).toBe('matched');
    if (r.kind !== 'matched') return;
    expect(r.coverages).toHaveLength(1);
    expect(r.coverages[0].name).toBe('가족일상생활중배상책임');
    expect(r.noCoverage).toBe(false);
  });

  it('해지된 담보는 제외한다', () => {
    const r = matchIncident('아이가 안경을 깨뜨렸어요', [cov({ coverageStatus: '해지' })]);
    expect(r.kind).toBe('matched');
    if (r.kind !== 'matched') return;
    expect(r.coverages).toHaveLength(0);
    expect(r.noCoverage).toBe(true);
  });

  it('규칙은 맞지만 보유 담보가 없으면 noCoverage', () => {
    const r = matchIncident('아이가 안경을 깨뜨렸어요', []);
    expect(r.kind).toBe('matched');
    if (r.kind !== 'matched') return;
    expect(r.noCoverage).toBe(true);
    expect(r.rule.quote).toBeTruthy();
  });

  it('카테고리 우선순위대로 정렬한다', () => {
    // injury-fracture: actual_loss → diagnosis → surgery → hospital → disability
    const r = matchIncident('계단에서 넘어져 골절', [
      cov({ category: 'hospital', name: '상해입원일당', amount: 30_000 }),
      cov({ category: 'actual_loss', name: '상해의료비', amount: 5_000_000 }),
      cov({ category: 'diagnosis', name: '골절진단비', amount: 300_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages.map((c) => c.category)).toEqual(['actual_loss', 'diagnosis', 'hospital']);
  });

  it('같은 카테고리면 가입금액이 큰 것이 먼저', () => {
    const r = matchIncident('아이가 안경을 깨뜨렸어요', [
      cov({ name: 'A', amount: 50_000_000 }),
      cov({ name: 'B', amount: 100_000_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages.map((c) => c.name)).toEqual(['B', 'A']);
  });

  it('가입금액이 null 이어도 정렬이 깨지지 않는다', () => {
    const r = matchIncident('아이가 안경을 깨뜨렸어요', [
      cov({ name: 'A', amount: null }),
      cov({ name: 'B', amount: 1 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages.map((c) => c.name)).toEqual(['B', 'A']);
  });

  it('규칙에 안 걸리면 unknown', () => {
    expect(matchIncident('오늘 점심 뭐 먹지', [cov()]).kind).toBe('unknown');
  });

  it('가족 구성원이 달라도 모두 후보로 올린다', () => {
    const r = matchIncident('아이가 안경을 깨뜨렸어요', [
      cov({ memberName: '나' }),
      cov({ memberName: '배우자', policyId: 'p2' }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages.map((c) => c.memberName)).toEqual(['나', '배우자']);
  });
});

describe('규칙 정의 일관성', () => {
  it('모든 규칙에 약관 인용과 서류 목록이 있다', () => {
    for (const r of INCIDENT_RULES) {
      expect(r.quote.length).toBeGreaterThan(20);
      expect(r.docs.length).toBeGreaterThan(0);
      expect(r.warn.length).toBeGreaterThan(0);
    }
  });

  it('규칙이 참조하는 카테고리는 모두 실재한다', () => {
    for (const r of INCIDENT_RULES) {
      for (const c of r.categories) {
        expect(COVERAGE_CATEGORIES).toContain(c);
      }
    }
  });

  it('규칙 id 는 중복되지 않는다', () => {
    const ids = INCIDENT_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('daysUntilExpiry — 소멸시효 3년', () => {
  it('사고 당일이면 3년치가 남는다', () => {
    const d = daysUntilExpiry(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 0, 1)));
    // 2026-01-01 → 2029-01-01: 2026(365) + 2027(365) + 2028 윤년(366)
    expect(d).toBe(1096);
  });

  it('기한이 지나면 음수', () => {
    const d = daysUntilExpiry(new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2026, 0, 1)));
    expect(d).toBeLessThan(0);
  });

  it('마감 하루 전이면 1', () => {
    const d = daysUntilExpiry(new Date(Date.UTC(2023, 5, 10)), new Date(Date.UTC(2026, 5, 9)));
    expect(d).toBe(1);
  });
});
