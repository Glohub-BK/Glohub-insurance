-- 약관 조항 RLS.
--
-- 0005 는 0003(RLS)보다 먼저 실행되므로 그 안에서 current_household_ids() 를 쓸 수 없다.
-- 그래서 조항 보호는 여기서 따로 건다. 이 파일을 빼먹으면 term_clause 만 RLS 없이
-- 열려 있게 된다 — 다른 가구의 약관 조항이 읽힌다.
--
-- 조항은 문서에 속하고, 문서 접근 규칙은 이미 document_rw 에 있다. 같은 규칙을
-- 다시 쓰지 않고 문서 소유를 그대로 따라간다.

alter table term_clause enable row level security;

drop policy if exists term_clause_rw on term_clause;
create policy term_clause_rw on term_clause
  for all using (
    document_id in (
      select d.id from document d
       where (d.policy_id is not null and d.policy_id in (
               select p.id from policy p
                where p.member_id in (select id from member where household_id in (select current_household_ids()))))
          or (d.member_id is not null and d.member_id in (
               select id from member where household_id in (select current_household_ids())))
    )
  );
