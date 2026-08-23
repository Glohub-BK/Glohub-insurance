-- Supabase 로 옮길 때만 적용한다. 로컬 Postgres 에서는 auth 스키마가 없어 실패한다.
-- scripts/migrate.ts 는 파일명에 _supabase 가 붙은 마이그레이션을 기본적으로 건너뛴다.

-- 구성원과 로그인 사용자를 잇는 매핑
create table if not exists member_account (
  member_id uuid primary key references member(id) on delete cascade,
  user_id   uuid not null,
  role      text not null default 'member' check (role in ('owner','member','viewer')),
  created_at timestamptz not null default now()
);

create or replace function current_household_ids() returns setof uuid
language sql stable security definer as $$
  select m.household_id
  from member m
  join member_account ma on ma.member_id = m.id
  where ma.user_id = auth.uid()
$$;

alter table household        enable row level security;
alter table member           enable row level security;
alter table codef_connection enable row level security;
alter table sync_run         enable row level security;
alter table policy           enable row level security;
alter table coverage         enable row level security;
alter table document         enable row level security;
alter table incident         enable row level security;
alter table claim            enable row level security;

create policy household_rw on household
  for all using (id in (select current_household_ids()));

create policy member_rw on member
  for all using (household_id in (select current_household_ids()));

create policy codef_connection_rw on codef_connection
  for all using (member_id in (select id from member where household_id in (select current_household_ids())));

create policy sync_run_rw on sync_run
  for all using (member_id in (select id from member where household_id in (select current_household_ids())));

create policy policy_rw on policy
  for all using (member_id in (select id from member where household_id in (select current_household_ids())));

create policy coverage_rw on coverage
  for all using (policy_id in (select id from policy where member_id in
    (select id from member where household_id in (select current_household_ids()))));

create policy document_rw on document
  for all using (
    (policy_id is not null and policy_id in (select id from policy where member_id in
      (select id from member where household_id in (select current_household_ids()))))
    or (member_id is not null and member_id in
      (select id from member where household_id in (select current_household_ids())))
  );

create policy incident_rw on incident
  for all using (household_id in (select current_household_ids()));

create policy claim_rw on claim
  for all using (incident_id in (select id from incident where household_id in (select current_household_ids())));
