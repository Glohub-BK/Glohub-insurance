import type { CoverageCandidate } from '../domain/incident-match';
import type { CoverageRow, MatrixCell, MemberSyncRow, PolicyRow } from '../repo/dashboard';
import { CATEGORY_LABELS, CATEGORY_SORT, COVERAGE_CATEGORIES, type CoverageCategory } from '../domain/coverage-category';

/**
 * 연결 전 미리보기용 예시 가구.
 *
 * 왜 DB 가 아니라 코드에 두는가:
 *   1) 아직 계정이 없는 사람에게도 보여야 한다. 로그인 게이트를 앞에 두지 않기 위해서다.
 *   2) 실제 사용자 DB 를 예시 데이터로 더럽히지 않는다.
 *   3) 화면에는 반드시 "예시" 라벨이 함께 붙는다. 내 데이터로 오인하면 안 된다.
 *
 * 구성 의도: 첫째(미성년)에게 배상책임이 없다. 이 제품이 무엇을 잡아주는지
 * 한 화면에서 드러나야 하기 때문이다.
 */

const HOUSEHOLD_ID = 'demo-household';

export const SAMPLE_MEMBERS: MemberSyncRow[] = [
  {
    member_id: 'demo-me',
    household_id: HOUSEHOLD_ID,
    display_name: '본인',
    relation: '본인',
    last_run_id: null,
    last_run_status: 'succeeded',
    last_synced_at: null,
    last_policy_count: '3',
    is_minor: false,
    guardian_consent_at: null,
    avatar_updated_at: null,
  },
  {
    member_id: 'demo-spouse',
    household_id: HOUSEHOLD_ID,
    display_name: '배우자',
    relation: '배우자',
    last_run_id: null,
    last_run_status: 'succeeded',
    last_synced_at: null,
    last_policy_count: '2',
    is_minor: false,
    guardian_consent_at: null,
    avatar_updated_at: null,
  },
  {
    member_id: 'demo-child',
    household_id: HOUSEHOLD_ID,
    display_name: '첫째',
    relation: '자녀',
    last_run_id: null,
    last_run_status: 'succeeded',
    last_synced_at: null,
    last_policy_count: '1',
    is_minor: true,
    guardian_consent_at: null,
    avatar_updated_at: null,
  },
];

type SampleCoverage = {
  member: string;
  policyId: string;
  category: CoverageCategory;
  name: string;
  amount: number | null;
};

/** 담보 원장. 계약·격자·AI 후보를 모두 여기서 파생시킨다. */
const SAMPLE_COVERAGE_ROWS: SampleCoverage[] = [
  // 본인 — 종합보험
  { member: '본인', policyId: 'demo-p1', category: 'diagnosis', name: '암진단비', amount: 20_000_000 },
  { member: '본인', policyId: 'demo-p1', category: 'diagnosis', name: '뇌졸중진단비', amount: 10_000_000 },
  { member: '본인', policyId: 'demo-p1', category: 'diagnosis', name: '골절진단비', amount: 300_000 },
  { member: '본인', policyId: 'demo-p1', category: 'surgery', name: '질병수술비', amount: 500_000 },
  { member: '본인', policyId: 'demo-p1', category: 'hospital', name: '상해입원일당', amount: 30_000 },
  { member: '본인', policyId: 'demo-p1', category: 'liability', name: '가족일상생활중배상책임', amount: 100_000_000 },
  { member: '본인', policyId: 'demo-p1', category: 'disability', name: '상해후유장해', amount: 50_000_000 },
  { member: '본인', policyId: 'demo-p1', category: 'death', name: '일반상해사망', amount: 100_000_000 },
  // 본인 — 실손
  { member: '본인', policyId: 'demo-p2', category: 'actual_loss', name: '상해통원의료비', amount: 250_000 },
  { member: '본인', policyId: 'demo-p2', category: 'actual_loss', name: '질병통원의료비', amount: 250_000 },
  // 본인 — 주택화재
  { member: '본인', policyId: 'demo-p3', category: 'fire', name: '주택화재손해', amount: 50_000_000 },
  { member: '본인', policyId: 'demo-p3', category: 'fire', name: '급배수시설누출손해', amount: 10_000_000 },

  // 배우자 — 종합보험
  { member: '배우자', policyId: 'demo-p4', category: 'diagnosis', name: '암진단비', amount: 30_000_000 },
  { member: '배우자', policyId: 'demo-p4', category: 'surgery', name: '질병수술비', amount: 500_000 },
  { member: '배우자', policyId: 'demo-p4', category: 'hospital', name: '질병입원일당', amount: 30_000 },
  { member: '배우자', policyId: 'demo-p4', category: 'liability', name: '일상생활중배상책임', amount: 100_000_000 },
  // 배우자 — 실손
  { member: '배우자', policyId: 'demo-p5', category: 'actual_loss', name: '질병통원의료비', amount: 250_000 },

  // 첫째 — 실손만. 배상책임·진단·수술·입원이 비어 있다.
  { member: '첫째', policyId: 'demo-p6', category: 'actual_loss', name: '상해통원의료비', amount: 250_000 },
];

type SamplePolicy = {
  id: string;
  member: string;
  insurer: string;
  product: string;
  kind: string;
  premium: number | null;
  cycle: string | null;
  start: string;
  end: string | null;
};

const SAMPLE_POLICY_META: SamplePolicy[] = [
  { id: 'demo-p1', member: '본인', insurer: 'DB손해보험', product: '내생애든든종합보험', kind: 'flat_rate', premium: 114_991, cycle: '월납', start: '2014-08-21', end: '2087-08-21' },
  { id: 'demo-p2', member: '본인', insurer: '현대해상', product: '참좋은실손의료비보험', kind: 'actual_loss', premium: 31_420, cycle: '월납', start: '2016-05-30', end: '2031-05-30' },
  { id: 'demo-p3', member: '본인', insurer: '삼성화재', product: '우리집안심보험', kind: 'property', premium: 18_300, cycle: '월납', start: '2024-01-01', end: null },
  { id: 'demo-p4', member: '배우자', insurer: '한화손해보험', product: '행복한가족종합보험', kind: 'flat_rate', premium: 96_500, cycle: '월납', start: '2018-03-12', end: '2078-03-12' },
  { id: 'demo-p5', member: '배우자', insurer: '현대해상', product: '참좋은실손의료비보험', kind: 'actual_loss', premium: 28_700, cycle: '월납', start: '2018-03-12', end: '2033-03-12' },
  { id: 'demo-p6', member: '첫째', insurer: '현대해상', product: '어린이실손의료비보험', kind: 'actual_loss', premium: 12_800, cycle: '월납', start: '2021-06-02', end: '2036-06-02' },
];

export const SAMPLE_POLICIES: PolicyRow[] = SAMPLE_POLICY_META.map((p) => ({
  id: p.id,
  member_name: p.member,
  insured_name: p.member,
  contract_kind: p.kind,
  insurer_name: p.insurer,
  product_name: p.product,
  policy_no: null,
  status: '유지',
  start_date: p.start,
  end_date: p.end,
  premium: p.premium === null ? null : String(p.premium),
  payment_cycle: p.cycle,
  coverage_count: String(SAMPLE_COVERAGE_ROWS.filter((c) => c.policyId === p.id).length),
  terms_doc_count: '0',
}));

export const SAMPLE_COVERAGES: CoverageRow[] = SAMPLE_COVERAGE_ROWS.map((c) => ({
  policy_id: c.policyId,
  category: c.category,
  name: c.name,
  amount: c.amount === null ? null : String(c.amount),
  coverage_status: '정상',
  agreement_type: null,
  confidence: '0.9',
}));

/** 보장 맵 격자. 구성원 × 전체 카테고리를 채운다 — 실제 뷰와 같은 모양이어야 한다. */
export const SAMPLE_MATRIX: MatrixCell[] = SAMPLE_MEMBERS.flatMap((m) =>
  COVERAGE_CATEGORIES.map((category) => {
    const rows = SAMPLE_COVERAGE_ROWS.filter((c) => c.member === m.display_name && c.category === category);
    const total = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    return {
      member_id: m.member_id,
      display_name: m.display_name,
      category,
      category_label: CATEGORY_LABELS[category],
      sort_order: CATEGORY_SORT[category],
      policy_count: String(new Set(rows.map((r) => r.policyId)).size),
      coverage_count: String(rows.length),
      total_amount: String(total),
      needs_review_count: '0',
    } satisfies MatrixCell;
  }),
).sort((a, b) => a.sort_order - b.sort_order);

/** AI 청구 진단이 훑는 후보. 연결 전에도 코칭을 그대로 체험할 수 있어야 한다. */
export const SAMPLE_CANDIDATES: CoverageCandidate[] = SAMPLE_COVERAGE_ROWS.map((c) => {
  const meta = SAMPLE_POLICY_META.find((p) => p.id === c.policyId)!;
  return {
    policyId: c.policyId,
    memberName: c.member,
    insurerName: meta.insurer,
    productName: meta.product,
    category: c.category,
    name: c.name,
    amount: c.amount,
    coverageStatus: '정상',
  };
});

export const SAMPLE_HOUSEHOLD = { id: HOUSEHOLD_ID, name: '예시 가구' };
