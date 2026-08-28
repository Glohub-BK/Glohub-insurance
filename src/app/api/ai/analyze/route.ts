import { NextResponse } from 'next/server';
import { getCurrentHousehold } from '@/lib/repo/household';
import { getCoverageCandidates } from '@/lib/repo/dashboard';
import { listHouseholdClauses } from '@/lib/repo/terms';
import {
  buildAnalysisPrompt,
  selectClauses,
  validateVerdict,
  VERDICT_SCHEMA,
  type ClauseInput,
} from '@/lib/domain/ai-verdict';
import { generateJson, isLlmConfigured, LlmError } from '@/lib/llm/gemini';

/**
 * 규칙이 못 잡은 사고 문장을 LLM + 내 약관 조항으로 분석한다.
 *
 * 호출되는 조건은 화면이 정한다 — 규칙 매칭이 실패했고, 사용자가 버튼을 눌렀을 때만.
 * 자동으로 부르지 않는 이유: 사고 문장에는 건강정보가 들어갈 수 있고, 외부 LLM 으로
 * 보내는 것은 사용자가 눈으로 보고 눌러서 시작해야 한다.
 *
 * 보내는 것: 사고 문장, 담보명, 약관 조항 텍스트.
 * 보내지 않는 것: 이름, 생년, 증권번호, 금액. (금액은 표시도 DB 값만 쓴다)
 */

const MAX_TEXT = 300;
const MAX_COVERAGES = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
  if (text.length < 5) {
    return NextResponse.json({ error: '사고 상황을 조금 더 적어주세요.' }, { status: 400 });
  }
  if (!isLlmConfigured()) {
    return NextResponse.json(
      { error: 'AI 분석이 아직 설정되지 않았습니다.' },
      { status: 503 },
    );
  }

  const household = await getCurrentHousehold().catch(() => null);
  if (!household) {
    return NextResponse.json({ error: '연결된 보험 정보가 없습니다.' }, { status: 404 });
  }

  const [rows, clauseRows] = await Promise.all([
    getCoverageCandidates(household.id),
    listHouseholdClauses(household.id),
  ]);

  // 해지·소멸 담보는 애초에 후보가 아니다.
  const coverages = rows
    .filter((r) => !['해지', '소멸', '실효'].includes(r.coverageStatus))
    .slice(0, MAX_COVERAGES)
    .map((r) => ({ ...r, amount: r.amount === null ? null : Number(r.amount) }));

  const allClauses: ClauseInput[] = clauseRows.map((c) => ({
    articleLabel: c.article_label,
    title: c.title,
    body: c.body,
    source: [c.insurer_name, c.product_name].filter(Boolean).join(' · ') || c.doc_title,
  }));
  const clauses = selectClauses(text, allClauses);

  if (coverages.length === 0) {
    return NextResponse.json({ error: '보유 담보가 없어 분석할 수 없습니다.' }, { status: 404 });
  }

  const prompt = buildAnalysisPrompt(text, coverages, clauses);

  try {
    const raw = await generateJson({ ...prompt, schema: VERDICT_SCHEMA });
    const verdict = validateVerdict(raw, coverages, clauses);
    if (verdict.dropped > 0) {
      // 무엇이 버려졌는지는 로그만 안다. 사용자에게는 통과분만 보인다.
      console.warn(`[ai-analyze] 검증 게이트가 ${verdict.dropped}건을 버림`);
    }
    return NextResponse.json({
      findings: verdict.findings.map((f) => ({
        coverage: {
          policyId: f.coverage.policyId,
          memberName: f.coverage.memberName,
          insurerName: f.coverage.insurerName,
          productName: f.coverage.productName,
          name: f.coverage.name,
          category: f.coverage.category,
          amount: f.coverage.amount, // DB 값이다. LLM 은 금액을 만지지 못한다.
        },
        applies: f.applies,
        quote: f.quote,
        reason: f.reason,
        clause: {
          articleLabel: f.clause.articleLabel,
          title: f.clause.title,
          source: f.clause.source,
        },
      })),
      summary: verdict.summary,
      clausesSearched: clauses.length,
    });
  } catch (err) {
    if (err instanceof LlmError) {
      console.error(`[ai-analyze] LLM 오류 code=${err.code}`);
      return NextResponse.json(
        { error: 'AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502 },
      );
    }
    throw err;
  }
}
