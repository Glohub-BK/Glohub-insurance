/**
 * 환경별 응답이 같은 내용인지 비교한다.
 *
 *   npm run db:compare-runs
 *
 * 데모가 실데이터를 준다면 샌드박스 응답과 내용이 달라야 한다. 같다면 데모도
 * 고정 응답을 주고 있다는 뜻이고, 그건 우리 코드로 해결할 수 없는 문제다.
 * raw_snapshot 을 통째로 저장해둔 이유가 이런 순간이다.
 */
import './load-env';
import { createHash } from 'node:crypto';
import { closePool, query } from '../src/lib/db';

type Run = {
  id: string;
  environment: string;
  requested_at: string;
  policy_count: number;
  raw_snapshot: unknown;
};

function fingerprint(snapshot: unknown): { hash: string; contracts: number; sample: string[] } {
  const json = JSON.stringify(snapshot ?? {});
  const lists = (snapshot ?? {}) as Record<string, unknown[]>;
  const contracts = Object.entries(lists)
    .filter(([k]) => k.endsWith('ContractList'))
    .flatMap(([, v]) => (Array.isArray(v) ? v : []));
  const sample = contracts.slice(0, 5).map((c) => {
    const o = c as Record<string, string>;
    return `${o.resCompanyNm ?? o.resCompanyNm1 ?? '?'} · ${o.resInsuranceName ?? o.commStartDate ?? '?'}`;
  });
  return { hash: createHash('sha256').update(json).digest('hex').slice(0, 16), contracts: contracts.length, sample };
}

async function latestOf(environment: string): Promise<Run | null> {
  const rows = await query<Run>(
    `select id, environment, requested_at::text, policy_count, raw_snapshot
       from sync_run
      where environment = $1 and status = 'succeeded' and raw_snapshot is not null
      order by requested_at desc limit 1`,
    [environment],
  );
  return rows[0] ?? null;
}

async function main() {
  const [sandbox, demo] = await Promise.all([latestOf('sandbox'), latestOf('demo')]);

  for (const [label, run] of [
    ['샌드박스', sandbox],
    ['데모', demo],
  ] as const) {
    if (!run) {
      console.log(`${label.padEnd(6)} 이력 없음`);
      continue;
    }
    const f = fingerprint(run.raw_snapshot);
    console.log(`${label.padEnd(6)} ${run.requested_at.slice(0, 19)} · 계약 ${f.contracts}건 · 지문 ${f.hash}`);
    for (const s of f.sample) console.log(`         ${s}`);
  }

  if (!sandbox || !demo) {
    console.log('\n두 환경의 이력이 모두 있어야 비교할 수 있습니다.');
    return;
  }

  const a = fingerprint(sandbox.raw_snapshot);
  const b = fingerprint(demo.raw_snapshot);

  console.log('');
  if (a.hash === b.hash) {
    console.log('두 응답이 완전히 같습니다 → 데모도 고정 응답을 주고 있습니다.');
    console.log('CODEF 에 "데모 환경에서 신용정보원(0001) 실데이터 조회가 되는지" 문의해야 합니다.');
  } else if (a.contracts === b.contracts) {
    console.log('건수는 같지만 내용이 다릅니다 → 우연일 수 있으니 계약 이름을 직접 비교하세요.');
  } else {
    console.log('내용이 다릅니다 → 데모는 다른 데이터를 주고 있습니다.');
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
