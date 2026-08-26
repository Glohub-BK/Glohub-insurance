/**
 * 약관 텍스트를 조항 단위로 자른다.
 *
 * 약관 PDF 를 텍스트로 뽑으면 쪽번호·머리말·줄바꿈이 본문에 섞여 들어온다.
 * 그대로 저장하면 인용문에 "- 12 -" 같은 것이 끼고, 판단 근거로 보여줄 수 없다.
 *
 * 요약하지 않는다. 요약하면 인용이 아니라 우리 해석이 되고, 그 순간 약관이 아니라
 * 우리가 보험금 지급 요건을 말한 것이 된다.
 */

export type Clause = {
  ord: number;
  articleNo: number | null;
  articleLabel: string;
  title: string | null;
  body: string;
};

/** '제 12 조', '제12조의2' 모두 잡는다. 줄 맨 앞에 있어야 조항 시작으로 본다. */
const ARTICLE = /^제\s*(\d+)\s*조(?:\s*의\s*(\d+))?\s*(?:[(（]([^)）]*)[)）])?/;

const NOISE = [
  /^[-–—]\s*\d+\s*[-–—]$/, // - 12 -
  /^\d{1,3}$/, // 쪽번호만 있는 줄
  /^\s*$/,
];

function isNoise(line: string): boolean {
  return NOISE.some((re) => re.test(line.trim()));
}

/** 줄바꿈으로 끊긴 문장을 다시 붙인다. 한국어는 공백 없이 이어야 원문이 된다. */
function joinLines(lines: string[]): string {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    // PDF 는 '3년간' 을 '3 년간' 으로 쪼개 내놓는 일이 잦다. 조판이 만든 공백일 뿐이라
    // 숫자와 한글 단위 사이만 되붙인다. 그 밖의 글자는 손대지 않는다.
    .replace(/(\d)\s+([년월일개회조항호])/g, '$1$2')
    .trim();
}

export function parseClauses(raw: string): Clause[] {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').filter((l) => !isNoise(l));

  const clauses: Clause[] = [];
  let current: { label: string; no: number | null; title: string | null; lines: string[] } | null =
    null;

  const flush = () => {
    if (!current) return;
    const body = joinLines(current.lines);
    if (body.length === 0) return;
    clauses.push({
      ord: clauses.length + 1,
      articleNo: current.no,
      articleLabel: current.label,
      title: current.title,
      body,
    });
  };

  for (const line of lines) {
    const m = line.trim().match(ARTICLE);
    if (m) {
      flush();
      const no = Number(m[1]);
      const sub = m[2] ? `의${m[2]}` : '';
      current = {
        label: `제${no}조${sub}`,
        no: Number.isFinite(no) ? no : null,
        title: m[3]?.trim() || null,
        // 표제를 뗀 나머지가 본문 첫 줄이다.
        lines: [line.trim().replace(ARTICLE, '').trim()],
      };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  return clauses;
}

/** 사람이 읽을 출처 한 줄. 어느 문서 몇 조인지 없으면 인용이 아니라 주장이 된다. */
export function citationOf(source: {
  insurerName?: string | null;
  productName?: string | null;
  title: string;
  articleLabel: string;
  clauseTitle?: string | null;
}): string {
  const who = [source.insurerName, source.productName].filter(Boolean).join(' ');
  const where = source.clauseTitle
    ? `${source.articleLabel}(${source.clauseTitle})`
    : source.articleLabel;
  return [who || source.title, where].join(' · ');
}
