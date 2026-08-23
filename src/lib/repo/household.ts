import { listHouseholds, type HouseholdRow } from './dashboard';

/**
 * 지금은 가구가 하나뿐이다. 로그인이 붙기 전까지 화면들이 같은 방식으로 가구를 고르게
 * 한 곳에 모아둔다. 나중에 세션에서 가구를 읽도록 이 함수만 바꾸면 된다.
 */
export async function getCurrentHousehold(): Promise<HouseholdRow | null> {
  const list = await listHouseholds();
  return list[0] ?? null;
}
