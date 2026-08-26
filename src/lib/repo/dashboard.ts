import { query } from '../db';
import type { CoverageCategory } from '../domain/coverage-category';

export type HouseholdRow = { id: string; name: string };

export type MemberSyncRow = {
  member_id: string;
  household_id: string;
  display_name: string;
  relation: string;
  last_run_id: string | null;
  last_run_status: string | null;
  last_synced_at: string | null;
  /** pg 는 count()/int8 을 문자열로 돌려준다. 숫자 비교 전에 반드시 Number() 로 감싼다. */
  last_policy_count: string | null;
  is_minor: boolean;
  guardian_consent_at: string | null;
  /** 프로필 사진 갱신 시각. 없으면 사진이 없다는 뜻이고 화면은 이니셜로 돌아간다. */
  avatar_updated_at: string | null;
};

export type MatrixCell = {
  member_id: string;
  display_name: string;
  category: CoverageCategory;
  category_label: string;
  sort_order: number;
  policy_count: string;
  coverage_count: string;
  total_amount: string;
  needs_review_count: string;
};

export type PolicyRow = {
  id: string;
  member_name: string;
  contract_kind: string;
  insurer_name: string;
  product_name: string;
  policy_no: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  premium: string | null;
  payment_cycle: string | null;
  coverage_count: string;
  terms_doc_count: string;
};

export type CoverageRow = {
  policy_id: string;
  category: CoverageCategory;
  name: string;
  amount: string | null;
  coverage_status: string;
  agreement_type: string | null;
  confidence: string | null;
};

export async function listHouseholds(): Promise<HouseholdRow[]> {
  return query<HouseholdRow>(`select id, name from household order by created_at asc`);
}

export async function getMembers(householdId: string): Promise<MemberSyncRow[]> {
  return query<MemberSyncRow>(
    `select * from member_sync_status
     where household_id = $1
     order by case relation
       when '본인' then 0 when '배우자' then 1 when '자녀' then 2 when '부모' then 3 else 4 end,
       display_name`,
    [householdId],
  );
}

export async function getCoverageMatrix(householdId: string): Promise<MatrixCell[]> {
  return query<MatrixCell>(
    `select member_id, display_name, category, category_label, sort_order,
            policy_count, coverage_count, total_amount, needs_review_count
     from coverage_matrix
     where household_id = $1
     order by sort_order`,
    [householdId],
  );
}

export async function getPolicies(householdId: string): Promise<PolicyRow[]> {
  return query<PolicyRow>(
    `select id, member_name, contract_kind, insurer_name, product_name, policy_no,
            status, start_date, end_date, premium, payment_cycle,
            coverage_count, terms_doc_count
     from policy_summary
     where household_id = $1
     order by case status when '유지' then 0 when '만기' then 1 else 2 end,
              member_name, insurer_name`,
    [householdId],
  );
}

export async function getCoverages(householdId: string): Promise<CoverageRow[]> {
  return query<CoverageRow>(
    `select c.policy_id, c.category, c.name, c.amount, c.coverage_status,
            c.agreement_type, c.confidence
     from coverage c
     join policy p on p.id = c.policy_id
     join member m on m.id = p.member_id
     where m.household_id = $1
     order by c.category, c.name`,
    [householdId],
  );
}

export type Totals = {
  memberCount: number;
  activePolicyCount: number;
  monthlyPremium: number;
  gapCount: number;
  reviewCount: number;
};

/** 상단 KPI. 보장 공백(gap)은 구성원 × 핵심 카테고리 중 담보가 0인 칸 수다. */
export const CORE_CATEGORIES: CoverageCategory[] = [
  'actual_loss',
  'diagnosis',
  'hospital',
  'surgery',
  'liability',
  'death',
];

export function computeTotals(
  members: MemberSyncRow[],
  matrix: MatrixCell[],
  policies: PolicyRow[],
): Totals {
  const active = policies.filter((p) => p.status === '유지');

  // 월 환산 보험료. 납입주기가 다르면 월 기준으로 맞춘다.
  const perMonth: Record<string, number> = {
    월납: 1,
    분기납: 1 / 3,
    반기납: 1 / 6,
    연납: 1 / 12,
  };
  const monthlyPremium = active.reduce((sum, p) => {
    const amount = p.premium === null ? 0 : Number(p.premium);
    const factor = p.payment_cycle ? (perMonth[p.payment_cycle] ?? 0) : 0;
    return sum + amount * factor;
  }, 0);

  // pg 는 count() 를 문자열로 돌려준다. 숫자로 강제하지 않으면 비교가 조용히 빗나간다.
  const gapCount = matrix.filter(
    (cell) => CORE_CATEGORIES.includes(cell.category) && Number(cell.coverage_count) === 0,
  ).length;

  const reviewCount = matrix.reduce((sum, c) => sum + Number(c.needs_review_count ?? 0), 0);

  return {
    memberCount: members.length,
    activePolicyCount: active.length,
    monthlyPremium: Math.round(monthlyPremium),
    gapCount,
    reviewCount,
  };
}

/** AI 청구 진단이 훑는 담보 후보. 유지 중 계약의 담보만 올린다. */
export async function getCoverageCandidates(householdId: string) {
  return query<{
    policyId: string;
    memberName: string;
    insurerName: string;
    productName: string;
    category: CoverageCategory;
    name: string;
    amount: string | null;
    coverageStatus: string;
  }>(
    `select p.id            as "policyId",
            m.display_name  as "memberName",
            p.insurer_name  as "insurerName",
            p.product_name  as "productName",
            c.category      as "category",
            c.name          as "name",
            c.amount        as "amount",
            c.coverage_status as "coverageStatus"
     from coverage c
     join policy p on p.id = c.policy_id
     join member m on m.id = p.member_id
     where m.household_id = $1
       and p.status = '유지'
     order by m.display_name, c.category`,
    [householdId],
  );
}
