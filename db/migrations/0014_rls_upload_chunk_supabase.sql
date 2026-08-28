-- Supabase 전용. 업로드 조각은 서버(라우트 핸들러)만 만진다.
-- 정책을 하나도 만들지 않는다 = 클라이언트 역할(anon/authenticated)은 전부 차단.
alter table upload_chunk enable row level security;
