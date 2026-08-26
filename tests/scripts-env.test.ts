import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 스크립트는 반드시 scripts/load-env 를 써야 한다.
 *
 * `dotenv/config` 는 .env 만 읽는다. .env.local 에 CODEF_ENV=demo 를 넣어도
 * 스크립트는 sandbox 로 보이고, 사용자는 "왜 안 바뀌지"를 혼자 헤매게 된다.
 * 실제로 그렇게 한 번 헤맸다.
 */
describe('스크립트 환경변수 로딩', () => {
  const files = readdirSync('scripts').filter((f) => f.endsWith('.ts') && f !== 'load-env.ts');

  it('dotenv/config 를 직접 가져오는 스크립트가 없다', () => {
    const offenders = files.filter((f) =>
      readFileSync(`scripts/${f}`, 'utf8').includes("'dotenv/config'"),
    );
    expect(offenders).toEqual([]);
  });

  it('환경변수를 읽는 스크립트는 load-env 를 먼저 가져온다', () => {
    const needsEnv = files.filter((f) => {
      const src = readFileSync(`scripts/${f}`, 'utf8');
      return src.includes('process.env') || src.includes('DATABASE_URL') || src.includes('CODEF_');
    });
    for (const f of needsEnv) {
      expect(readFileSync(`scripts/${f}`, 'utf8')).toContain("./load-env");
    }
  });
});
