import { createHash } from 'node:crypto';
import { query, withTransaction } from '../db';
import { productKeyOf } from '../domain/product-key';

/**
 * 약관 문서 보관함.
 *
 * 조항만 뽑아 두고 원본을 버리지 않는다. 사용자에게 원본이 필요한 순간이 따로 있다 —
 * 분쟁 시 제출, 손해사정사에게 전달, 다른 기기에서 열어보기. 그래서 파일을 그대로
 * 보관하고 언제든 다시 내려받게 한다.
 */

/** 40MB. 장기보험 약관은 두꺼워도 10MB 안쪽이다. */
export const MAX_TERMS_BYTES = 40 * 1024 * 1024;

export type TermsDoc = {
  document_id: string;
  policy_id: string | null;
  title: string;
  file_name: string;
  mime: string;
  byte_size: number;
  clause_count: number;
  created_at: string;
};

/** PDF 매직 넘버(%PDF-). 확장자나 브라우저가 붙인 MIME 은 믿지 않는다. */
export function isPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

export async function listTermsDocs(householdId: string): Promise<TermsDoc[]> {
  return query<TermsDoc>(
    `select d.id as document_id,
            d.policy_id,
            d.title,
            b.file_name,
            b.mime,
            b.byte_size,
            (select count(*) from term_clause tc where tc.document_id = d.id)::int as clause_count,
            d.created_at
       from document d
       join document_blob b on b.document_id = d.id
       left join policy p on p.id = d.policy_id
       left join member pm on pm.id = p.member_id
       left join member dm on dm.id = d.member_id
      where coalesce(pm.household_id, dm.household_id) = $1
        and d.kind = '약관'
      order by d.created_at desc`,
    [householdId],
  );
}

export async function getTermsBlob(
  documentId: string,
): Promise<{ bytes: Buffer; mime: string; file_name: string } | null> {
  const rows = await query<{ bytes: Buffer; mime: string; file_name: string }>(
    `select bytes, mime, file_name from document_blob where document_id = $1`,
    [documentId],
  );
  return rows[0] ?? null;
}

/** 이 문서가 이 가구 것인지. 다운로드 라우트가 부르기 전에 반드시 확인한다. */
export async function belongsToHousehold(documentId: string, householdId: string): Promise<boolean> {
  const rows = await query<{ ok: boolean }>(
    `select true as ok
       from document d
       left join policy p on p.id = d.policy_id
       left join member pm on pm.id = p.member_id
       left join member dm on dm.id = d.member_id
      where d.id = $1 and coalesce(pm.household_id, dm.household_id) = $2`,
    [documentId, householdId],
  );
  return rows.length > 0;
}

export type SaveResult =
  | { ok: true; documentId: string; clauseCount: number; duplicate: false }
  | { ok: true; documentId: string; clauseCount: number; duplicate: true }
  | { ok: false; message: string };

/**
 * 약관 파일 + 뽑아낸 조항을 한 트랜잭션으로 저장한다.
 *
 * 같은 파일을 두 번 넣으면 조항이 중복되므로 내용 해시로 막는다. 이미 있으면 새로 넣지
 * 않고 기존 문서를 돌려준다 — 사용자에겐 실패가 아니라 "이미 들어 있다"이다.
 */
/**
 * Postgres 텍스트 컬럼은 NUL(0x00)을 저장하지 못한다 (22021).
 * 추출 단계에서 걸러내지만, 이 저장소를 지나는 모든 텍스트에서 한 번 더 걷어낸다 —
 * 다른 경로로 들어온 텍스트 하나가 트랜잭션 전체를 죽이면 안 된다.
 */
function stripNul(text: string): string;
function stripNul(text: string | null): string | null;
function stripNul(text: string | null): string | null {
  return text === null ? null : text.replace(/\u0000/g, '');
}

/**
 * 조항 일괄 삽입.
 *
 * KB 약관은 조항이 수천 개다. 한 줄씩 INSERT 하면 pooler 왕복이 조항 수만큼 생겨
 * 저장에만 수백 초가 걸린다 — 300초 타임아웃의 진범이 추출이 아니라 이 루프였다.
 * unnest 로 한 번에 넣는다.
 */
async function insertClauses(
  q: <R extends Record<string, unknown>>(text: string, params?: readonly unknown[]) => Promise<R[]>,
  documentId: string,
  clauses: { ord: number; articleNo: number | null; articleLabel: string; title: string | null; body: string }[],
): Promise<void> {
  await q(
    `insert into term_clause (document_id, ord, article_no, article_label, title, body)
     select $1, * from unnest($2::int[], $3::int[], $4::text[], $5::text[], $6::text[])`,
    [
      documentId,
      clauses.map((c) => c.ord),
      clauses.map((c) => c.articleNo),
      clauses.map((c) => stripNul(c.articleLabel)),
      clauses.map((c) => stripNul(c.title)),
      clauses.map((c) => stripNul(c.body)),
    ],
  );
}

export async function saveTermsDoc(input: {
  memberId: string;
  policyId: string | null;
  title: string;
  fileName: string;
  mime: 'application/pdf' | 'text/plain';
  bytes: Uint8Array;
  insurerName: string | null;
  productName: string | null;
  clauses: { ord: number; articleNo: number | null; articleLabel: string; title: string | null; body: string }[];
}): Promise<SaveResult> {
  const hash = createHash('sha256').update(Buffer.from(input.bytes)).digest('hex');

  const existing = await query<{ id: string; clause_count: number }>(
    `select d.id,
            (select count(*) from term_clause tc where tc.document_id = d.id)::int as clause_count
       from document d where d.content_hash = $1`,
    [hash],
  );
  if (existing[0]) {
    // 같은 파일을 다시 올렸다. 원본은 이미 있으니 다시 저장하지 않지만,
    // **조항은 새로 파싱한 결과로 갈아끼운다** — 파서가 좋아졌을 때 재업로드가
    // 갱신 수단이 되게 하기 위해서다. (조항 15개짜리 문서가 여기 갇혀 있었다)
    const stored = existing[0].clause_count;
    if (input.clauses.length !== stored && input.clauses.length > 0) {
      await withTransaction(async (q) => {
        await q(`delete from term_clause where document_id = $1`, [existing[0].id]);
        await insertClauses(q, existing[0].id, input.clauses);
      });
      return { ok: true, documentId: existing[0].id, clauseCount: input.clauses.length, duplicate: true };
    }
    return {
      ok: true,
      documentId: existing[0].id,
      clauseCount: stored,
      duplicate: true,
    };
  }

  const documentId = await withTransaction(async (q) => {
    const [doc] = await q<{ id: string }>(
      `insert into document (member_id, policy_id, kind, title, mime, bytes,
                             insurer_name, product_name, product_key, content_hash)
       values ($1, $2, '약관', $3, $4, $5, $6, $7, $9, $8)
       returning id`,
      [
        input.memberId,
        input.policyId,
        stripNul(input.title),
        input.mime,
        input.bytes.byteLength,
        stripNul(input.insurerName),
        stripNul(input.productName),
        hash,
        // 같은 상품에 가입한 다른 사용자가 이 조항을 함께 쓰게 하는 열쇠.
        productKeyOf(input.insurerName, input.productName),
      ],
    );

    await q(
      `insert into document_blob (document_id, bytes, byte_size, mime, file_name)
       values ($1, $2, $3, $4, $5)`,
      [doc.id, Buffer.from(input.bytes), input.bytes.byteLength, input.mime, stripNul(input.fileName)],
    );

    await insertClauses(q, doc.id, input.clauses);
    return doc.id;
  }).catch(async (err: unknown) => {
    // 해시 검사와 삽입 사이에 같은 파일이 먼저 들어오는 경합이 실제로 있었다 —
    // 타임아웃으로 죽은 줄 알았던 첫 시도가 커밋까지 끝냈고, 재시도가 23505 로 죽었다.
    // 유니크 충돌이면 실패가 아니라 "이미 있음" 이다.
    const pg = err as { code?: string };
    if (pg?.code === '23505') return null;
    throw err;
  });

  if (documentId === null) {
    const again = await query<{ id: string; clause_count: number }>(
      `select d.id,
              (select count(*) from term_clause tc where tc.document_id = d.id)::int as clause_count
         from document d where d.content_hash = $1`,
      [hash],
    );
    if (again[0]) {
      return { ok: true, documentId: again[0].id, clauseCount: again[0].clause_count, duplicate: true };
    }
    return { ok: false, message: '저장 중 충돌이 났어요. 다시 시도해주세요.' };
  }

  return { ok: true, documentId, clauseCount: input.clauses.length, duplicate: false };
}

export async function deleteTermsDoc(documentId: string): Promise<void> {
  // term_clause · document_blob 은 on delete cascade 로 함께 지워진다.
  await query(`delete from document where id = $1`, [documentId]);
}
