-- 약관 조항 저장.
--
-- 지금 AI 청구 화면이 보여주는 약관 문구는 규칙 파일에 하드코딩된 "예시"다.
-- 실제 가입 상품의 약관은 상품마다 다르므로, 사용자가 받은 약관 파일에서 조항을
-- 뽑아 이 표에 넣고 화면은 그것을 우선 인용한다.
--
-- 원문을 그대로 보관하는 이유: 요약하면 인용이 아니라 우리 해석이 된다.
-- 판단 근거는 원문이어야 하고, 출처(어느 문서 몇 조)를 항상 함께 보여준다.

alter table document add column if not exists insurer_name text;
alter table document add column if not exists product_name text;
alter table document add column if not exists effective_on date;
alter table document add column if not exists content_hash text;

-- 같은 약관을 두 번 넣으면 조항이 중복된다. 파일 해시로 막는다.
create unique index if not exists document_content_hash_idx
  on document(content_hash) where content_hash is not null;

create table if not exists term_clause (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references document(id) on delete cascade,
  ord           int  not null,               -- 문서 내 순서
  article_no    int,                         -- 제N조의 N. 부칙 등 번호가 없으면 null
  article_label text not null,               -- '제5조' 처럼 화면에 그대로 쓰는 라벨
  title         text,                        -- 조 제목 (괄호 안)
  body          text not null,               -- 조항 원문
  created_at    timestamptz not null default now()
);

create index if not exists term_clause_document_idx on term_clause(document_id);

-- 조항 검색은 본문 부분일치로 한다. 한국어 형태소 사전이 없어도 동작해야 하기 때문이다.
-- pg_trgm 은 Supabase 에 기본 포함되어 있고, 없으면 인덱스 없이도 동작한다(느릴 뿐).
create extension if not exists "pg_trgm";
create index if not exists term_clause_body_idx on term_clause using gin (body gin_trgm_ops);
