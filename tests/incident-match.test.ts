import { describe, expect, it } from 'vitest';
import {
  daysUntilExpiry,
  explainMatch,
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
    contractKind: 'flat_rate',
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
      cov({ name: '가족일상생활배상책임', amount: 50_000_000 }),
      cov({ name: '일상생활중배상책임', amount: 100_000_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages.map((c) => c.name)).toEqual(['일상생활중배상책임', '가족일상생활배상책임']);
  });

  it('가입금액이 null 이어도 정렬이 깨지지 않는다', () => {
    const r = matchIncident('아이가 안경을 깨뜨렸어요', [
      cov({ name: '가족일상생활배상책임', amount: null }),
      cov({ name: '일상생활중배상책임', amount: 1 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages.map((c) => c.name)).toEqual(['일상생활중배상책임', '가족일상생활배상책임']);
  });

  // ── 여기부터: 10019.2억원 사건 이후 추가한 방어선 ──────────────────

  it('감기로 통원했는데 암·골절 담보까지 앞에 세우지 않는다', () => {
    const r = matchIncident('감기로 병원 다녀왔어요', [
      cov({ category: 'actual_loss', name: '질병통원의료비', amount: 250_000 }),
      cov({ category: 'diagnosis', name: '암진단비', amount: 30_000_000 }),
      cov({ category: 'diagnosis', name: '골절진단비', amount: 300_000 }),
      cov({ category: 'hospital', name: '상해입원일당', amount: 30_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages.map((c) => c.name)).toEqual(['질병통원의료비']);
    // 분류 자체가 다른 담보는 아예 목록에 없다.
    const all = [...r.coverages, ...r.related].map((c) => c.name);
    expect(all).not.toContain('암진단비');
    expect(all).not.toContain('골절진단비');
  });

  it('지급 방식을 담보마다 붙인다 — 실손·정액·일당은 단위가 다르다', () => {
    const r = matchIncident('계단에서 넘어져 골절', [
      cov({ category: 'actual_loss', name: '상해통원의료비', amount: 250_000 }),
      cov({ category: 'diagnosis', name: '골절진단비', amount: 300_000 }),
      cov({ category: 'hospital', name: '상해입원일당', amount: 30_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    const basis = Object.fromEntries(r.coverages.map((c) => [c.name, c.basis]));
    expect(basis['상해통원의료비']).toBe('actual');
    expect(basis['골절진단비']).toBe('lumpsum');
    expect(basis['상해입원일당']).toBe('daily');
  });

  it('말이 안 되는 금액은 화면에 내보내지 않는다 — 옛 파서가 남긴 수십조', () => {
    const r = matchIncident('계단에서 넘어져 골절', [
      cov({ category: 'diagnosis', name: '골절진단비', amount: 30_000_000_100_000 }),
      cov({ category: 'hospital', name: '상해입원일당', amount: 13_000_180 }),
      cov({ category: 'actual_loss', name: '상해통원의료비', amount: 250_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    const shown = Object.fromEntries(r.coverages.map((c) => [c.name, c.shownAmount]));
    expect(shown['골절진단비']).toBeNull();   // 30조
    expect(shown['상해입원일당']).toBeNull(); // 일당 1,300만원
    expect(shown['상해통원의료비']).toBe(250_000);
  });

  it('다쳐서 갔는지 아파서 갔는지로 상해형·질병형을 가른다', () => {
    const set = [
      cov({ category: 'actual_loss', name: '상해통원의료비', amount: 250_000 }),
      cov({ category: 'actual_loss', name: '질병통원의료비', amount: 250_000 }),
    ];

    const cold = matchIncident('감기로 병원 다녀왔어요', set);
    if (cold.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(cold.coverages.map((c) => c.name)).toEqual(['질병통원의료비']);
    expect(cold.related.map((c) => c.name)).toEqual(['상해통원의료비']);

    const hurt = matchIncident('넘어져서 다쳤는데 병원 통원했어요', set);
    if (hurt.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(hurt.coverages.map((c) => c.name)).toContain('상해통원의료비');
    expect(hurt.coverages.map((c) => c.name)).not.toContain('질병통원의료비');
  });

  it('원인을 못 읽으면 아무것도 거르지 않는다 — 애매할 때 지우는 쪽이 더 위험하다', () => {
    const r = matchIncident('병원 다녀왔어요', [
      cov({ category: 'actual_loss', name: '상해통원의료비', amount: 250_000 }),
      cov({ category: 'actual_loss', name: '질병통원의료비', amount: 250_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages).toHaveLength(2);
  });

  it('아이가 물건을 깨뜨렸는데 자동차보험 대물배상을 붙이지 않는다', () => {
    // 실제로 화면에 KB 자동차보험 「대물배상 10억원」이 떴다.
    // 담보 이름에 '자동차'가 없어 이름만으로는 못 걸러진다 — 계약 종류를 봐야 한다.
    // 게다가 이 규칙의 면책 안내에는 "자동차 사고는 면책"이라고 우리가 적어놓았다.
    const r = matchIncident('아이가 친구 안경을 깨뜨렸어요', [
      cov({
        category: 'liability',
        name: '대물배상',
        amount: 1_000_000_000,
        contractKind: 'car',
        productName: 'KB다이렉트(인터넷)개인용자동차보험',
      }),
      cov({
        category: 'liability',
        name: '가족일상생활중배상책임',
        amount: 100_000_000,
        contractKind: 'flat_rate',
        productName: '(무)메리츠 올바른보장보험',
      }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    const all = [...r.coverages, ...r.related].map((c) => c.name);
    expect(all).not.toContain('대물배상');
    expect(r.coverages.map((c) => c.name)).toEqual(['가족일상생활중배상책임']);
  });

  it('같은 계약의 같은 담보가 두 번 오면 한 번만 센다', () => {
    const r = matchIncident('아이가 친구 안경을 깨뜨렸어요', [
      cov({ category: 'liability', name: '일상생활중배상책임', amount: 100_000_000 }),
      cov({ category: 'liability', name: '일상생활중배상책임', amount: 100_000_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages).toHaveLength(1);
  });

  it('배상책임·화재는 실손형이다 — 진단만으로 나오는 정액이 아니다', () => {
    const r = matchIncident('아이가 친구 안경을 깨뜨렸어요', [
      cov({ category: 'liability', name: '일상생활중배상책임', amount: 100_000_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages[0].basis).toBe('actual');
  });

  it('직접 해당하는 담보가 없으면 곁가지만 남아도 noCoverage', () => {
    const r = matchIncident('계단에서 넘어져 골절', [
      cov({ category: 'actual_loss', name: '해외실손의료비', amount: 1_000_000 }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages).toHaveLength(0);
    expect(r.related).toHaveLength(1);
    expect(r.noCoverage).toBe(true);
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

describe('allowDespiteExclusion — 일배책이 자동차 제외 규칙에 지워지지 않는다', () => {
  // 실사용에서 나온 회귀: 일배책을 가진 사용자가 「아이가 물건 파손」을 넣었는데
  // "담보 없음" 이 나왔다. 자동차 담보를 걸러내려던 exclude 가 일배책까지 지운 것.
  const TEXT = '아이가 물건 파손을 했어요';

  it('이름에 (대인·대물) 이 붙은 일배책이 살아남는다', () => {
    const r = matchIncident(TEXT, [cov({ name: '가족일상생활중배상책임(대인·대물)' })]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.noCoverage).toBe(false);
    expect(r.coverages.map((c) => c.name)).toContain('가족일상생활중배상책임(대인·대물)');
  });

  it('운전자보험(car) 특약으로 들어온 일배책도 살아남는다', () => {
    const r = matchIncident(TEXT, [
      cov({ name: '일상생활배상책임', contractKind: 'car', productName: '참좋은운전자보험' }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.noCoverage).toBe(false);
  });

  it('자동차보험 대물배상은 여전히 나오지 않는다 — 이전 수정의 회귀 방지', () => {
    const r = matchIncident(TEXT, [
      cov({ name: '대물배상', contractKind: 'car', productName: 'KB다이렉트개인용자동차보험' }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.coverages).toHaveLength(0);
    expect(r.related).toHaveLength(0);
    expect(r.noCoverage).toBe(true);
  });

  it('누수 사고에서도 (대인) 붙은 일배책이 살아남는다', () => {
    const r = matchIncident('윗집 누수로 벽지가 젖었어요', [
      cov({ name: '일상생활중배상책임(대인·대물)' }),
    ]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.noCoverage).toBe(false);
  });
});

describe('explainMatch — 판정 이유를 담보마다 되돌려준다', () => {
  const TEXT = '아이가 물건 파손을 했어요';
  const MIXED: CoverageCandidate[] = [
    cov({ name: '가족일상생활중배상책임(대인·대물)' }),
    cov({ name: '대물배상', contractKind: 'car' }),
    cov({ name: '골절진단비', category: 'diagnosis' }),
    cov({ name: '배상책임보장', coverageStatus: '해지' }),
  ];

  it('각 담보의 운명과 이유를 말한다', () => {
    const ex = explainMatch(TEXT, MIXED);
    expect(ex.ruleId).toBe('liability-damage');
    const fateOf = (name: string) => ex.rows.find((r) => r.candidate.name === name)?.fate;
    expect(fateOf('가족일상생활중배상책임(대인·대물)')).toBe('direct');
    // 이름 제외에서 대인·대물을 걷어낸 뒤에는 계약 종류가 막는다
    expect(fateOf('대물배상')).toBe('excluded-kind');
    expect(fateOf('골절진단비')).toBe('out-of-category');
    expect(fateOf('배상책임보장')).toBe('excluded-status');
  });

  it('matchIncident 와 판정이 어긋나지 않는다 — 어긋나면 진단 도구가 거짓말을 한다', () => {
    for (const text of ['아이가 물건 파손을 했어요', '윗집 누수로 벽지가 젖었어요', '감기로 병원 다녀왔어요']) {
      const m = matchIncident(text, MIXED);
      const ex = explainMatch(text, MIXED);
      if (m.kind !== 'matched') continue;
      const directNames = new Set(m.coverages.map((c) => c.name));
      // dedupe 로 합쳐진 이름까지 고려해, direct 판정 이름 집합이 일치해야 한다.
      const explainedDirect = new Set(
        ex.rows.filter((r) => r.fate === 'direct').map((r) => r.candidate.name),
      );
      expect(explainedDirect).toEqual(directNames);
    }
  });

  it('규칙이 안 잡히는 문장은 빈 결과', () => {
    expect(explainMatch('오늘 날씨 좋다', MIXED)).toEqual({ ruleId: null, rows: [] });
  });
});

describe('활용형·흔한 물건 — 「부서뜨렸어요」「장난감」', () => {
  it.each([
    '우리 아들(수호)이 친구의 장난감을 부서뜨렸어요',
    '아이가 마트에서 물건을 떨어뜨려 고장냈어요',
    '딸이 친구 핸드폰 액정을 깨뜨렸어요',
  ])('%s → liability-damage', (text) => {
    expect(pickRule(text)?.rule.id).toBe('liability-damage');
  });
});

describe('담보명 표기 변형 — 「가족생활배상책임담보」 실사례', () => {
  // Gemini 답변에 비친 실제 담보명은 '가족일상생활'이 아니라 '가족생활'이었다.
  // allow 패턴이 그 표기를 몰라 "담보 없음" 오탐이 났다.
  const TEXT = '아이가 친구 안경을 깨뜨렸어요';

  it.each([
    '가족생활배상책임담보',
    '가족생활배상책임(대인·대물)',
    '일상배상책임',
    '배상책임(대물)', // 이름 제외에서 대인·대물을 걷어냈으므로 이제 살아남는다
  ])('%s 가 직접 해당으로 나온다', (name) => {
    const r = matchIncident(TEXT, [cov({ name })]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.noCoverage).toBe(false);
    expect(r.coverages.map((c) => c.name)).toContain(name);
  });

  it('자동차보험(car)의 대물배상은 계약 종류로 여전히 걸러진다', () => {
    const r = matchIncident(TEXT, [cov({ name: '대물배상', contractKind: 'car' })]);
    if (r.kind !== 'matched') throw new Error('matched 여야 한다');
    expect(r.noCoverage).toBe(true);
  });
});
