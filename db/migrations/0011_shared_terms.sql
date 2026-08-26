-- 약관을 사용자별이 아니라 **상품별**로 다룬다.
--
-- 「(무)메리츠 올바른 암보험1906」의 약관은 그 상품에 가입한 모든 사람에게 똑같다.
-- 사용자마다 한 번씩 공시실에서 받아 올리게 하면, 같은 파일을 수천 번 다시 넣는 셈이다.
-- 한 사람이 올린 조항을 같은 상품 가입자가 함께 쓰면 대부분의 사용자는 아무것도
-- 하지 않아도 된다 — 그게 이 앱이 하려는 일이다.
--
-- 다만 **PDF 원본 파일은 공유하지 않는다.** 조항 인용(출처를 밝힌 부분 인용)과
-- 파일 사본 배포는 다른 문제다. 원본은 올린 본인만 다시 내려받고, 다른 사람에게는
-- 보험사 공시실 링크를 준다.

alter table document add column if not exists product_key text;

-- 조항을 같은 상품 가입자와 나눌지. 기본은 나눈다.
alter table document add column if not exists share_clauses boolean not null default true;

create index if not exists document_product_key_idx
  on document(product_key) where product_key is not null;

-- 계약 쪽에도 같은 키를 둔다. 조회할 때마다 회사·상품명을 정규화하지 않도록.
alter table policy add column if not exists product_key text;
create index if not exists policy_product_key_idx
  on policy(product_key) where product_key is not null;
