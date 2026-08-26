import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractPdfText } from '../src/lib/terms/pdf';
import { parseClauses } from '../src/lib/terms/parse';

/**
 * 약관은 대부분 PDF 로 온다. 텍스트 추출이 깨지면 그 뒤 파이프라인 전체가 무의미하다.
 * 픽스처는 실제 약관이 아니라 같은 구조로 만든 시험용 PDF 다.
 */
describe('PDF 텍스트 추출', () => {
  const bytes = new Uint8Array(readFileSync('tests/fixtures/sample-terms.pdf'));

  it('한글이 깨지지 않는다', async () => {
    const text = await extractPdfText(bytes);
    expect(text).toContain('법률상 배상책임');
  });

  it('추출한 텍스트에서 조항이 그대로 잘린다 — 외부 도구 없이', async () => {
    const clauses = parseClauses(await extractPdfText(bytes));
    expect(clauses.map((c) => c.articleLabel)).toEqual(['제1조', '제2조', '제3조']);
    expect(clauses[0].title).toBe('보험금의 지급사유');
  });

  it('PDF 가 아닌 데이터는 오류로 끝난다 — 조용히 빈 문자열을 돌려주지 않는다', async () => {
    await expect(extractPdfText(new TextEncoder().encode('그냥 텍스트'))).rejects.toThrow();
  });
});
