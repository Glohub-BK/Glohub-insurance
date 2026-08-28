/**
 * Gemini 호출 어댑터. 서버에서만 쓴다 — 키가 있는 곳은 여기뿐이다.
 *
 * SDK 를 들이지 않고 REST 로 간다. 의존성 하나가 덜 깨지고, 요청·응답이 눈에 보인다.
 * 제공사를 바꾸고 싶으면 이 파일과 같은 시그니처의 어댑터를 하나 더 만들면 된다 —
 * 도메인 계층(ai-verdict)은 어느 LLM 인지 모른다.
 *
 * ⚠ 이 파일은 어떤 경우에도 키·프롬프트 내용을 로그에 남기지 않는다.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// 2.5-flash 는 문서상 지원이지만 신규 발급 키에서 404 가 보고된다.
// 안정 최신 세대의 flash 를 기본으로 쓰고, 필요하면 GEMINI_MODEL 로 바꾼다.
const DEFAULT_MODEL = 'gemini-3.5-flash';

export class LlmError extends Error {
  constructor(
    /** 'not-configured' | 'http' | 'blocked' | 'empty' | 'bad-json' */
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function llmModelName(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/**
 * system+user 프롬프트로 JSON 한 개를 받아온다.
 * responseSchema 로 형태를 강제하지만, 반환값 검증은 호출자(검증 게이트)의 일이다.
 */
export async function generateJson(input: {
  system: string;
  user: string;
  schema: object;
}): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LlmError('not-configured', 'GEMINI_API_KEY 가 설정되지 않았습니다.');

  const model = llmModelName();
  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: [{ text: input.user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: input.schema,
        temperature: 0.2, // 창의성이 아니라 판정이 필요하다
        // 3.x flash 는 thinking 모델이다 — 생각 토큰이 이 한도를 같이 쓴다.
        // 2048 로 뒀더니 생각이 한도를 먼저 먹고 JSON 이 잘린 채 왔다 (bad-json ×4).
        maxOutputTokens: 16384,
      },
    }),
    // 약관 분석은 오래 걸릴 이유가 없다. 오래 걸리면 뭔가 잘못된 것이다.
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    // 오류 본문의 message 는 원인 특정에 필수다 (모델 폐기 404, 스키마 400, 키 403).
    // 키는 요청 헤더에만 있고 응답 본문에 비치지 않는다.
    const detail = await res
      .text()
      .then((t) => {
        try {
          const parsed = JSON.parse(t) as { error?: { message?: string } };
          return parsed.error?.message ?? '';
        } catch {
          return '';
        }
      })
      .catch(() => '');
    throw new LlmError('http', `LLM 호출 실패 (HTTP ${res.status}) model=${model} ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new LlmError('blocked', `요청이 차단되었습니다: ${data.promptFeedback.blockReason}`);
  }
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (text.trim().length === 0) {
    throw new LlmError('empty', `LLM 이 빈 응답을 반환했습니다 (finish=${candidate?.finishReason ?? '?'})`);
  }
  const parsed = extractJsonPayload(text);
  if (parsed === null) {
    // 내용은 로그에 싣지 않는다 — 원인 특정에는 finishReason 과 길이면 충분하다.
    throw new LlmError(
      'bad-json',
      `LLM 응답이 JSON 이 아닙니다 (finish=${candidate?.finishReason ?? '?'}, len=${text.length})`,
    );
  }
  return parsed;
}

/**
 * 모델 출력에서 JSON 을 건져낸다.
 *
 * responseMimeType 을 지정해도 일부 응답은 \`\`\`json 펜스를 씌우거나 앞뒤에 말이 붙는다.
 * 첫 '{' 부터 마지막 '}' 까지를 한 번 더 시도한다 — 잘린 JSON 은 여기서도 실패하며,
 * 그때는 호출자가 bad-json 으로 원인을 로그에 남긴다.
 */
export function extractJsonPayload(text: string): unknown | null {
  const stripped = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  for (const candidate of [stripped, text]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // 다음 후보
    }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}
