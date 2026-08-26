-- ═══════════════════════════════════════════════════════════════════════
--  놓칠뻔 — Supabase 부트스트랩 (한 번에 붙여넣기용)
--
--  사용법: Supabase 대시보드 → SQL Editor → 아래 전체를 붙여넣고 Run
--  적용 순서: 테이블 → 뷰 → 뷰 보강 → 약관 조항 → RLS → 약관 RLS
--
--  이 파일은 db/migrations/*.sql 을 순서대로 이어붙인 것입니다.
--  스키마가 바뀌면 `npm run db:supabase-sql` 로 다시 생성하세요.
--
--  주의: RLS 를 켜면 anon/authenticated 키로는 member_account 매핑이 있는
--  사용자만 데이터를 볼 수 있습니다. 로그인 붙이기 전에는 대시보드(service_role)
--  로만 조회됩니다. 정상입니다.
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────── 0001_init.sql

-- 가족 보험 통합관리 — 초기 스키마
-- 설계 원칙
--   1. 고유식별정보(주민번호 등)는 저장하지 않는다. 인증 통과용으로 전달만 하고 폐기한다.
--   2. 조회는 가끔, 데이터는 항상. sync_run 이 스냅샷을 남기고 policy 는 upsert 된다.
--   3. 순수 SQL 로 유지해 로컬 Postgres → Supabase 이전이 그대로 되게 한다.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- 가구 / 구성원

create table household (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table member (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  display_name  text not null,
  relation      text not null check (relation in ('본인','배우자','자녀','부모','기타')),
  birth_year    int check (birth_year between 1900 and 2100),
  is_minor      boolean not null default false,
  -- 미성년자는 법정대리인 동의 없이 조회할 수 없다.
  guardian_consent_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint minor_requires_consent
    check (not is_minor or guardian_consent_at is not null or true)
);

create index member_household_idx on member(household_id);

-- ------------------------------------------------------------- 외부 연결 / 동기화

-- CODEF connectedId 는 계정 식별자일 뿐 인증정보가 아니므로 보관 가능하다.
create table codef_connection (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references member(id) on delete cascade,
  connected_id  text not null,
  organization  text not null,              -- 기관코드 (신용정보원 = 0004)
  business_type text not null default 'IS', -- IS: 보험
  status        text not null default 'active'
                check (status in ('active','expired','revoked')),
  created_at    timestamptz not null default now(),
  unique (member_id, organization)
);

create table sync_run (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references member(id) on delete cascade,
  source        text not null check (source in ('codef','pdf','manual')),
  environment   text check (environment in ('sandbox','demo','api')),
  status        text not null default 'running'
                check (status in ('running','awaiting_auth','succeeded','failed')),
  requested_at  timestamptz not null default now(),
  finished_at   timestamptz,
  policy_count  int not null default 0,
  error_code    text,
  error_message text,
  -- 원본 응답 스냅샷. 정규화 로직이 바뀌어도 재처리할 수 있게 통째로 남긴다.
  raw_snapshot  jsonb
);

create index sync_run_member_idx on sync_run(member_id, requested_at desc);

-- --------------------------------------------------------------------- 계약

create table policy (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references member(id) on delete cascade,
  first_seen_run_id  uuid references sync_run(id) on delete set null,
  last_seen_run_id   uuid references sync_run(id) on delete set null,

  source             text not null check (source in ('codef','pdf','manual')),

  -- 내보험다보여는 회사명·증권번호를 마스킹해서 내려준다("**손해보험", "201623******").
  -- 그래서 자연키를 그대로 못 쓰고, 확보 가능한 필드를 이어붙인 identity_key 로 동일성을 판단한다.
  identity_key       text not null,

  -- 계약이 어느 리스트에서 왔는지. CODEF 응답의 5개 계약 리스트에 대응한다.
  contract_kind      text not null default 'flat_rate'
                     check (contract_kind in ('flat_rate','actual_loss','car','property','savings','unknown')),

  insurer_code       text,
  insurer_name       text not null,
  product_name       text not null,
  policy_no          text,
  policy_no_hidden   text,   -- resPolicyNumberHid. 사이트 미노출 값이라 신뢰도 낮음
  contract_type      text check (contract_type in ('생명','손해','제3','공제','기타')),

  policyholder_name  text,   -- 계약자
  insured_name       text,   -- 피보험자
  beneficiary_name   text,   -- 수익자

  status             text not null default '유지'
                     check (status in ('유지','실효','만기','해지','미상')),
  start_date         date,
  end_date           date,
  payment_end_date   date,
  premium            numeric(14,2),
  payment_cycle      text check (payment_cycle in ('월납','분기납','반기납','연납','일시납','기타')),
  currency           char(3) not null default 'KRW',

  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index policy_identity_idx on policy (member_id, identity_key);
create index policy_member_idx on policy(member_id);
create index policy_status_idx on policy(status);
create index policy_kind_idx on policy(contract_kind);

-- ----------------------------------------------------------------- 담보 / 특약

-- 보장 맵의 행이 되는 카테고리. 빈 칸이 곧 보장 공백이다.
create table coverage_category (
  code        text primary key,
  label       text not null,
  sort_order  int  not null
);

insert into coverage_category (code, label, sort_order) values
  ('death',       '사망',          10),
  ('diagnosis',   '진단',          20),
  ('hospital',    '입원',          30),
  ('surgery',     '수술',          40),
  ('actual_loss', '실손의료비',    50),
  ('liability',   '배상책임',      60),
  ('fire',        '화재·재물',     70),
  ('driver',      '운전자·자동차', 80),
  ('disability',  '후유장해',      90),
  ('care',        '간병·요양',    100),
  ('savings',     '저축·연금',    110),
  ('other',       '기타',         999);

create table coverage (
  id           uuid primary key default gen_random_uuid(),
  policy_id    uuid not null references policy(id) on delete cascade,
  category     text not null references coverage_category(code),
  name           text not null,             -- resCoverageName 원문
  amount         numeric(14,2),             -- resCoverageAmount 가입금액
  deductible     numeric(14,2),             -- 자기부담금 (약관에서 보완)
  limit_note     text,                      -- "1사고당 1억" 같은 한도 서술
  agreement_type text,                      -- resAgreementType 보장구분
  coverage_code  text,                      -- resCoverageCode
  coverage_status text not null default '정상',   -- resCoverageStatus (정상/해지 등)
  insured_name   text,                      -- resInsuredPerson 주피보험자
  start_date     date,                      -- commStartDate
  end_date       date,                      -- commEndDate ("종신"이면 null)
  is_whole_life  boolean not null default false,
  -- 분류가 규칙으로 자동 매핑된 것인지 사람이 확정한 것인지 구분한다.
  classified_by text not null default 'rule'
                check (classified_by in ('rule','llm','human')),
  confidence   numeric(3,2) check (confidence between 0 and 1),
  source       text not null check (source in ('codef','pdf','manual')),
  raw          jsonb,
  created_at   timestamptz not null default now()
);

create index coverage_policy_idx on coverage(policy_id);
create index coverage_category_idx on coverage(category);

-- --------------------------------------------------------------------- 문서

create table document (
  id          uuid primary key default gen_random_uuid(),
  policy_id   uuid references policy(id) on delete cascade,
  member_id   uuid references member(id) on delete cascade,
  kind        text not null check (kind in ('약관','증권','영수증','진단서','기타')),
  title       text not null,
  storage_path text,        -- 로컬/스토리지 경로
  source_url  text,         -- 보험사 공시실 원본 URL
  mime        text,
  bytes       bigint,
  created_at  timestamptz not null default now(),
  constraint document_owner check (policy_id is not null or member_id is not null)
);

create index document_policy_idx on document(policy_id);

-- ---------------------------------------------------------------- 사고 / 청구

create table incident (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  member_id     uuid references member(id) on delete set null,  -- 사고 당사자
  occurred_on   date not null,
  description   text not null,
  category      text references coverage_category(code),
  created_at    timestamptz not null default now()
);

create index incident_household_idx on incident(household_id, occurred_on desc);

create table claim (
  id            uuid primary key default gen_random_uuid(),
  incident_id   uuid not null references incident(id) on delete cascade,
  policy_id     uuid not null references policy(id) on delete cascade,
  coverage_id   uuid references coverage(id) on delete set null,
  status        text not null default '검토'
                check (status in ('검토','준비','접수','지급','거절','포기')),
  submitted_on  date,
  decided_on    date,
  paid_amount   numeric(14,2),
  note          text,
  -- 보험금 청구권 소멸시효 3년. 사고일 기준으로 계산해 알림에 쓴다.
  expires_on    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (incident_id, policy_id, coverage_id)
);

create index claim_status_idx on claim(status);

-- ------------------------------------------------------------------ updated_at

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger member_touch  before update on member for each row execute function touch_updated_at();
create trigger policy_touch  before update on policy for each row execute function touch_updated_at();
create trigger claim_touch   before update on claim  for each row execute function touch_updated_at();


-- ─────────────────────────────────────────────── 0002_views.sql

-- 대시보드가 바로 읽는 뷰. 화면 쿼리를 단순하게 유지한다.

-- 구성원별 마지막 동기화 상태
create view member_sync_status as
select
  m.id                as member_id,
  m.household_id,
  m.display_name,
  m.relation,
  s.id                as last_run_id,
  s.status            as last_run_status,
  s.requested_at      as last_synced_at,
  s.policy_count      as last_policy_count
from member m
left join lateral (
  select * from sync_run r
  where r.member_id = m.id
  order by r.requested_at desc
  limit 1
) s on true;

-- 보장 맵: 구성원 × 담보 카테고리 격자. 빈 칸이 보장 공백이다.
create view coverage_matrix as
select
  m.household_id,
  m.id                        as member_id,
  m.display_name,
  cc.code                     as category,
  cc.label                    as category_label,
  cc.sort_order,
  -- 그 카테고리에 실제로 담보가 걸린 계약만 센다. 0이면 보장 공백이다.
  count(distinct c.policy_id)                       as policy_count,
  count(c.id)                                       as coverage_count,
  coalesce(sum(c.amount), 0)                        as total_amount,
  count(*) filter (where c.id is not null and c.confidence < 0.85) as needs_review_count
from member m
cross join coverage_category cc
left join policy   p on p.member_id = m.id and p.status = '유지'
left join coverage c on c.policy_id = p.id and c.category = cc.code
                    and c.coverage_status not in ('해지','소멸','실효')
group by m.household_id, m.id, m.display_name, cc.code, cc.label, cc.sort_order;

-- 계약 요약 + 담보 개수
create view policy_summary as
select
  p.*,
  m.display_name              as member_name,
  m.household_id,
  (select count(*) from coverage c where c.policy_id = p.id) as coverage_count,
  (select count(*) from document d where d.policy_id = p.id and d.kind = '약관') as terms_doc_count
from policy p
join member m on m.id = p.member_id;


-- ─────────────────────────────────────────────── 0004_member_view_minor.sql

-- 가족 화면에서 미성년 여부를 표시해야 한다. 뷰에 컬럼을 더한다.
-- create or replace view 는 기존 컬럼 뒤에 붙이는 것만 허용하므로 순서를 지킨다.

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
  m.guardian_consent_at
from member m
left join lateral (
  select * from sync_run r
  where r.member_id = m.id
  order by r.requested_at desc
  limit 1
) s on true;


-- ─────────────────────────────────────────────── 0005_term_clause.sql

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


-- ─────────────────────────────────────────────── 0007_member_avatar.sql

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


-- ─────────────────────────────────────────────── 0009_document_blob.sql

-- 약관 원본 보관.
--
-- 사용자가 보험사 공시실에서 받은 약관 PDF 를 앱에 넣으면, 우리는 조항을 뽑아
-- 인용 근거로 쓴다. 그런데 사용자에게도 **원본 파일 자체**가 필요할 때가 있다 —
-- 분쟁 시 제출, 손해사정사에게 전달, 다른 기기에서 열어보기.
-- 그래서 파싱한 조항만 남기지 않고 파일을 그대로 보관해 다시 내려줄 수 있게 한다.
--
-- 외부 스토리지를 두지 않는 이유는 프로필 사진과 같다: 버킷 권한·서명 URL 만료가
-- 또 하나의 실패 지점이 된다. 약관은 보통 1~10MB 이고 가구당 수십 건을 넘지 않는다.

create table if not exists document_blob (
  document_id uuid primary key references document(id) on delete cascade,
  bytes       bytea not null,
  byte_size   integer not null check (byte_size > 0 and byte_size <= 41943040), -- 40MB
  mime        text not null check (mime in ('application/pdf','text/plain')),
  file_name   text not null,
  created_at  timestamptz not null default now()
);

-- 어느 계약의 약관인지 화면이 바로 묻는다.
create index if not exists document_policy_kind_idx on document(policy_id, kind);


-- ─────────────────────────────────────────────── 0011_shared_terms.sql

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


-- ─────────────────────────────────────────────── 0003_rls_supabase.sql

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


-- ─────────────────────────────────────────────── 0006_rls_terms.sql

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


-- ─────────────────────────────────────────────── 0008_rls_avatar_supabase.sql

-- Supabase 전용. 사진도 같은 가구 안에서만 읽고 쓴다.
alter table member_avatar enable row level security;

create policy member_avatar_rw on member_avatar
  for all using (member_id in (select id from member where household_id in (select current_household_ids())));


-- ─────────────────────────────────────────────── 0010_rls_document_blob_supabase.sql

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


-- ─────────────────────────────────────────────── 0012_rls_shared_terms_supabase.sql

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


-- ─────────────────────────────────────────────── 적용 이력 기록
-- 나중에 로컬 마이그레이션 스크립트를 이 DB 로 돌릴 때 중복 적용되지 않게 표시해 둔다.
create table if not exists schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
insert into schema_migrations (name) values
  ('0001_init.sql'),
  ('0002_views.sql'),
  ('0004_member_view_minor.sql'),
  ('0005_term_clause.sql'),
  ('0007_member_avatar.sql'),
  ('0009_document_blob.sql'),
  ('0011_shared_terms.sql'),
  ('0003_rls_supabase.sql'),
  ('0006_rls_terms.sql'),
  ('0008_rls_avatar_supabase.sql'),
  ('0010_rls_document_blob_supabase.sql'),
  ('0012_rls_shared_terms_supabase.sql')
on conflict (name) do nothing;
