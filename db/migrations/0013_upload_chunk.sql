-- 큰 약관 PDF 를 조각으로 받는 임시 보관함.
--
-- Vercel 서버리스는 요청 본문을 4.5MB 로 자른다. KB 약관처럼 그보다 큰 PDF 는
-- 한 번에 못 올라온다 — 실제로 413 이 다섯 번 찍힌 뒤에 만든 테이블이다.
-- 클라이언트가 3MB 조각으로 나눠 넣고, 마지막 요청이 이어붙여 문서로 저장한 뒤
-- 조각을 지운다. 오래 남은 조각은 다음 업로드가 치운다.
create table if not exists upload_chunk (
  upload_id  uuid        not null,
  seq        int         not null,
  bytes      bytea       not null,
  created_at timestamptz not null default now(),
  primary key (upload_id, seq)
);
