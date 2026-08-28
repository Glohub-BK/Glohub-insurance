import { NextResponse } from 'next/server';
import { buildInterpretPrompt, INTERPRET_SCHEMA, validateInterpretation } from '@/lib/domain/ai-interpret';
import { generateJson, isLlmConfigured, LlmError } from '@/lib/llm/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * 사고 문장 → 사고유형 + 약관 어휘 정규화.
 *
 * 화면은 사용자가 AI 해석에 **최초 1회 동의한 뒤에만** 이 라우트를 부른다.
 * 실패는 조용히 200 + null 로 돌려준다 — 화면이 키워드 규칙으로 폴백하면 되고,
 * 해석기 장애가 검색 자체를 죽여서는 안 된다.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 300) : '';
  if (text.length < 5 || !isLlmConfigured()) {
    return NextResponse.json({ interpretation: null });
  }

  try {
    const prompt = buildInterpretPrompt(text);
    const raw = await generateJson({ ...prompt, schema: INTERPRET_SCHEMA });
    const interpretation = validateInterpretation(raw);
    if (!interpretation) console.warn('[ai-interpret] 검증 실패 — 키워드 폴백');
    return NextResponse.json({ interpretation });
  } catch (err) {
    if (err instanceof LlmError) {
      console.warn(`[ai-interpret] LLM 오류 code=${err.code} — 키워드 폴백`);
      return NextResponse.json({ interpretation: null });
    }
    throw err;
  }
}
