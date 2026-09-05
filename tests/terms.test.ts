import { describe, expect, it } from 'vitest';
import { assessParse, citationOf, parseClauses } from '../src/lib/terms/parse';
import { MIN_SCORE, pickClause, scoreClause } from '../src/lib/terms/match';

/**
 * 약관 파서가 틀리면 인용문이 통째로 엉킨다. 그 인용문이 곧 판단 근거이므로
 * 여기서 깨지면 사용자는 잘못된 근거를 보고 청구를 결정하게 된다.
 */
const SAMPLE = `
가족일상생활배상책임 특별약관

- 3 -

제1조(보험금의 지급사유)
회사는 피보험자가 일상생활 중 우연한 사고로 타인의 신체나 재물에 손해를
입혀 부담하는 법률상 배상책임을 부담함으로써 입은 손해를 보상합니다.

제2조(보상하지 않는 손해)
회사는 다음의 사유로 생긴 손해는 보상하지 않습니다. 피보험자의 고의로
생긴 손해, 직무 수행 중 발생한 배상책임.

12

제3조의2(보험금 청구권의 소멸시효)
보험금 청구권은 3년간 행사하지 아니하면 소멸시효가 완성됩니다.
`;

describe('약관 조항 파서', () => {
  const clauses = parseClauses(SAMPLE);

  it('조 단위로 자른다', () => {
    expect(clauses.map((c) => c.articleLabel)).toEqual(['제1조', '제2조', '제3조의2']);
  });

  it('조 제목을 따로 뽑는다', () => {
    expect(clauses[0].title).toBe('보험금의 지급사유');
    expect(clauses[2].title).toBe('보험금 청구권의 소멸시효');
  });

  it('쪽번호와 머리말 잡음을 본문에 넣지 않는다', () => {
    const bodies = clauses.map((c) => c.body).join(' ');
    expect(bodies).not.toContain('- 3 -');
    expect(bodies).not.toMatch(/(^|\s)12(\s|$)/);
  });

  it('줄바꿈으로 끊긴 문장을 원문으로 되붙인다', () => {
    expect(clauses[0].body).toContain('타인의 신체나 재물에 손해를 입혀 부담하는 법률상 배상책임');
  });

  it('요약하지 않는다 — 본문 길이가 원문 수준으로 남는다', () => {
    expect(clauses[0].body.length).toBeGreaterThan(60);
  });

  it('조항이 없는 문서는 빈 배열이다 — 억지로 만들지 않는다', () => {
    expect(parseClauses('스캔본이라 텍스트가 없습니다')).toEqual([]);
  });
});

describe('사고 유형 ↔ 조항 매칭', () => {
  const clauses = parseClauses(SAMPLE);

  it('지급사유 조항을 배상책임 근거로 고른다', () => {
    const best = pickClause('liability-damage', clauses);
    expect(best?.clause.articleLabel).toBe('제1조');
  });

  it('면책 조항은 근거로 고르지 않는다 — 반대 의미의 조항을 근거랍시고 보여주면 안 된다', () => {
    const exclusion = clauses.find((c) => c.articleLabel === '제2조')!;
    expect(scoreClause('liability-damage', exclusion)).toBeLessThan(MIN_SCORE);
  });

  it('맞는 조항이 없으면 아무것도 고르지 않는다', () => {
    expect(pickClause('car', clauses)).toBeNull();
    expect(pickClause('outpatient', clauses)).toBeNull();
  });

  it('표제에 핵심어가 있으면 더 높게 본다', () => {
    const titled = { title: '골절진단비', body: '상해의 직접결과로써 골절 상태가 되었을 때 지급합니다.' };
    const buried = { title: null, body: '기타 사고로 골절이 생긴 경우를 포함합니다.' };
    expect(scoreClause('injury-fracture', titled)).toBeGreaterThan(
      scoreClause('injury-fracture', buried),
    );
  });
});

describe('출처 표기', () => {
  it('보험사·상품·조항을 한 줄로 만든다 — 출처 없는 인용은 주장이다', () => {
    expect(
      citationOf({
        insurerName: 'DB손해보험',
        productName: '내생애든든종합보험',
        title: '약관.pdf',
        articleLabel: '제1조',
        clauseTitle: '보험금의 지급사유',
      }),
    ).toBe('DB손해보험 내생애든든종합보험 · 제1조(보험금의 지급사유)');
  });

  it('보험사를 모르면 문서 제목으로 대신한다', () => {
    expect(citationOf({ title: '약관.pdf', articleLabel: '제3조' })).toBe('약관.pdf · 제3조');
  });
});

describe('옛 손보 표기 「N. (제목)」 — 내생애든든 1404 실사례', () => {
  // 이 약관은 제N조 표기가 없어 1,066개 조항 중 15개만 잡혔고,
  // 그 15개마저 의료법 인용이었다.
  const OLD_STYLE = [
    '1. (목적)',
    '이 보험계약(이하 ‘계약’이라 합니다)은 보험계약자와 보험회사 사이에 맺어집니다.',
    '2. (용어의 정의)',
    '이 계약에서 사용되는 용어의 정의는 다음과 같습니다.',
    '3. (보험금의 지급사유) ····························· 12',
    '5. (보험금을 지급하지 않는 사유)',
    '회사는 다음 중 어느 한 가지의 경우에는 보험금을 지급하지 않습니다.',
  ].join('\n');

  it('점 표기 조항을 잡는다', () => {
    const clauses = parseClauses(OLD_STYLE);
    expect(clauses.map((c) => c.articleLabel)).toEqual(['1.', '2.', '5.']);
    expect(clauses[0].title).toBe('목적');
    expect(clauses[2].title).toBe('보험금을 지급하지 않는 사유');
  });

  it('목차의 점선 리더 줄은 조항이 아니다', () => {
    const clauses = parseClauses(OLD_STYLE);
    expect(clauses.map((c) => c.title)).not.toContain('보험금의 지급사유');
  });

  it('법령 인용 「제3조(의료기관)에 규정한」 은 조항 머리가 아니다', () => {
    const text = [
      '1. (보험금의 지급사유)',
      '제3자는 의료법',
      '제3조(의료기관)에 규정한 종합병원 소속 전문의 중에 정하며, 보험금',
      '지급사유 판정에 드는 비용은 회사가 부담합니다.',
    ].join('\n');
    const clauses = parseClauses(text);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].body).toContain('의료기관');
  });

  it('진짜 제N조 머리는 여전히 잡힌다 — 가정보장보험 형식 회귀 방지', () => {
    const text = ['제3조(보험금의 지급사유)', '회사는 다음의 경우 보험금을 지급합니다.'].join('\n');
    const clauses = parseClauses(text);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].articleLabel).toBe('제3조');
  });

  it('괄호 없는 「1. 전자서명이라 함은」 나열 항목은 조항으로 쪼개지 않는다', () => {
    const text = [
      '2. (용어의 정의)',
      '1. 전자서명이라 함은 서명자를 확인하는 정보를 말합니다.',
      '2. 전자문서라 함은 정보처리시스템에 의하여 작성된 정보를 말합니다.',
    ].join('\n');
    const clauses = parseClauses(text);
    expect(clauses).toHaveLength(1);
  });
});

describe('assessParse — 파싱 품질 자가 진단', () => {
  const LONG = '가'.repeat(60_000);

  it('정상 밀도의 약관은 의심하지 않는다', () => {
    const clauses = parseClauses(
      Array.from({ length: 20 }, (_, i) => `제${i + 1}조(제목${i})\n회사는 다음의 경우 보험금을 지급합니다. ${'내용'.repeat(30)}`).join('\n'),
    );
    const text = clauses.map((c) => c.body).join('\n');
    const q = assessParse(text, clauses);
    expect(q.suspicious).toBe(false);
  });

  it('60만 자에 조항 15개 — 내생애든든 사고를 의심으로 잡는다', () => {
    const clauses = parseClauses('제3조(의료기관)\n에 규정한 병원');
    const q = assessParse(LONG, clauses);
    expect(q.suspicious).toBe(true);
    expect(q.reason).toContain('밀도');
  });

  it('조항은 많은데 본문 대부분이 조항 밖이면 유실을 의심한다', () => {
    const clauses = parseClauses(
      Array.from({ length: 30 }, (_, i) => `제${i + 1}조(제목)\n짧은 본문`).join('\n'),
    );
    const q = assessParse(LONG, clauses);
    expect(q.suspicious).toBe(true);
  });

  it('조항 0건도 의심이다', () => {
    expect(assessParse('아무 조항도 없는 텍스트', []).suspicious).toBe(true);
  });
});

describe('자동차 인용 갈래 — car-property / car-person', () => {
  const propertyClause = {
    title: '대물배상',
    body: '피보험자가 피보험자동차의 사고로 다른 사람의 재물을 없애거나 훼손하여 법률상 손해배상책임을 짐으로써 입은 손해를 보상합니다.',
  };
  const personClause = {
    title: '자기신체사고',
    body: '피보험자가 피보험자동차의 사고로 인하여 죽거나 다친 때 그로 인한 손해를 보상합니다. 상해 또는 사망 시 보험금을 지급합니다.',
  };

  it('물적 갈래는 대물배상 조항을 고른다', () => {
    const best = pickClause('car-property', [propertyClause, personClause]);
    expect(best?.clause.title).toBe('대물배상');
  });

  it('인명 갈래는 자기신체사고 조항을 고른다', () => {
    const best = pickClause('car-person', [propertyClause, personClause]);
    expect(best?.clause.title).toBe('자기신체사고');
  });

  it('갈래에 맞는 조항이 없으면 고르지 않는다 — 엉뚱한 인용 금지', () => {
    expect(pickClause('car-property', [personClause])).toBeNull();
  });
});
