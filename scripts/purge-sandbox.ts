/**
 * 샌드박스로 들어온 가짜 계약을 지운다.
 *
 *   npm run db:purge-sandbox           # 무엇이 지워질지만 보여준다
 *   npm run db:purge-sandbox -- --yes  # 실제로 지운다
 *
 * 샌드박스 응답은 계약 50건·담보 337개처럼 그럴듯해서, 실데이터와 섞이면
 * 어느 것이 진짜인지 구분할 수 없게 된다. 실조회 전에 반드시 비운다.
 *
 * 지우는 범위는 environment='sandbox' 인 sync_run 과 그 조회로 처음 들어온 계약뿐이다.
 * 실데이터로 한 번이라도 갱신된 계약(last_seen_run_id 가 실조회)은 건드리지 않는다.
 */
import './load-env';
import { closePool, query, withTransaction } from '../src/lib/db';

async function main() {
  const apply = process.argv.includes('--yes');

  const [count] = await query<{ runs: string; policies: string; coverages: string }>(
    `with sandbox_runs as (
       select id from sync_run where environment = 'sandbox'
     ),
     sandbox_policies as (
       select p.id from policy p
        where p.first_seen_run_id in (select id from sandbox_runs)
          and p.last_seen_run_id in (select id from sandbox_runs)
     )
     select (select count(*)::text from sandbox_runs) as runs,
            (select count(*)::text from sandbox_policies) as policies,
            (select count(*)::text from coverage where policy_id in (select id from sandbox_policies)) as coverages`,
  );

  console.log(`조회 이력   ${count.runs}건`);
  console.log(`계약        ${count.policies}건`);
  console.log(`담보        ${count.coverages}개`);

  if (Number(count.runs) === 0) {
    console.log('\n샌드박스 데이터가 없습니다.');
    return;
  }

  if (!apply) {
    console.log('\n실제로 지우려면 --yes 를 붙이세요:  npm run db:purge-sandbox -- --yes');
    return;
  }

  await withTransaction(async (q) => {
    // 담보는 계약에 딸려 지워진다(on delete cascade). 계약을 먼저 지운다.
    await q(
      `delete from policy
        where first_seen_run_id in (select id from sync_run where environment = 'sandbox')
          and last_seen_run_id in (select id from sync_run where environment = 'sandbox')`,
    );
    await q(`delete from sync_run where environment = 'sandbox'`);
  });

  console.log('\n지웠습니다. 실데이터로 다시 조회하세요.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
