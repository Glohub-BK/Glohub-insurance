/**
 * 이미 저장된 계약·약관에 상품키를 채운다.
 *
 * 상품키는 「같은 상품이면 같은 약관」을 잇는 열쇠다. 이 키가 비어 있으면 다른
 * 사용자가 올려둔 조항이 있어도 내 계약과 이어지지 않는다.
 *
 *   npm run db:backfill-keys              # 무엇이 채워지는지만 보여준다
 *   npm run db:backfill-keys -- --write   # 실제로 채운다
 */
import './load-env';
import { closePool, query } from '../src/lib/db';
import { productKeyOf } from '../src/lib/domain/product-key';

const WRITE = process.argv.includes('--write');

async function fill(
  table: 'policy' | 'document',
  where: string,
): Promise<{ total: number; filled: number; skipped: number }> {
  const rows = await query<{ id: string; insurer_name: string | null; product_name: string | null }>(
    `select id, insurer_name, product_name from ${table} where product_key is null ${where}`,
  );

  let filled = 0;
  let skipped = 0;
  for (const r of rows) {
    const key = productKeyOf(r.insurer_name, r.product_name);
    if (!key) {
      skipped += 1;
      continue;
    }
    if (WRITE) await query(`update ${table} set product_key = $2 where id = $1`, [r.id, key]);
    filled += 1;
  }
  return { total: rows.length, filled, skipped };
}

async function main() {
  const p = await fill('policy', '');
  const d = await fill('document', `and kind = '약관'`);

  console.log(`계약    ${p.total}건 중 ${p.filled}건 채움 (회사·상품명이 비어 건너뜀 ${p.skipped}건)`);
  console.log(`약관    ${d.total}건 중 ${d.filled}건 채움 (건너뜀 ${d.skipped}건)`);

  if (!WRITE) {
    console.log('\n실제로 채우려면 --write 를 붙여 다시 실행하세요.');
    return;
  }

  const [{ matched }] = await query<{ matched: number }>(
    `select count(*)::int as matched
       from policy p
      where p.product_key is not null
        and exists (select 1 from document d
                     where d.share_clauses and d.product_key = p.product_key)`,
  );
  console.log(`\n조항을 바로 쓸 수 있는 계약  ${matched}건`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closePool());
