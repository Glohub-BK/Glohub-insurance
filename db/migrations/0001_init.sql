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
