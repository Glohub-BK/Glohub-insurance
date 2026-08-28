import { describe, expect, it } from 'vitest';
import {
  buildAnalysisPrompt,
  quoteAppearsIn,
  selectClauses,
  validateVerdict,
  VERDICT_SCHEMA,
  type ClauseInput,
} from '@/lib/domain/ai-verdict';
import type { CoverageCandidate } from '@/lib/domain/incident-match';

function cov(over: Partial<CoverageCandidate> = {}): CoverageCandidate {
  return {
    policyId: 'p1',
    memberName: '나',
    insurerName: 'DB손해보험',
    productName: '내생애든든종합보험',
    category: 'liability',
    name: '가족일상생활중배상책임',
    amount: 100_000_000,
    contractKind: 'flat_rate',
    coverageStatus: '정상',
    ...over,
  };
}

const CLAUSE: ClauseInput = {
  articleLabel: '제3조',
  title: '보상하는 손해',
  body: '회사는 피보험자가 일상생활 중 우연한 사고로 타인의 재물에 손해를 입혀 법률상 배상책임을 부담함으로써 입은 손해를 보상하여 드립니다.',
  source: 'DB손해보험 · 내생애든든종합보험',
};

describe('quoteAppearsIn — 인용은 원문에 실제로 있어야 한다', () => {
  it('원문 그대로면 통과', () => {
    expect(quoteAppearsIn('타인의 재물에 손해를 입혀', CLAUSE.body)).toBe(true);
  });

  it('공백·줄바꿈 차이는 무시한다 — PDF 추출 텍스트는 공백이 지저분하다', () => {
    expect(quoteAppearsIn('타인의  재물에\n손해를 입혀', CLAUSE.body)).toBe(true);
  });

  it('지어낸 인용은 죽는다', () => {
    expect(quoteAppearsIn('회사는 무조건 전액을 지급합니다', CLAUSE.body)).toBe(false);
  });

  it('10자 미만의 인용은 근거가 아니다', () => {
    expect(quoteAppearsIn('보상', CLAUSE.body)).toBe(false);
  });
});

describe('validateVerdict — 검증 게이트', () => {
  const coverages = [cov()];
  const clauses = [CLAUSE];
  const good = {
    coverageIndex: 0,
    clauseIndex: 0,
    applies: 'likely',
    quote: '타인의 재물에 손해를 입혀 법률상 배상책임을 부담',
    reason: '물건 파손은 재물 손해에 해당합니다.',
  };

  it('올바른 판정은 통과한다', () => {
    const v = validateVerdict({ findings: [good], summary: '배상책임 담보가 해당합니다.' }, coverages, clauses);
    expect(v.findings).toHaveLength(1);
    expect(v.dropped).toBe(0);
    expect(v.findings[0].coverage.name).toBe('가족일상생활중배상책임');
  });

  it('범위 밖 인덱스는 버린다 — 없는 담보를 지어내지 못한다', () => {
    const v = validateVerdict(
      { findings: [{ ...good, coverageIndex: 7 }, { ...good, clauseIndex: -1 }], summary: '' },
      coverages,
      clauses,
    );
    expect(v.findings).toHaveLength(0);
    expect(v.dropped).toBe(2);
  });

  it('원문에 없는 인용은 버린다 — 환각의 마지막 방어선', () => {
    const v = validateVerdict(
      { findings: [{ ...good, quote: '회사는 어떤 경우에도 전액 지급합니다' }], summary: '' },
      coverages,
      clauses,
    );
    expect(v.findings).toHaveLength(0);
    expect(v.dropped).toBe(1);
  });

  it('applies 는 likely/maybe 만 허용한다', () => {
    const v = validateVerdict({ findings: [{ ...good, applies: 'certain' }], summary: '' }, coverages, clauses);
    expect(v.findings).toHaveLength(0);
  });

  it('같은 담보의 중복 판정은 첫 번째만 남긴다', () => {
    const v = validateVerdict(
      { findings: [good, { ...good, applies: 'maybe' }], summary: '' },
      coverages,
      clauses,
    );
    expect(v.findings).toHaveLength(1);
    expect(v.findings[0].applies).toBe('likely');
  });

  it('깨진 입력에도 죽지 않는다 — LLM 출력은 신뢰하지 않는 입력이다', () => {
    for (const raw of [null, undefined, 42, 'text', {}, { findings: 'x' }, { findings: [null, 7] }]) {
      const v = validateVerdict(raw, coverages, clauses);
      expect(v.findings).toHaveLength(0);
    }
  });

  it('빈 findings 는 정상 출력이다 — 억지로 찾는 것보다 낫다', () => {
    const v = validateVerdict({ findings: [], summary: '해당 담보가 없습니다.' }, coverages, clauses);
    expect(v.findings).toHaveLength(0);
    expect(v.dropped).toBe(0);
    expect(v.summary).toBe('해당 담보가 없습니다.');
  });
});

describe('selectClauses — 어휘 겹침으로 조항을 고른다', () => {
  const clauses: ClauseInput[] = [
    CLAUSE,
    { ...CLAUSE, articleLabel: '제9조', title: '골절진단비', body: '상해의 직접결과로 골절 상태가 되었을 때 골절진단비를 지급합니다.' },
    { ...CLAUSE, articleLabel: '제20조', title: '보험료 납입', body: '계약자는 보험료를 납입기일까지 납입하여야 합니다.' },
  ];

  it('사고 문장과 겹치는 조항을 앞세운다', () => {
    const picked = selectClauses('아이가 타인의 재물을 파손해서 배상책임이 생겼어요', clauses);
    expect(picked[0].articleLabel).toBe('제3조');
    // 아무 토큰도 겹치지 않는 납입 조항은 뽑히지 않는다.
    expect(picked.map((c) => c.articleLabel)).not.toContain('제20조');
  });

  it('빈 문장이면 아무것도 고르지 않는다', () => {
    expect(selectClauses('', clauses)).toHaveLength(0);
  });

  it('limit 을 넘지 않는다', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...CLAUSE, articleLabel: `제${i}조` }));
    expect(selectClauses('배상책임 손해', many, 12)).toHaveLength(12);
  });
});

describe('buildAnalysisPrompt — 데이터 최소화', () => {
  it('담보명·조항·사고 문장만 들어간다. 이름·금액은 들어가지 않는다', () => {
    const { system, user } = buildAnalysisPrompt('아이가 물건을 파손했어요', [cov()], [CLAUSE]);
    expect(user).toContain('아이가 물건을 파손했어요');
    expect(user).toContain('가족일상생활중배상책임');
    expect(user).toContain('보상하여 드립니다');
    // 개인 식별 정보와 금액은 프롬프트에 없어야 한다.
    expect(user).not.toContain('100000000');
    expect(user).not.toContain('100,000,000');
    expect(system).toContain('금액');
    expect(system).toContain('보험회사의 심사');
  });

  it('조항 본문은 잘라서 보낸다', () => {
    const long = { ...CLAUSE, body: '가'.repeat(3000) };
    const { user } = buildAnalysisPrompt('사고', [cov()], [long]);
    expect(user.length).toBeLessThan(2500);
  });
});

describe('VERDICT_SCHEMA', () => {
  it('필수 필드가 응답 스키마에 강제된다', () => {
    const item = VERDICT_SCHEMA.properties.findings.items;
    expect(item.required).toEqual(['coverageIndex', 'clauseIndex', 'applies', 'quote', 'reason']);
    expect(VERDICT_SCHEMA.required).toEqual(['findings', 'summary']);
  });
});

describe('개인정보처리방침 — AI 위탁 고지', () => {
  it('Gemini 위탁을 고지한다 — 고지 없이 보내면 위탁 고지 위반이다', async () => {
    const { findDoc } = await import('@/lib/legal/documents');
    const privacy = JSON.stringify(findDoc('privacy'));
    expect(privacy).toContain('Google');
    expect(privacy).toContain('Gemini');
    expect(privacy).toContain('버튼을 누르기 전에는 어떤 정보도 전송되지 않습니다');
  });
});

describe('selectClauses — 어휘가 안 겹칠 때의 안전망', () => {
  const clauses: ClauseInput[] = [
    CLAUSE, // 배상책임 — 핵심 조항
    { ...CLAUSE, articleLabel: '제5조', title: '보험금의 지급사유', body: '회사는 다음 사유가 발생한 때 보험금을 지급합니다.' },
    { ...CLAUSE, articleLabel: '제20조', title: '보험료 납입', body: '계약자는 보험료를 납입기일까지 납입하여야 합니다.' },
  ];

  it('겹치는 어휘가 없으면 핵심 조항(보상·지급사유·배상책임)으로 채운다', () => {
    // 「강아지」「물었」은 어느 조항에도 없다 — 그래도 판단의 뼈대는 보낸다.
    const picked = selectClauses('강아지가 이웃을 물었어요', clauses);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.map((c) => c.articleLabel)).toContain('제3조');
    expect(picked.map((c) => c.articleLabel)).toContain('제5조');
    expect(picked.map((c) => c.articleLabel)).not.toContain('제20조');
  });

  it('조항이 아예 없으면 빈 배열 — 지어낼 재료를 주지 않는다', () => {
    expect(selectClauses('강아지가 이웃을 물었어요', [])).toHaveLength(0);
  });
});

describe('selectClauses — 핵심 조항은 폴백이 아니라 상시 동반', () => {
  it('어휘로 몇 건 걸려도 배상책임 조항이 함께 실린다 — 「장난감 부서뜨림」 실사례', () => {
    const clauses: ClauseInput[] = [
      // 어휘가 겹치는 엉뚱한 조항 (사고 문장의 '아들'이 들어 있음)
      { ...CLAUSE, articleLabel: '제12조', title: '계약자 변경', body: '계약자의 아들 등 친족으로 계약자를 변경할 수 있습니다.' },
      // 배상책임 핵심 조항 — 어휘는 안 겹치지만 반드시 실려야 한다
      CLAUSE,
      { ...CLAUSE, articleLabel: '제20조', title: '보험료 납입', body: '계약자는 보험료를 납입기일까지 납입하여야 합니다.' },
    ];
    const picked = selectClauses('우리 아들이 친구의 장난감을 부서뜨렸어요', clauses);
    expect(picked.map((c) => c.articleLabel)).toContain('제3조'); // 배상책임
    expect(picked.map((c) => c.articleLabel)).not.toContain('제20조');
  });

  it('limit 은 여전히 지킨다', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      ...CLAUSE,
      articleLabel: `제${i}조`,
      body: i % 2 === 0 ? '배상책임을 보상합니다' : '아들 관련 어휘 조항',
    }));
    expect(selectClauses('아들이 장난감을 부서뜨렸어요', many, 12).length).toBeLessThanOrEqual(12);
  });
});
