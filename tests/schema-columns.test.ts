import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * SQL 이 존재하지 않는 컬럼을 참조하면 타입 검사도 테스트도 잡아주지 않는다.
 * 실제로 sync_run 을 started_at 으로 조회해 하루 한도 계산이 통째로 죽어 있었다
 * (컬럼명은 requested_at). DB 없이 돌릴 수 있는 최소한의 방어선을 둔다.
 */
const SCHEMA = readFileSync('db/migrations/0001_init.sql', 'utf8');

function columnsOf(table: string): string[] {
  const m = SCHEMA.match(new RegExp(`create table ${table} \\(([\\s\\S]*?)\\n\\);`));
  if (!m) throw new Error(`${table} 정의를 찾지 못했습니다`);
  return m[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('--') && !line.startsWith('constraint'))
    .map((line) => line.split(/\s+/)[0])
    .filter((name) => /^[a-z_]+$/.test(name));
}

describe('SQL 이 참조하는 컬럼', () => {
  it('sync_run 에 requested_at 이 있다 (started_at 이 아니다)', () => {
    const cols = columnsOf('sync_run');
    expect(cols).toContain('requested_at');
    expect(cols).not.toContain('started_at');
  });

  it('하루 한도 쿼리가 실재하는 컬럼만 쓴다', () => {
    const src = readFileSync('src/lib/connect/live-guard.ts', 'utf8');
    const query = src.slice(src.indexOf('from sync_run'), src.indexOf('[environment]'));
    const cols = columnsOf('sync_run');
    // where 절에서 비교 대상이 되는 좌변 식별자를 뽑는다.
    const used = [...query.matchAll(/\b([a-z_]+)\s*(?:=|>=|<=|>|<)\s*/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const col of used) expect(cols).toContain(col);
  });

  it('데이터 출처 조회도 실재하는 컬럼만 쓴다', () => {
    const src = readFileSync('src/lib/repo/view-data.ts', 'utf8');
    const query = src.slice(src.indexOf('from sync_run r'), src.indexOf('[householdId]'));
    const cols = columnsOf('sync_run');
    const used = [...query.matchAll(/\br\.([a-z_]+)/g)].map((m) => m[1]);
    expect(used).toContain('requested_at');
    for (const col of used) expect(cols).toContain(col);
  });

  it('저장 코드가 쓰는 컬럼도 실재한다 — insert 문 전부', () => {
    const src = readFileSync('src/lib/repo/sync.ts', 'utf8');
    const cols = columnsOf('sync_run');
    const inserts = [...src.matchAll(/insert into sync_run \(([^)]*)\)/g)];
    expect(inserts.length).toBeGreaterThan(0);
    for (const [, list] of inserts) {
      const used = list.split(/[,\s]+/).filter(Boolean);
      expect(used).toContain('member_id');
      for (const col of used) expect(cols).toContain(col);
    }
  });
});
