/**
 * 개발용 시드. 가구 하나와 구성원 셋을 만들고,
 * CODEF 개발가이드 예시 응답을 정규화해 저장한다.
 *
 * 화면을 실제 데이터 없이 확인하기 위한 것이므로 실사용 전에 지워도 된다.
 *   npm run db:seed
 */
import './load-env';
import { query } from '@/lib/db';
import { normalizeContractInfo } from '@/lib/codef/normalize';
import { saveSyncResult } from '@/lib/repo/sync';
import { sampleContractInfo } from '../tests/fixtures/contract-info';

async function main() {
  const [household] = await query<{ id: string }>(
    `insert into household (name) values ($1) returning id`,
    ['우리집'],
  );

  const members: Array<{ name: string; relation: string; isMinor: boolean }> = [
    { name: '본인', relation: '본인', isMinor: false },
    { name: '배우자', relation: '배우자', isMinor: false },
    { name: '자녀', relation: '자녀', isMinor: true },
  ];

  const policies = normalizeContractInfo(sampleContractInfo);

  for (const m of members) {
    const [member] = await query<{ id: string }>(
      `insert into member (household_id, display_name, relation, is_minor, guardian_consent_at)
       values ($1, $2, $3, $4, $5) returning id`,
      [household.id, m.name, m.relation, m.isMinor, m.isMinor ? new Date().toISOString() : null],
    );

    // 구성원마다 조금씩 다른 계약을 갖게 해 보장 맵의 빈칸이 보이도록 한다.
    const subset =
      m.relation === '본인' ? policies
      : m.relation === '배우자' ? policies.filter((p) => p.contractKind !== 'property')
      : policies.filter((p) => p.contractKind === 'actual_loss');

    await saveSyncResult({
      memberId: member.id,
      environment: 'sandbox',
      policies: subset,
      rawSnapshot: sampleContractInfo,
    });

    console.log(`  ${m.name}: 계약 ${subset.length}건`);
  }

  console.log(`시드 완료. household_id = ${household.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
