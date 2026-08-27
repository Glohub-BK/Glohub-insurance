import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 배포한 뒤에만 드러나는 사고를 막는 방어선.
 *
 * 여기 걸린 것들은 전부 **로컬에서는 멀쩡하고 Vercel 에서만 깨지는** 종류다.
 * 로컬 테스트로는 잡을 수 없어서 설정 파일을 직접 읽어 확인한다.
 */
describe('서버리스 배포 설정', () => {
  const config = readFileSync('next.config.ts', 'utf8');

  it('pdfjs 를 번들에서 빼되, 함수 번들에는 실어 보낸다', () => {
    // 둘 중 하나만 하면 실패한다.
    // - serverExternalPackages 만: 로컬에서 워커 import 가 깨진다
    // - outputFileTracingIncludes 만: 배포에서 워커 파일이 빠진다
    expect(config).toContain("serverExternalPackages: ['pdfjs-dist']");
    expect(config).toContain('outputFileTracingIncludes');
    expect(config).toContain('pdfjs-dist/legacy/build');
  });

  it('추적에 넣는 경로가 실제로 있는 파일이다', () => {
    // 오타로 경로가 어긋나면 조용히 아무것도 포함되지 않는다.
    expect(() =>
      readFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
    ).not.toThrow();
  });

  it('약관 업로드는 기본 10초 제한을 넘겨 잡는다', () => {
    const route = readFileSync('src/app/api/terms/upload/route.ts', 'utf8');
    const m = route.match(/export const maxDuration = (\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(30);
    // Vercel Hobby 상한이 60초다. 그보다 크게 적으면 배포가 거절된다.
    expect(Number(m![1])).toBeLessThanOrEqual(60);
  });

  it('DB 풀이 서버리스에서 인스턴스당 연결을 줄인다', () => {
    const db = readFileSync('src/lib/db.ts', 'utf8');
    expect(db).toContain('VERCEL');
    expect(db).toContain('serverless ? 1 : 5');
  });
});

describe('배포 문서', () => {
  const readme = readFileSync('README.md', 'utf8');

  it('별도 배포 명령이 없다는 것과 push 로 배포된다는 것을 적는다', () => {
    expect(readme).toContain('## 배포 (Vercel)');
    expect(readme).toContain('별도 배포 명령은 없다');
  });

  it('서버리스는 6543, 로컬 스크립트는 5432 라는 것을 적는다', () => {
    const section = readme.slice(readme.indexOf('## 배포 (Vercel)'));
    expect(section).toContain('6543');
    expect(section).toContain('5432');
  });

  it('마이그레이션이 배포와 별개라는 것을 적는다', () => {
    expect(readme).toContain('마이그레이션은 배포와 별개다');
  });

  it('.env.example 이 두 포트를 모두 안내한다', () => {
    const env = readFileSync('.env.example', 'utf8');
    expect(env).toContain('Transaction pooler (포트 6543)');
    expect(env).toContain('Session pooler  (포트 5432)');
  });
});
