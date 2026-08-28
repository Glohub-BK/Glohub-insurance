import type { CoverageCandidate } from './incident-match';

/**
 * LLM 약관 분석의 **검증 게이트**.
 *
 * 규칙이 못 잡은 사고 문장은 LLM 에게 넘어간다. 그러나 LLM 의 말은 그대로 화면에
 * 올리지 않는다 — 프롬프트는 환각을 줄일 뿐 못 막는다. 막는 것은 이 파일이다.
 *
 *   - LLM 은 담보·조항을 **번호로만** 가리킨다. 우리가 보낸 목록의 인덱스가 아니면 버린다.
 *   - 인용문(quote)은 조항 원문의 실제 부분 문자열이어야 한다. 지어낸 인용은 여기서 죽는다.
 *   - 금액은 LLM 출력을 아예 받지 않는다. 화면은 DB 값만 쓴다.
 *   - "판단 불가"는 정상 출력이다. 억지로 찾아내는 것보다 낫다.
 *
 * 이 파일은 네트워크를 모른다 — 전부 순수 함수라 테스트가 LLM 없이 돈다.
 */

/** LLM 에 보내는 조항 한 개. 인덱스가 곧 참조 번호다. */
export type ClauseInput = {
  articleLabel: string;
  title: string | null;
  body: string;
  source: string; // 예: '삼성화재 · 무배당삼성화재건강보험'
};

/** LLM 이 반환해야 하는 JSON 의 형태. Gemini responseSchema 로도 강제한다. */
export const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          coverageIndex: { type: 'integer' },
          clauseIndex: { type: 'integer' },
          applies: { type: 'string', enum: ['likely', 'maybe'] },
          quote: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['coverageIndex', 'clauseIndex', 'applies', 'quote', 'reason'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['findings', 'summary'],
} as const;

export type AiFinding = {
  coverage: CoverageCandidate;
  clause: ClauseInput;
  applies: 'likely' | 'maybe';
  /** 조항 원문 대조를 통과한 인용문 */
  quote: string;
  reason: string;
};

export type AiVerdict = {
  findings: AiFinding[];
  summary: string;
  /** 게이트가 버린 항목 수. 0이 아니면 화면이 아니라 로그가 본다. */
  dropped: number;
};

/** 공백·줄바꿈 차이는 인용 대조에서 무시한다. PDF 추출 텍스트는 공백이 지저분하다. */
function squash(text: string): string {
  return text.replace(/\s+/g, '');
}

export function quoteAppearsIn(quote: string, body: string): boolean {
  const q = squash(quote);
  if (q.length < 10) return false; // 너무 짧은 인용은 근거가 아니다
  return squash(body).includes(q);
}

/** LLM 출력(unknown)을 검증해 통과분만 돌려준다. 실패는 조용히 버리고 개수만 센다. */
export function validateVerdict(
  raw: unknown,
  coverages: CoverageCandidate[],
  clauses: ClauseInput[],
): AiVerdict {
  const out: AiFinding[] = [];
  let dropped = 0;

  const root = raw as { findings?: unknown; summary?: unknown } | null;
  const list = Array.isArray(root?.findings) ? root.findings : [];
  const summary = typeof root?.summary === 'string' ? root.summary.slice(0, 500) : '';

  for (const item of list) {
    if (item === null || typeof item !== 'object') {
      dropped += 1;
      continue;
    }
    const f = item as {
      coverageIndex?: unknown;
      clauseIndex?: unknown;
      applies?: unknown;
      quote?: unknown;
      reason?: unknown;
    };
    const ci = f.coverageIndex;
    const li = f.clauseIndex;
    const coverage =
      typeof ci === 'number' && Number.isInteger(ci) && ci >= 0 && ci < coverages.length
        ? coverages[ci]
        : null;
    const clause =
      typeof li === 'number' && Number.isInteger(li) && li >= 0 && li < clauses.length
        ? clauses[li]
        : null;
    const applies = f.applies === 'likely' || f.applies === 'maybe' ? f.applies : null;
    const quote = typeof f.quote === 'string' ? f.quote.trim() : '';
    const reason = typeof f.reason === 'string' ? f.reason.trim().slice(0, 300) : '';

    if (!coverage || !clause || !applies || reason.length === 0 || !quoteAppearsIn(quote, clause.body)) {
      dropped += 1;
      continue;
    }
    out.push({ coverage, clause, applies, quote, reason });
  }

  // 같은 담보에 여러 판정이 오면 첫 번째(가장 확신하는 것)만 남긴다.
  const seen = new Set<string>();
  const deduped = out.filter((f) => {
    const key = `${f.coverage.policyId}|${squash(f.coverage.name)}`;
    if (seen.has(key)) {
      dropped += 1;
      return false;
    }
    seen.add(key);
    return true;
  });

  return { findings: deduped, summary, dropped };
}

/**
 * 사고 문장과 관련 있어 보이는 조항을 고른다 — 어휘 겹침 점수.
 *
 * LLM 에 약관 전체를 보내지 않기 위한 1차 검색이다. 임베딩 검색은 조항이 수천 개
 * 규모가 되면 붙인다. 지금 규모(가구당 수백 조항)에서는 어휘 겹침으로 충분하고,
 * 결과가 왜 뽑혔는지 설명 가능하다.
 */
export function selectClauses(text: string, clauses: ClauseInput[], limit = 12): ClauseInput[] {
  const tokens = Array.from(
    new Set(
      text
        .split(/[^가-힣a-zA-Z0-9]+/)
        .flatMap((t) => {
          // 조사가 붙은 형태를 위해 2글자 접두어도 함께 본다: '파손을' → '파손을', '파손'
          if (t.length >= 3) return [t, t.slice(0, 2)];
          return [t];
        })
        .filter((t) => t.length >= 2),
    ),
  );
  if (tokens.length === 0) return [];

  const scored = clauses
    .map((c) => {
      const hay = `${c.title ?? ''} ${c.body}`;
      let score = 0;
      for (const t of tokens) if (hay.includes(t)) score += 1;
      // 면책 조항도 근거로 필요하다 — 보상하지 않는 경우를 알려주는 것도 이 앱의 일이다.
      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // 어휘 겹침 상위 + 핵심 조항을 **항상 함께** 보낸다.
  //
  // 처음엔 핵심 조항을 "겹침이 0일 때의 폴백"으로만 썼다. 그러자 「아들이 친구
  // 장난감을 부서뜨렸어요」에서 어휘로 7건이 걸리는 바람에 폴백이 안 열렸고,
  // 그 7건에 배상책임 조항이 없어 AI 가 "근거 조항이 없다"고 정확하게(!) 판정했다.
  // 사고 어휘와 약관 어휘는 원래 잘 안 겹친다 — 판단의 뼈대는 항상 실어야 한다.
  const lexical = scored.slice(0, Math.max(4, limit - 8)).map((s) => s.c);
  const picked = new Set(lexical);
  const core = clauses
    .filter((c) => !picked.has(c))
    .map((c) => {
      const head = `${c.title ?? ''} ${c.body.slice(0, 80)}`;
      // 배상책임 조항을 앞세운다 — 일상 사고 질의의 대부분이 여기로 귀결된다.
      const w = /배상책임/.test(head) ? 2 : CORE_CLAUSE.test(head) ? 1 : 0;
      return { c, w };
    })
    .filter((s) => s.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, Math.max(0, limit - lexical.length))
    .map((s) => s.c);

  return [...lexical, ...core];
}

/** 담보의 뼈대 조항 — 보상하는 손해·보험금 지급사유·면책. */
const CORE_CLAUSE = /보상하는\s*손해|지급사유|보상하지\s*아니|보상하지\s*않|배상책임/;

const MAX_CLAUSE_CHARS = 700;

/** LLM 에 보낼 프롬프트. 데이터 최소화 — 사고 문장, 담보명, 조항 텍스트만 들어간다. */
export function buildAnalysisPrompt(
  text: string,
  coverages: CoverageCandidate[],
  clauses: ClauseInput[],
): { system: string; user: string } {
  const system = [
    '너는 한국 보험 약관 분석 보조 도구다. 다음 규칙을 반드시 지킨다.',
    '1. 아래에 번호로 제시된 담보 목록과 약관 조항만 근거로 판단한다. 목록 밖의 지식으로 담보를 지어내지 않는다.',
    '2. quote 에는 해당 조항 원문에서 그대로 복사한 문장만 넣는다. 요약하거나 바꿔 쓰지 않는다.',
    '3. 확실히 해당하면 applies="likely", 조건부·불확실하면 "maybe". 해당하는 담보가 없으면 findings 를 빈 배열로 두고 summary 에 그 이유를 적는다.',
    '4. 보험금 금액은 절대 언급하지 않는다. 지급 여부를 확정하지 않는다 — 최종 판단은 보험회사의 심사다.',
    '5. reason 은 두 문장 이내의 한국어로 쓴다.',
  ].join('\n');

  const coverageList = coverages
    .map((c, i) => `[담보 ${i}] ${c.name} (분류: ${c.category})`)
    .join('\n');
  const clauseList = clauses
    .map(
      (c, i) =>
        `[조항 ${i}] ${c.source} ${c.articleLabel}${c.title ? ` ${c.title}` : ''}\n${c.body.slice(0, MAX_CLAUSE_CHARS)}`,
    )
    .join('\n\n');

  const user = [
    `사고 상황: ${text}`,
    '',
    '보유 담보 목록:',
    coverageList,
    '',
    '약관 조항:',
    clauseList,
  ].join('\n');

  return { system, user };
}
