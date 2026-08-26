import { query } from '../db';
import { listHouseholds, type HouseholdRow } from './dashboard';

/**
 * 지금은 가구가 하나뿐이다. 로그인이 붙기 전까지 화면들이 같은 방식으로 가구를 고르게
 * 한 곳에 모아둔다. 나중에 세션에서 가구를 읽도록 이 함수만 바꾸면 된다.
 */
export async function getCurrentHousehold(): Promise<HouseholdRow | null> {
  const list = await listHouseholds();
  return list[0] ?? null;
}

/**
 * 조회 대상 구성원을 찾거나 만든다.
 *
 * 로그인이 붙기 전(S6)까지 가구는 하나뿐이고, 연결하는 사람은 '본인' 이다.
 * 지금은 이 함수가 그 가정을 한 곳에 모아둔다. 로그인이 붙으면 세션에서
 * 가구·구성원을 읽도록 여기만 바꾸면 된다.
 */
export async function ensureMember(
  displayName: string,
  relation: '본인' | '배우자' | '자녀' | '부모' | '기타' = '본인',
): Promise<{ householdId: string; memberId: string }> {
  const household =
    (await getCurrentHousehold()) ??
    (
      await query<HouseholdRow>(
        `insert into household (name) values ($1) returning id, name`,
        ['우리집'],
      )
    )[0];

  const existing = await query<{ id: string }>(
    `select id from member where household_id = $1 and display_name = $2 limit 1`,
    [household.id, displayName],
  );
  if (existing[0]) return { householdId: household.id, memberId: existing[0].id };

  const [created] = await query<{ id: string }>(
    `insert into member (household_id, display_name, relation) values ($1, $2, $3) returning id`,
    [household.id, displayName, relation],
  );
  return { householdId: household.id, memberId: created.id };
}

/**
 * 헤더·탭바가 쓰는 최소 정보. 가구 이름과 '본인' 의 표시 이름·사진 갱신 시각만 읽는다.
 *
 * 레이아웃은 모든 화면에서 실행되므로 계약·담보까지 끌어오면 안 된다. 실패하면 null 을
 * 돌려주고 헤더는 지금까지처럼 가구 이름만 보여준다 — 헤더 때문에 화면이 죽지 않게 한다.
 */
export type SelfBadge = {
  memberId: string;
  displayName: string;
  householdName: string;
  avatarUpdatedAt: string | null;
};

export async function getSelfBadge(): Promise<SelfBadge | null> {
  try {
    const household = await getCurrentHousehold();
    if (!household) return null;
    const rows = await query<{
      member_id: string;
      display_name: string;
      avatar_updated_at: string | null;
    }>(
      `select v.member_id, v.display_name, v.avatar_updated_at
         from member_sync_status v
        where v.household_id = $1
        order by case v.relation when '본인' then 0 else 1 end, v.display_name
        limit 1`,
      [household.id],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      memberId: row.member_id,
      displayName: row.display_name,
      householdName: household.name,
      avatarUpdatedAt: row.avatar_updated_at,
    };
  } catch (error) {
    console.error('[household] 헤더 정보 조회 실패', error);
    return null;
  }
}
