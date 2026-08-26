-- Supabase 전용. 약관 원본도 같은 가구 안에서만 읽고 쓴다.
alter table document_blob enable row level security;

create policy document_blob_rw on document_blob
  for all using (
    document_id in (
      select d.id from document d
      where (d.policy_id is not null and d.policy_id in (
              select id from policy where member_id in
                (select id from member where household_id in (select current_household_ids()))))
         or (d.member_id is not null and d.member_id in
              (select id from member where household_id in (select current_household_ids())))
    )
  );
