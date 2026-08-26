/**
 * db/migrations/*.sql 을 파일명 순서대로 적용한다.
 * 적용 이력은 schema_migrations 테이블에 남으므로 재실행해도 안전하다.
 *
 *   npm run db:migrate              # _supabase 접미 파일은 건너뜀
 *   npm run db:migrate -- --all     # 전부 적용 (Supabase 대상)
 *   npm run db:baseline             # 실행하지 않고 "이미 적용됨"으로만 기록
 *
 * --baseline 은 SQL 을 대시보드에서 손으로 이미 돌린 DB 를 이 스크립트에 인계할 때 쓴다.
 * 그냥 migrate 를 돌리면 0001 부터 다시 실행하려다 "relation already exists" 로 죽는다.
 */
import './load-env';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { sslOptionsFor } from '../src/lib/db';

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');
const includeSupabase = process.argv.includes('--all');
const baselineOnly = process.argv.includes('--baseline');

/** 이미 있는 객체를 또 만들려 할 때 Postgres 가 내는 코드들 */
const ALREADY_EXISTS = new Set([
  '42P07', // duplicate_table
  '42710', // duplicate_object
  '42P06', // duplicate_schema
  '42723', // duplicate_function
]);

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

  // --baseline 은 건너뛰기 대상까지 포함해 전부 기록한다.
  // 대시보드에서 손으로 돌릴 때는 보통 RLS 파일까지 같이 돌리기 때문이다.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => baselineOnly || includeSupabase || !f.includes('_supabase'))
    .sort();

  if (baselineOnly) {
    let marked = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      await client.query('insert into schema_migrations (name) values ($1) on conflict do nothing', [file]);
      console.log(`  기록 ${file}`);
      marked += 1;
    }
    await client.end();
    console.log(
      marked === 0
        ? '이미 전부 기록되어 있습니다.'
        : `${marked}개를 "적용됨"으로 기록했습니다. SQL 은 실행하지 않았습니다.`,
    );
    return;
  }

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

      const code = (err as { code?: string }).code;
      if (code && ALREADY_EXISTS.has(code)) {
        console.error(
          `\n${(err as Error).message}\n\n` +
            '이 DB 에는 스키마가 이미 올라가 있는데 적용 이력만 없습니다.\n' +
            '(대시보드 SQL Editor 에서 직접 실행한 경우입니다)\n\n' +
            '  npm run db:baseline\n\n' +
            '을 먼저 돌려 "이미 적용됨"으로 기록한 뒤 다시 시도하세요.',
        );
        await client.end();
        process.exit(1);
      }
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
