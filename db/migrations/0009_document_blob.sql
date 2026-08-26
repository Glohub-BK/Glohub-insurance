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
