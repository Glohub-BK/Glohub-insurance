import { query } from '../db';
import { citationKeys, pickClause, type CitationKey } from '../terms/match';
import { citationOf } from '../terms/parse';

/**
 * 가구가 보유한 약관에서 사고 유형별 근거 조항을 고른다.
 *
 * 조항이 없으면 null 이다. 화면은 그때 규칙 파일의 예시 문구를 쓰되 "예시"라고
 * 밝힌다 — 없는 근거를 있는 것처럼 보여주지 않는다.
 */

export type ClauseCitation = {
  ruleId: CitationKey;
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

/**
 * 조항 후보.
 *
 * 두 갈래를 함께 본다.
 *   1. 우리 가구가 직접 올린 약관
 *   2. **같은 상품**에 대해 다른 사용자가 올린 약관 (`product_key` 일치 + 공유 허용)
 *
 * 2번이 이 앱의 핵심이다. 「(무)메리츠 올바른 암보험1906」의 약관은 그 상품에 가입한
 * 모든 사람에게 똑같으므로, 한 사람이 올리면 나머지는 아무것도 하지 않아도 된다.
 * 사용자마다 공시실에 들어가 같은 파일을 다시 받게 하는 건 앱이 할 일을 사용자에게
 * 떠넘기는 것이다.
 *
 * 나누는 것은 **조항 텍스트뿐**이다. PDF 원본 파일은 올린 본인만 다시 내려받는다
 * (`document_blob` 은 이 쿼리에 없다). 출처를 밝힌 부분 인용과 파일 사본 배포는
 * 다른 문제다.
 */
export async function listHouseholdClauses(householdId: string, limit = 400): Promise<Row[]> {
  return query<Row>(
    `select c.article_label, c.title, c.body,
            d.insurer_name, d.product_name, d.title as doc_title
       from term_clause c
       join document d on d.id = c.document_id
       left join member m on m.id = d.member_id
      where d.kind = '약관'
        and (
          -- 1) 우리가 올린 것
          m.household_id = $1
          or d.policy_id in (
               select p.id from policy p join member pm on pm.id = p.member_id
                where pm.household_id = $1)
          -- 2) 우리가 가입한 상품에 대해 누군가 올린 것
          or (d.share_clauses and d.product_key is not null and d.product_key in (
               select p.product_key from policy p join member pm on pm.id = p.member_id
                where pm.household_id = $1 and p.product_key is not null))
        )
      order by c.ord
      limit $2`,
    [householdId, limit],
  );
}

/** 계약별 약관 보유 현황. 화면이 "올려야 하는 계약"만 골라 보여줄 수 있어야 한다. */
export type PolicyTermsStatus = {
  policy_id: string;
  product_key: string | null;
  /** 우리 가구가 직접 올려 원본까지 가진 문서 */
  own_document_id: string | null;
  own_file_name: string | null;
  own_byte_size: number | null;
  /** 같은 상품에 대해 (누구든) 올라와 있는 조항 수 */
  clause_count: number;
  /** 조항은 있는데 원본은 우리 것이 아닐 때 true — 공시실 링크만 준다 */
  shared_only: boolean;
};

export async function getPolicyTermsStatus(householdId: string): Promise<PolicyTermsStatus[]> {
  return query<PolicyTermsStatus>(
    `with mine as (
       select p.id as policy_id, p.product_key
         from policy p join member m on m.id = p.member_id
        where m.household_id = $1
     ),
     own as (
       select d.policy_id, d.id as document_id, b.file_name, b.byte_size,
              (select count(*) from term_clause tc where tc.document_id = d.id)::int as cnt
         from document d
         join document_blob b on b.document_id = d.id
         left join member dm on dm.id = d.member_id
         left join policy dp on dp.id = d.policy_id
         left join member pm on pm.id = dp.member_id
        where d.kind = '약관'
          and coalesce(pm.household_id, dm.household_id) = $1
     )
     select mine.policy_id,
            mine.product_key,
            own.document_id                as own_document_id,
            own.file_name                  as own_file_name,
            own.byte_size                  as own_byte_size,
            coalesce(
              own.cnt,
              (select count(*)::int from term_clause tc
                 join document d2 on d2.id = tc.document_id
                where d2.share_clauses and d2.product_key is not null
                  and d2.product_key = mine.product_key),
              0
            )                              as clause_count,
            (own.document_id is null)      as shared_only
       from mine
       left join own on own.policy_id = mine.policy_id`,
    [householdId],
  );
}

export async function getClauseCitations(
  householdId: string,
): Promise<Partial<Record<CitationKey, ClauseCitation>>> {
  const rows = await listHouseholdClauses(householdId);
  if (rows.length === 0) return {};

  const out: Partial<Record<CitationKey, ClauseCitation>> = {};
  for (const ruleId of citationKeys()) {
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
