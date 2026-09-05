import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentHousehold } from '@/lib/repo/household';
import { parseNewMemberInput } from '@/lib/domain/family-attribution';

/**
 * 가족 구성원 등록 — 인증 없는 등록이다.
 *
 * 미성년 자녀는 계약자가 될 수 없고 신정원 계정도 사실상 못 만들므로 로그인이
 * 필요 없다. 이름·관계만 등록하면 부모 계약의 피보험자명 매칭으로 보장이 자동
 * 귀속된다 (family-attribution.ts). 성인(배우자·부모)도 먼저 등록해 두면
 * 피보험자 매칭 분은 즉시 보이고, 본인이 계약자인 보험은 본인 인증 뒤에 합쳐진다.
 *
 * 주민등록번호·생년월일은 받지 않는다. 저장하는 것은 표시 이름과 관계뿐이다.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseNewMemberInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const household = await getCurrentHousehold().catch(() => null);
  if (!household) {
    return NextResponse.json(
      { error: '먼저 본인 보험을 한 번 연결해주세요. 가구가 만들어진 뒤에 가족을 추가할 수 있어요.' },
      { status: 409 },
    );
  }

  const { displayName, relation, isMinor } = parsed.value;

  // 같은 이름이 이미 있으면 새로 만들지 않는다 — 피보험자명 매칭이 이름 기준이라
  // 동명 구성원이 둘이면 귀속이 갈라진다.
  const existing = await query<{ id: string }>(
    `select id from member where household_id = $1 and display_name = $2 limit 1`,
    [household.id, displayName],
  );
  if (existing[0]) {
    return NextResponse.json({ memberId: existing[0].id, duplicate: true });
  }

  const [created] = await query<{ id: string }>(
    `insert into member (household_id, display_name, relation, is_minor, guardian_consent_at)
     values ($1, $2, $3, $4, case when $4 then now() else null end)
     returning id`,
    [household.id, displayName, relation, isMinor],
  );
  return NextResponse.json({ memberId: created.id, duplicate: false });
}
