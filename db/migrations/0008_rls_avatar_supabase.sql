-- Supabase 전용. 사진도 같은 가구 안에서만 읽고 쓴다.
alter table member_avatar enable row level security;

create policy member_avatar_rw on member_avatar
  for all using (member_id in (select id from member where household_id in (select current_household_ids())));
