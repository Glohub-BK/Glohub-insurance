/**
 * db/migrations/*.sql 을 파일명 순서대로 적용한다.
 * 적용 이력은 schema_migrations 테이블에 남으므로 재실행해도 안전하다.
 *
 *   npm run db:migrate            # _supabase 접미 파일은 건너뜀
 *   npm run db:migrate -- --all   # 전부 적용 (Supabase 대상)
 */
import './load-env';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { sslOptionsFor } from '../src/lib/db';

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');
const includeSupabase = process.argv.includes('--all');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL 이 필요합니다.');

  const client = new Client({
    connectionString,
    ssl: sslOptionsFor(connectionString, process.env.DATABASE_CA_CERT),
  });
  await client.connect();

  await client.query(`
    create table if not exists schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await client.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => includeSupabase || !f.includes('_supabase'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`  applying ${file} ... `);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      count += 1;
      process.stdout.write('ok\n');
    } catch (err) {
      await client.query('rollback');
      process.stdout.write('실패\n');
      throw err;
    }
  }

  await client.end();
  console.log(count === 0 ? '변경 없음 — 이미 최신입니다.' : `${count}개 마이그레이션 적용 완료.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
