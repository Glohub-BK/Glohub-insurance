/**
 * 마지막 조회가 어느 환경에서 무엇을 가져왔는지 보여준다.
 *
 *   npm run db:last-sync
 *
 * "데모로 설정했는데 결과가 샌드박스 같다" 를 가릴 때 쓴다. environment 는 우리가
 * 저장한 값이고, 계약 목록은 실제로 들어온 내용이다. 둘을 나란히 놓고 본다.
 */
import './load-env';
import { closePool, query } from '../src/lib/db';

async function main() {
  const runs = await query<{
    id: string;
    environment: string | null;
    status: string;
    requested_at: string;
    policy_count: number;
    display_name: string;
  }>(
    `select r.id, r.environment, r.status, r.requested_at::text, r.policy_count, m.display_name
       from sync_run r join member m on m.id = r.member_id
      order by r.requested_at desc
      limit 5`,
  );

  if (runs.length === 0) {
    console.log('조회 이력이 없습니다.');
    return;
  }

  console.log('최근 조회');
  for (const r of runs) {
    console.log(
      `  ${r.requested_at.slice(0, 19)}  ${(r.environment ?? '?').padEnd(8)} ${r.status.padEnd(10)} ${r.display_name} · 계약 ${r.policy_count}건`,
    );
  }

  const latest = runs[0];
  const policies = await query<{ insurer_name: string; product_name: string; status: string }>(
    `select insurer_name, product_name, status
       from policy where last_seen_run_id = $1
      order by product_name limit 8`,
    [latest.id],
  );

  console.log(`\n가장 최근 조회(${latest.environment})가 가져온 계약 (최대 8건)`);
  for (const p of policies) {
    console.log(`  ${p.insurer_name} · ${p.product_name} · ${p.status}`);
  }

  // 50건 같은 큰 숫자는 대개 만기·해지된 옛 계약까지 포함된 것이다.
  // 상태별로 갈라 보여주지 않으면 "내 계약이 이렇게 많을 리가" 하고 의심하게 된다.
  const byStatus = await query<{ status: string; n: string }>(
    `select status, count(*)::text as n
       from policy where last_seen_run_id = $1
      group by status order by count(*) desc`,
    [latest.id],
  );
  if (byStatus.length > 0) {
    console.log('\n계약 상태');
    for (const s of byStatus) console.log(`  ${s.status.padEnd(6)} ${s.n}건`);
  }

  const [cov] = await query<{ n: string }>(
    `select count(*)::text as n from coverage
      where policy_id in (select id from policy where last_seen_run_id = $1)`,
    [latest.id],
  );
  console.log(`  담보     ${cov?.n ?? 0}개`);

  if (latest.environment === 'sandbox') {
    console.log('\n⚠ 샌드박스입니다. 가짜 계약이며 npm run db:purge-sandbox -- --yes 로 지울 수 있습니다.');
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
