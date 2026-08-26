-- Supabase 전용.
--
-- 기본 document 정책은 "내 가구의 문서만" 이다. 여기에 **조항 공유용 읽기**를 더한다.
-- 내가 가입한 상품과 product_key 가 같고 share_clauses 인 문서는 읽을 수 있다.
-- 파일 원본(document_blob)에는 이 권한을 주지 않는다 — 조항만 나눈다.

create policy document_shared_read on document
  for select using (
    share_clauses
    and product_key is not null
    and product_key in (
      select p.product_key from policy p
       join member m on m.id = p.member_id
      where m.household_id in (select current_household_ids())
        and p.product_key is not null
    )
  );

create policy term_clause_shared_read on term_clause
  for select using (
    document_id in (select id from document where share_clauses and product_key is not null)
  );
