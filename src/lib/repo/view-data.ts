import { query } from '../db';
import type { CoverageCandidate } from '../domain/incident-match';
import { buildAttributedMatrix } from '../domain/family-attribution';
import {
  getCoverageCandidates,
  getCoverages,
  getMembers,
  getPolicies,
  type CoverageRow,
  type HouseholdRow,
  type MatrixCell,
  type MemberSyncRow,
  type PolicyRow,
} from './dashboard';
import { getCurrentHousehold } from './household';
import {
  SAMPLE_CANDIDATES,
  SAMPLE_COVERAGES,
  SAMPLE_HOUSEHOLD,
  SAMPLE_MATRIX,
  SAMPLE_MEMBERS,
  SAMPLE_POLICIES,
} from '../demo/sample';

/**
 * 화면이 읽는 데이터의 단일 진입점.
 *
 * 이 앱은 로그인 게이트를 앞에 두지 않는다. 처음 온 사람도 홈·보장·AI 청구를
 * 그대로 만져보고 "아 이런 걸 알려주는 앱이구나"를 느낀 뒤에 연결하게 한다.
 * 그래서 연결 전에는 예시 가구를 물려주고, 화면은 mode 를 보고 "예시" 라벨과
 * 연결 유도를 얹는다.
 *
 * mode 'preview' 일 때 화면은 반드시 예시임을 밝혀야 한다. 내 데이터로 오인하면
 * 잘못된 판단으로 이어진다.
 *
 * mode 'error' 는 DB 에 닿지 못한 상태다. 처음에는 이때도 예시로 떨어뜨렸지만,
 * 실데이터를 연결한 뒤에는 그게 배신이 된다 — 어제까지 내 계약을 보던 화면이
 * 말없이 예시 가구로 바뀌면, 오류가 아니라 데이터가 사라진 것으로 읽힌다.
 * 그래서 지금은 실패를 실패라고 말하고 고치는 방법을 안내한다.
 * 예시는 "아직 아무것도 연결하지 않은 사람" 에게만 보여준다.
 */
export type ViewMode = 'live' | 'preview' | 'error';

export type HouseholdView = {
  mode: ViewMode;
  /** 지금 보고 있는 데이터를 어느 환경에서 가져왔는지. 샌드박스면 화면이 밝혀야 한다. */
  dataEnvironment: 'sandbox' | 'demo' | 'api' | null;
  household: HouseholdRow;
  members: MemberSyncRow[];
  matrix: MatrixCell[];
  policies: PolicyRow[];
  coverages: CoverageRow[];
};

const SAMPLE_VIEW: HouseholdView = {
  mode: 'preview',
  dataEnvironment: null,
  household: SAMPLE_HOUSEHOLD,
  members: SAMPLE_MEMBERS,
  matrix: SAMPLE_MATRIX,
  policies: SAMPLE_POLICIES,
  coverages: SAMPLE_COVERAGES,
};

const ERROR_VIEW: HouseholdView = {
  mode: 'error',
  dataEnvironment: null,
  household: { id: '', name: '' },
  members: [],
  matrix: [],
  policies: [],
  coverages: [],
};

const DB_ERROR = Symbol('db-error');

function logDbError(error: unknown): typeof DB_ERROR {
  console.error('[view-data] DB 조회 실패', error);
  return DB_ERROR;
}

export async function getHouseholdView(): Promise<HouseholdView> {
  const household = await getCurrentHousehold().catch(logDbError);
  if (household === DB_ERROR) return ERROR_VIEW;
  if (!household) return SAMPLE_VIEW;

  const loaded = await Promise.all([
    getMembers(household.id),
    getPolicies(household.id),
    getCoverages(household.id),
  ]).catch(logDbError);
  if (loaded === DB_ERROR) return ERROR_VIEW;

  const [members, policies, coverages] = loaded;

  // 가구는 있는데 아직 아무도 인증하지 않은 상태도 미리보기로 본다.
  // 빈 화면을 보여주면 이 앱이 뭘 하는지 알 방법이 없다.
  if (policies.length === 0) return SAMPLE_VIEW;

  // 보장 맵은 SQL 뷰(조회자 귀속)가 아니라 피보험자명 귀속으로 짠다.
  // 계약자 본인 조회에 피보험자=배우자·자녀 계약이 딸려 오기 때문이다.
  const matrix = buildAttributedMatrix(members, policies, coverages);

  const dataEnvironment = await latestEnvironment(household.id).catch(() => null);
  return { mode: 'live', dataEnvironment, household, members, matrix, policies, coverages };
}

/**
 * 가장 최근 성공한 조회의 환경. 여러 환경이 섞여 있으면 최신 것을 따른다 —
 * 샌드박스로 한 번이라도 채웠다면 그 흔적을 지우기 전까지는 밝혀야 한다.
 */
async function latestEnvironment(householdId: string) {
  const rows = await query<{ environment: 'sandbox' | 'demo' | 'api' | null }>(
    `select r.environment
       from sync_run r
       join member m on m.id = r.member_id
      where m.household_id = $1 and r.status = 'succeeded'
      order by r.requested_at desc
      limit 1`,
    [householdId],
  );
  return rows[0]?.environment ?? null;
}

export type CandidateView = { mode: ViewMode; candidates: CoverageCandidate[] };

export async function getCandidateView(): Promise<CandidateView> {
  const household = await getCurrentHousehold().catch(logDbError);
  if (household === DB_ERROR) return { mode: 'error', candidates: [] };
  if (!household) return { mode: 'preview', candidates: SAMPLE_CANDIDATES };

  const rows = await getCoverageCandidates(household.id).catch(logDbError);
  if (rows === DB_ERROR) return { mode: 'error', candidates: [] };
  if (rows.length === 0) return { mode: 'preview', candidates: SAMPLE_CANDIDATES };

  // pg 는 numeric 을 문자열로 준다. 클라이언트로 넘기기 전에 숫자로 맞춘다.
  return {
    mode: 'live',
    candidates: rows.map((r) => ({
      policyId: r.policyId,
      // 청구 화면의 이름표는 피보험자가 맞다 — 계약자(조회자)가 아니라
      // 그 담보로 보장받는 사람. 피보험자명이 없으면 조회자명으로 돌아간다.
      memberName: r.insuredName?.trim() || r.memberName,
      insurerName: r.insurerName,
      productName: r.productName,
      // 이 줄이 빠져 있었다. 계약 종류가 없으면 excludeKinds 가 라이브 데이터에서
      // 전혀 작동하지 않아, 자동차 담보 걸러내기가 이름 정규식에만 매달리게 된다.
      contractKind: r.contractKind,
      category: r.category,
      name: r.name,
      amount: r.amount === null ? null : Number(r.amount),
      coverageStatus: r.coverageStatus,
    })),
  };
}
