/**
 * 담보명 원문을 보장 맵의 카테고리로 분류한다.
 *
 * 규칙 기반으로 먼저 처리하고, 확신이 낮은 건만 나중에 LLM/사람이 확정한다.
 * DB 의 coverage.classified_by 가 그 출처를 구분한다.
 *
 * 규칙 순서가 곧 우선순위다. "상해입원의료비"는 입원이 아니라 실손이므로
 * actual_loss 규칙이 hospital 보다 먼저 온다.
 */

export const COVERAGE_CATEGORIES = [
  'death',
  'diagnosis',
  'hospital',
  'surgery',
  'actual_loss',
  'liability',
  'fire',
  'driver',
  'disability',
  'care',
  'savings',
  'other',
] as const;

export type CoverageCategory = (typeof COVERAGE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CoverageCategory, string> = {
  death: '사망',
  diagnosis: '진단',
  hospital: '입원',
  surgery: '수술',
  actual_loss: '실손의료비',
  liability: '배상책임',
  fire: '화재·재물',
  driver: '운전자·자동차',
  disability: '후유장해',
  care: '간병·요양',
  savings: '저축·연금',
  other: '기타',
};

/** 보장 맵 정렬 순서. DB 의 coverage_category.sort_order 시드와 같은 값이어야 한다. */
export const CATEGORY_SORT: Record<CoverageCategory, number> = {
  death: 10,
  diagnosis: 20,
  hospital: 30,
  surgery: 40,
  actual_loss: 50,
  liability: 60,
  fire: 70,
  driver: 80,
  disability: 90,
  care: 100,
  savings: 110,
  other: 999,
};

type Rule = {
  category: CoverageCategory;
  /** 하나라도 포함되면 매칭 */
  keywords: string[];
  /** 포함되면 이 규칙을 건너뛴다 */
  exclude?: string[];
  confidence: number;
};

/** 위에서부터 순서대로 평가한다. 앞선 규칙이 이긴다. */
const RULES: Rule[] = [
  {
    category: 'actual_loss',
    keywords: ['실손', '실비', '의료비', '통원의료비', '입원의료비', '비급여', '급여의료비'],
    confidence: 0.95,
  },
  {
    category: 'liability',
    keywords: ['배상책임', '배상', '일상생활중배상', '가족일상생활', '자녀배상', '임차자배상', '누수'],
    exclude: ['자동차손해배상'],
    confidence: 0.95,
  },
  {
    category: 'driver',
    keywords: ['운전자', '교통사고처리', '변호사선임', '벌금', '자동차사고', '자동차손해배상', '자기차량', '대인배상', '대물배상'],
    confidence: 0.9,
  },
  {
    category: 'fire',
    keywords: ['화재', '재물', '가재도구', '건물', '풍수재', '도난', '폭발', '붕괴'],
    confidence: 0.9,
  },
  {
    category: 'diagnosis',
    // 키워드는 구체적인 것부터 둔다. matchedKeyword 가 검수에 쓸모 있으려면
    // "암진단비"가 '진단'이 아니라 '암진단'으로 걸려야 한다.
    keywords: ['암진단', '뇌졸중', '뇌출혈', '뇌혈관', '급성심근경색', '허혈성심장', '2대질환', '3대질환', '표적항암', '진단'],
    confidence: 0.9,
  },
  {
    category: 'surgery',
    keywords: ['수술'],
    confidence: 0.9,
  },
  {
    category: 'hospital',
    keywords: ['입원', '통원', '일당'],
    confidence: 0.85,
  },
  {
    category: 'disability',
    keywords: ['후유장해', '장해', '장애'],
    confidence: 0.9,
  },
  {
    category: 'care',
    keywords: ['간병', '요양', '장기요양', '치매', '중증치매', '재가급여', '시설급여'],
    confidence: 0.9,
  },
  {
    category: 'death',
    keywords: ['사망', '유족', '상해사망', '질병사망', '재해사망'],
    confidence: 0.9,
  },
  {
    category: 'savings',
    keywords: ['연금', '적립', '만기환급', '저축', '중도인출', '학자금'],
    confidence: 0.85,
  },
];

export type Classification = {
  category: CoverageCategory;
  confidence: number;
  /** 어떤 키워드로 걸렸는지 — 디버깅과 사람 검수를 위해 남긴다. */
  matchedKeyword: string | null;
};

/** 공백·괄호·특수문자를 걷어내 키워드 매칭 정확도를 올린다. */
function normalizeName(name: string): string {
  return name.replace(/[\s()[\]{}<>,./\\|_·ㆍ~'"-]/g, '');
}

export function classifyCoverage(rawName: string): Classification {
  const name = normalizeName(rawName ?? '');
  if (name.length === 0) {
    return { category: 'other', confidence: 0, matchedKeyword: null };
  }

  for (const rule of RULES) {
    if (rule.exclude?.some((word) => name.includes(normalizeName(word)))) continue;
    const hit = rule.keywords.find((word) => name.includes(normalizeName(word)));
    if (hit) {
      return { category: rule.category, confidence: rule.confidence, matchedKeyword: hit };
    }
  }

  return { category: 'other', confidence: 0.3, matchedKeyword: null };
}

/** 신뢰도가 이 값 아래면 사람 검수 대상으로 표시한다. */
export const REVIEW_THRESHOLD = 0.85;

export function needsReview(c: Classification): boolean {
  return c.confidence < REVIEW_THRESHOLD;
}
