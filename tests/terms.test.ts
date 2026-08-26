import { describe, expect, it } from 'vitest';
import { citationOf, parseClauses } from '../src/lib/terms/parse';
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
