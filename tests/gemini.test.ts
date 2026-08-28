import { describe, expect, it } from 'vitest';
import { extractJsonPayload } from '@/lib/llm/gemini';

describe('extractJsonPayload — 모델 출력에서 JSON 건지기', () => {
  it('깨끗한 JSON 은 그대로', () => {
    expect(extractJsonPayload('{"a":1}')).toEqual({ a: 1 });
  });

  it('마크다운 펜스를 벗긴다', () => {
    expect(extractJsonPayload('```json\n{"findings":[]}\n```')).toEqual({ findings: [] });
  });

  it('앞뒤에 말이 붙어도 중괄호 구간을 건진다', () => {
    expect(extractJsonPayload('다음은 결과입니다: {"ok":true} 감사합니다')).toEqual({ ok: true });
  });

  it('잘린 JSON 은 null — 조용히 절반만 믿는 것보다 실패가 낫다', () => {
    expect(extractJsonPayload('{"findings":[{"coverageIndex":0,"qu')).toBeNull();
  });

  it('빈 문자열은 null', () => {
    expect(extractJsonPayload('')).toBeNull();
  });
});
