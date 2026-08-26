/**
 * db/migrations/*.sql 을 하나로 이어붙여 db/supabase-bootstrap.sql 을 만든다.
 * Supabase 대시보드 SQL Editor 에 통째로 붙여넣기 위한 파일이다.
 *
 *   npm run db:supabase-sql
 *
 * 순서가 중요하다: 테이블 → 뷰 → 뷰 보강 → RLS.
 * 파일명 순서(0003 RLS 가 0004 보다 앞)와 다르므로 여기서 명시적으로 정한다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORDER = [
  '0001_init.sql',
  '0002_views.sql',
  '0004_member_view_minor.sql',
  '0005_term_clause.sql',
  '0007_member_avatar.sql',
  '0003_rls_supabase.sql',
  '0006_rls_terms.sql',
  '0008_rls_avatar_supabase.sql',
];

const DIR = join(process.cwd(), 'db', 'migrations');
const OUT = join(process.cwd(), 'db', 'supabase-bootstrap.sql');

const HEAD = `-- ═══════════════════════════════════════════════════════════════════════
--  놓칠뻔 — Supabase 부트스트랩 (한 번에 붙여넣기용)
--
--  사용법: Supabase 대시보드 → SQL Editor → 아래 전체를 붙여넣고 Run
--  적용 순서: 테이블 → 뷰 → 뷰 보강 → 약관 조항 → RLS → 약관 RLS
--
--  이 파일은 db/migrations/*.sql 을 순서대로 이어붙인 것입니다.
--  스키마가 바뀌면 \`npm run db:supabase-sql\` 로 다시 생성하세요.
--
--  주의: RLS 를 켜면 anon/authenticated 키로는 member_account 매핑이 있는
--  사용자만 데이터를 볼 수 있습니다. 로그인 붙이기 전에는 대시보드(service_role)
--  로만 조회됩니다. 정상입니다.
-- ═══════════════════════════════════════════════════════════════════════

`;

const TAIL = `
-- ─────────────────────────────────────────────── 적용 이력 기록
-- 나중에 로컬 마이그레이션 스크립트를 이 DB 로 돌릴 때 중복 적용되지 않게 표시해 둔다.
create table if not exists schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
insert into schema_migrations (name) values
${ORDER.map((f) => `  ('${f}')`).join(',\n')}
on conflict (name) do nothing;
`;

const body = ORDER.map(
  (f) => `\n-- ─────────────────────────────────────────────── ${f}\n\n${readFileSync(join(DIR, f), 'utf8')}\n`,
).join('');

writeFileSync(OUT, HEAD + body + TAIL, 'utf8');
console.log(`db/supabase-bootstrap.sql 생성 완료 (${ORDER.length}개 마이그레이션)`);
