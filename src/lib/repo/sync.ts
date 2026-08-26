import { withTransaction } from '../db';
import { productKeyOf } from '../domain/product-key';
import type { NormalizedPolicy } from '../codef/normalize';
import type { CodefEnvironment } from '../codef/types';

export type SaveSyncInput = {
  memberId: string;
  environment: CodefEnvironment;
  policies: NormalizedPolicy[];
  /** 원본 응답. 정규화 로직이 바뀌어도 재처리할 수 있게 통째로 남긴다. */
  rawSnapshot: unknown;
};

export type SaveSyncOutput = {
  syncRunId: string;
  inserted: number;
  updated: number;
  coverageCount: number;
};

/**
 * 한 번의 조회 결과를 통째로 저장한다.
 *
 * 계약은 upsert 한다 — 이번 응답에 없는 기존 계약은 지우지 않는다.
 * 대상기관이 일시적으로 일부를 누락해 내려주는 경우가 있어, 삭제 대신
 * last_seen_run_id 가 갱신되지 않는 것으로 "이번엔 안 보였다"를 표현한다.
 */
export async function saveSyncResult(input: SaveSyncInput): Promise<SaveSyncOutput> {
  return withTransaction(async (q) => {
    const [run] = await q<{ id: string }>(
      `insert into sync_run (member_id, source, environment, status, finished_at, policy_count, raw_snapshot)
       values ($1, 'codef', $2, 'succeeded', now(), $3, $4)
       returning id`,
      [input.memberId, input.environment, input.policies.length, JSON.stringify(input.rawSnapshot)],
    );

    let inserted = 0;
    let updated = 0;
    let coverageCount = 0;

    for (const p of input.policies) {
      const [row] = await q<{ id: string; was_insert: boolean }>(
        `insert into policy (
           member_id, first_seen_run_id, last_seen_run_id, source, identity_key, contract_kind,
           insurer_code, insurer_name, product_name, product_key, policy_no, policy_no_hidden,
           policyholder_name, insured_name, status, start_date, end_date,
           premium, payment_cycle, raw
         ) values (
           $1, $2, $2, 'codef', $3, $4,
           $5, $6, $7, $18, $8, $9,
           $10, $11, $12, $13, $14,
           $15, $16, $17
         )
         on conflict (member_id, identity_key) do update set
           last_seen_run_id = excluded.last_seen_run_id,
           insurer_code     = coalesce(excluded.insurer_code, policy.insurer_code),
           insurer_name     = excluded.insurer_name,
           product_name     = excluded.product_name,
           product_key      = excluded.product_key,
           policy_no        = coalesce(excluded.policy_no, policy.policy_no),
           policy_no_hidden = coalesce(excluded.policy_no_hidden, policy.policy_no_hidden),
           policyholder_name= coalesce(excluded.policyholder_name, policy.policyholder_name),
           insured_name     = coalesce(excluded.insured_name, policy.insured_name),
           status           = excluded.status,
           start_date       = coalesce(excluded.start_date, policy.start_date),
           end_date         = coalesce(excluded.end_date, policy.end_date),
           premium          = coalesce(excluded.premium, policy.premium),
           payment_cycle    = coalesce(excluded.payment_cycle, policy.payment_cycle),
           raw              = excluded.raw
         returning id, (xmax = 0) as was_insert`,
        [
          input.memberId,
          run.id,
          p.identityKey,
          p.contractKind,
          p.insurerCode,
          p.insurerName,
          p.productName,
          p.policyNo,
          p.policyNoHidden,
          p.policyholderName,
          p.insuredName,
          p.status,
          p.startDate,
          p.endDate,
          p.premium,
          p.paymentCycle,
          JSON.stringify(p.raw),
          productKeyOf(p.insurerName, p.productName),
        ],
      );

      if (row.was_insert) inserted += 1;
      else updated += 1;

      // 담보는 계약 단위로 통째로 교체한다. 부분 갱신보다 단순하고,
      // 담보 구성 변경(특약 추가·해지)이 그대로 반영된다.
      await q(`delete from coverage where policy_id = $1 and source = 'codef'`, [row.id]);

      for (const c of p.coverages) {
        await q(
          `insert into coverage (
             policy_id, category, name, amount, agreement_type, coverage_code,
             coverage_status, insured_name, start_date, end_date, is_whole_life,
             classified_by, confidence, source, raw
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'rule',$12,'codef',$13)`,
          [
            row.id,
            c.category,
            c.name,
            c.amount,
            c.agreementType,
            c.coverageCode,
            c.coverageStatus,
            c.insuredName,
            c.startDate,
            c.endDate,
            c.isWholeLife,
            c.confidence,
            JSON.stringify(c.raw),
          ],
        );
        coverageCount += 1;
      }
    }

    return { syncRunId: run.id, inserted, updated, coverageCount };
  });
}

export async function recordFailedSync(
  memberId: string,
  environment: CodefEnvironment,
  code: string,
  message: string,
): Promise<void> {
  await withTransaction(async (q) => {
    await q(
      `insert into sync_run (member_id, source, environment, status, finished_at, error_code, error_message)
       values ($1, 'codef', $2, 'failed', now(), $3, $4)`,
      [memberId, environment, code, message],
    );
  });
}
