import { query } from '../db';
import { pickClause, ruleIds, type RuleId } from '../terms/match';
import { citationOf } from '../terms/parse';

/**
 * 가구가 보유한 약관에서 사고 유형별 근거 조항을 고른다.
 *
 * 조항이 없으면 null 이다. 화면은 그때 규칙 파일의 예시 문구를 쓰되 "예시"라고
 * 밝힌다 — 없는 근거를 있는 것처럼 보여주지 않는다.
 */

export type ClauseCitation = {
  ruleId: RuleId;
  articleLabel: string;
  clauseTitle: string | null;
  body: string;
  citation: string;
};

type Row = {
  article_label: string;
  title: string | null;
  body: string;
  insurer_name: string | null;
  product_name: string | null;
  doc_title: string;
};

/** 조항 후보. 가구 구성원이 가진 약관 문서만 본다. */
export async function listHouseholdClauses(householdId: string, limit = 400): Promise<Row[]> {
  return query<Row>(
    `select c.article_label, c.title, c.body,
            d.insurer_name, d.product_name, d.title as doc_title
       from term_clause c
       join document d on d.id = c.document_id
       left join member m on m.id = d.member_id
      where d.kind = '약관'
        and (m.household_id = $1 or d.policy_id in (
              select p.id from policy p join member pm on pm.id = p.member_id
               where pm.household_id = $1))
      order by c.ord
      limit $2`,
    [householdId, limit],
  );
}

export async function getClauseCitations(
  householdId: string,
): Promise<Partial<Record<RuleId, ClauseCitation>>> {
  const rows = await listHouseholdClauses(householdId);
  if (rows.length === 0) return {};

  const out: Partial<Record<RuleId, ClauseCitation>> = {};
  for (const ruleId of ruleIds()) {
    const best = pickClause(
      ruleId,
      rows.map((r) => ({ ...r, title: r.title })),
    );
    if (!best) continue;
    const r = best.clause;
    out[ruleId] = {
      ruleId,
      articleLabel: r.article_label,
      clauseTitle: r.title,
      body: r.body,
      citation: citationOf({
        insurerName: r.insurer_name,
        productName: r.product_name,
        title: r.doc_title,
        articleLabel: r.article_label,
        clauseTitle: r.title,
      }),
    };
  }
  return out;
}
