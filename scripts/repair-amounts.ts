/**
 * 이미 저장된 담보 가입금액을 다시 읽는다.
 *
 * 왜 필요한가: 옛 parseAmount 는 숫자가 아닌 문자를 전부 지우고 남은 자릿수를 통째로
 * Number() 했다. "1일당 30,000원 (최대 180일)" 이 13000180 이 되고, 한 칸에 금액이 둘
 * 담긴 담보에서는 수십조가 나왔다. 그 값들이 합산되어 화면에 10019.2억원이 찍혔다.
 *
 * 다행히 coverage.raw 에 대상기관 원본이 그대로 남아 있다. CODEF 를 다시 부르지 않고
 * (하루 한도를 쓰지 않고) 원본에서 금액만 다시 계산해 덮는다.
 *
 *   npm run db:repair-amounts            # 무엇이 바뀌는지만 보여준다
 *   npm run db:repair-amounts -- --write # 실제로 고친다
 */
import './load-env';
import { query } from '../src/lib/db';
import { parseAmount } from '../src/lib/codef/normalize';
import { amountBasisOf, isSaneAmount } from '../src/lib/domain/coverage-basis';

const WRITE = process.argv.includes('--write');

type Row = {
  id: string;
  name: string;
  category: string;
  amount: string | null;
  raw: { resCoverageAmount?: string } | null;
};

function fmt(n: number | null): string {
  return n === null ? '(미상)' : n.toLocaleString('ko-KR');
}

async function main() {
  const rows = await query<Row>(
    `select c.id, c.name, c.category, c.amount, c.raw
       from coverage c
      where c.source = 'codef' and c.raw is not null
      order by c.name`,
  );

  const changes: {
    id: string;
    name: string;
    before: number | null;
    after: number | null;
    note: string;
    /** 대상기관이 실제로 보낸 문자열. 왜 그렇게 바뀌는지 눈으로 확인할 수 있어야 한다. */
    origin: string;
  }[] = [];

  for (const row of rows) {
    const original = row.raw?.resCoverageAmount;
    if (original === undefined) continue;

    const before = row.amount === null ? null : Number(row.amount);
    const reparsed = parseAmount(original);
    const basis = amountBasisOf(row.name, row.category);

    // 다시 읽은 값도 말이 안 되면 미상으로 둔다. 그럴듯한 큰 수보다 빈칸이 낫다.
    const after = isSaneAmount(reparsed, basis) ? reparsed : null;
    if (before === after) continue;

    const note = after === null ? '미상으로 내림' : before === null ? '복구' : '값 정정';
    changes.push({ id: row.id, name: row.name, before, after, note, origin: original });
  }

  if (changes.length === 0) {
    console.log(`담보 ${rows.length}건 확인 — 고칠 금액이 없습니다.`);
    return;
  }

  console.log(`담보 ${rows.length}건 중 ${changes.length}건이 달라집니다.\n`);
  for (const c of changes.slice(0, 40)) {
    console.log(`  ${c.note.padEnd(10)} ${c.name}`);
    console.log(`  ${' '.repeat(10)}   ${fmt(c.before)} → ${fmt(c.after)}`);
    console.log(`  ${' '.repeat(10)}   원본: ${JSON.stringify(c.origin)}`);
  }
  if (changes.length > 40) console.log(`  … 외 ${changes.length - 40}건`);

  if (!WRITE) {
    console.log('\n실제로 고치려면 --write 를 붙여 다시 실행하세요.');
    return;
  }

  for (const c of changes) {
    await query(`update coverage set amount = $2 where id = $1`, [c.id, c.after]);
  }
  console.log(`\n${changes.length}건 반영 완료.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
