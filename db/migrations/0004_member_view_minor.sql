-- 가족 화면에서 미성년 여부를 표시해야 한다. 뷰에 컬럼을 더한다.
-- create or replace view 는 기존 컬럼 뒤에 붙이는 것만 허용하므로 순서를 지킨다.

create or replace view member_sync_status as
select
  m.id                as member_id,
  m.household_id,
  m.display_name,
  m.relation,
  s.id                as last_run_id,
  s.status            as last_run_status,
  s.requested_at      as last_synced_at,
  s.policy_count      as last_policy_count,
  m.is_minor,
  m.guardian_consent_at
from member m
left join lateral (
  select * from sync_run r
  where r.member_id = m.id
  order by r.requested_at desc
  limit 1
) s on true;
