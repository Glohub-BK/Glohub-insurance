-- 프로필 사진.
--
-- 파일을 외부 스토리지에 두면 서명 URL 발급·만료·버킷 권한이 또 하나의 실패 지점이 된다.
-- 여기서 받는 건 클라이언트가 정사각으로 잘라 256px 로 줄인 이미지라 수십 KB 다.
-- 그 크기라면 DB 에 두고 라우트 핸들러로 흘려보내는 편이 단순하고, RLS 를 그대로 탄다.
-- 원본은 서버로 보내지 않는다 — 크롭·축소는 기기에서 끝낸다.

create table if not exists member_avatar (
  member_id  uuid primary key references member(id) on delete cascade,
  mime       text not null check (mime in ('image/webp','image/png','image/jpeg')),
  bytes      bytea not null,
  byte_size  integer not null check (byte_size > 0 and byte_size <= 512000),
  width      integer not null check (width between 16 and 1024),
  updated_at timestamptz not null default now()
);

-- 뷰에 컬럼을 더한다. create or replace view 는 뒤에 붙이는 것만 허용하므로 순서를 지킨다.
-- 화면은 이 값을 사진 URL 의 캐시 버스터로 쓴다. 사진 자체는 뷰에 싣지 않는다 —
-- 구성원 목록을 읽을 때마다 이미지 바이트까지 딸려오면 안 된다.
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
  m.guardian_consent_at,
  a.updated_at        as avatar_updated_at
from member m
left join lateral (
  select * from sync_run r
  where r.member_id = m.id
  order by r.requested_at desc
  limit 1
) s on true
left join member_avatar a on a.member_id = m.id;
