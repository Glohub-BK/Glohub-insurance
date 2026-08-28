import { INCIDENT_RULES } from './incident-match';

/**
 * 사고 문장 해석기 — AI 를 규칙 **뒤**가 아니라 **앞**에 세운다.
 *
 * "부서뜨렸어요 / 깨뜨렸어요 / 박살냈어요" 가 다르게 동작하던 원인은, 사용자의 말과
 * 약관의 말 사이 번역을 키워드 목록에 맡긴 데 있다. 키워드는 보강해도 끝이 없다.
 * 그래서 모든 질의를 먼저 LLM 이 약관 어휘로 정규화한다 — 어떻게 적든 같은 사고유형과
 * 같은 검색어로 수렴한다.
 *
 * LLM 의 권한은 **분류와 재서술뿐**이다. 담보 선별·금액·인용은 그 뒤의 결정적 코드가
 * 한다. 여기서도 출력은 검증을 통과해야만 쓰인다 — 모르는 사고유형은 'other' 로 떨어진다.
 */

export const INCIDENT_TYPE_IDS = [...INCIDENT_RULES.map((r) => r.id), 'other'] as const;

export const INTERPRET_SCHEMA = {
  type: 'object',
  properties: {
    incidentType: { type: 'string', enum: INCIDENT_TYPE_IDS as unknown as string[] },
    normalizedQuery: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
  },
  required: ['incidentType', 'normalizedQuery', 'keywords'],
} as const;

export type Interpretation = {
  /** 우리 규칙의 id, 또는 어느 규칙에도 안 맞으면 null */
  ruleId: string | null;
  /** 약관 어휘로 재서술한 문장 — 조항 검색이 이걸 쓴다 */
  normalizedQuery: string;
  keywords: string[];
};

export function buildInterpretPrompt(text: string): { system: string; user: string } {
  const catalog = INCIDENT_RULES.map((r) => `- ${r.id}: ${r.label}`).join('\n');
  const system = [
    '너는 한국 보험 사고 접수 분류 도구다. 사용자가 겪은 일을 읽고 다음을 반환한다.',
    '1. incidentType: 아래 사고유형 중 정확히 하나. 어디에도 해당하지 않으면 "other".',
    catalog,
    '2. normalizedQuery: 사고를 보험 약관에서 쓰는 표현으로 한 문장 재서술. 예: "아들이 친구 장난감을 부서뜨렸어요" → "피보험자의 자녀가 타인의 재물을 파손하여 법률상 배상책임이 발생함".',
    '3. keywords: 약관 조항 검색에 쓸 보험 용어 3~8개. 예: ["배상책임", "재물", "파손", "일상생활"].',
    '판단만 한다 — 보상 여부·금액은 말하지 않는다. 이름 등 개인 식별 정보는 normalizedQuery 에 옮기지 않는다.',
  ].join('\n');
  return { system, user: `사고 상황: ${text}` };
}

/** LLM 출력(unknown)을 검증한다. 조금이라도 어긋나면 null — 폴백(키워드 규칙)이 있다. */
export function validateInterpretation(raw: unknown): Interpretation | null {
  const r = raw as { incidentType?: unknown; normalizedQuery?: unknown; keywords?: unknown } | null;
  if (!r || typeof r !== 'object') return null;

  const type = typeof r.incidentType === 'string' ? r.incidentType : '';
  if (!(INCIDENT_TYPE_IDS as readonly string[]).includes(type)) return null;

  const normalized = typeof r.normalizedQuery === 'string' ? r.normalizedQuery.trim().slice(0, 300) : '';
  if (normalized.length < 5) return null;

  const keywords = Array.isArray(r.keywords)
    ? r.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim().slice(0, 30)).slice(0, 8)
    : [];

  return { ruleId: type === 'other' ? null : type, normalizedQuery: normalized, keywords };
}
