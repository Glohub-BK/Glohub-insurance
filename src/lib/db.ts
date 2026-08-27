import { Pool, types } from 'pg';

// pg 는 DATE 를 로컬 타임존 Date 객체로 바꾼다. 그러면 화면에 Date.toString() 이 찍히고,
// 타임존에 따라 하루가 밀린다. 보험 계약일은 시각이 없는 날짜이므로 문자열 그대로 받는다.
const OID_DATE = 1082;
types.setTypeParser(OID_DATE, (value: string) => value);

declare global {
  // 개발 중 HMR 로 풀이 계속 늘어나는 것을 막는다.
  var __insurancePool: Pool | undefined;
}

/**
 * 원격 DB(Supabase 등)는 TLS 가 필수다. 로컬 Postgres 는 TLS 를 안 켜므로 구분해야 한다.
 *
 * 인증서 검증까지 하려면 DATABASE_CA_CERT 에 CA 인증서(PEM)를 넣는다.
 * 없으면 검증 없이 암호화만 한다 — 전송 구간은 암호화되지만 중간자 공격은 막지 못한다.
 * Supabase 대시보드(Settings → Database → SSL Configuration)에서 CA 를 받아 넣으면
 * 검증까지 켜진다.
 */
export function sslOptionsFor(connectionString: string, caCert?: string) {
  let host = '';
  try {
    host = new URL(connectionString).hostname;
  } catch {
    return false as const;
  }
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
  if (isLocal) return false as const;
  if (caCert && caCert.trim().length > 0) {
    return { ca: caCert, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

/**
 * 연결 문자열의 **비밀번호를 뺀** 요약.
 *
 * 배포된 곳의 DATABASE_URL 은 눈으로 볼 수 없다(Vercel Secret 은 저장 후 열람 불가).
 * 그래서 인증 실패가 나면 "무엇이 틀렸는지" 를 확인할 방법이 없어 왕복이 길어진다.
 * 연결 대상만 한 줄로 남겨 그 왕복을 끊는다.
 *
 * ⚠ 비밀번호는 어떤 경우에도 이 문자열에 들어가지 않는다. 로그는 남는다.
 */
export function describeConnection(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return 'DATABASE_URL 을 URL 로 해석하지 못했습니다 — 형식을 확인하세요';
  }
  const user = safeDecode(url.username) || '(없음)';
  const database = url.pathname.replace(/^\//, '') || '(없음)';
  const port = url.port || '(기본값)';
  return `user=${user} host=${url.hostname} port=${port} db=${database}`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Supabase 는 pooler 로 붙을 때 사용자명이 `postgres.<프로젝트ref>` 여야 한다.
 * 그냥 `postgres` 로 보내면 비밀번호가 맞아도 28P01 로 떨어진다 —
 * Direct connection 문자열을 그대로 붙여넣었을 때 생기는 일이라 흔하다.
 */
export function poolerUserLooksWrong(connectionString: string): boolean {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return false;
  }
  if (!url.hostname.includes('pooler.supabase.com')) return false;
  return !safeDecode(url.username).includes('.');
}

export function getPool(): Pool {
  if (!globalThis.__insurancePool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL 이 설정되지 않았습니다. .env.local 을 확인하세요.');
    }
    // 서버리스(Vercel)에서는 요청마다 다른 인스턴스가 뜨고, 인스턴스마다 풀이 하나씩
    // 생긴다. max 를 5로 두면 동시 요청 20건에 연결 100개가 열려 Supabase 상한을
    // 넘긴다. 그래서 서버리스에서는 인스턴스당 1개만 쓰고, 놀고 있는 연결은 빨리 놓는다.
    // (DATABASE_URL 은 Supabase Transaction pooler — 포트 6543 — 를 가리켜야 한다)
    const serverless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

    // 인스턴스당 한 번만 찍힌다. 비밀번호는 들어가지 않는다.
    console.info('[db] 연결 대상', describeConnection(connectionString));
    if (poolerUserLooksWrong(connectionString)) {
      console.error(
        '[db] pooler 주소인데 사용자명에 프로젝트 ref 가 없습니다. ' +
          'Supabase Connect → Transaction pooler 의 문자열을 쓰세요 (postgres.<프로젝트ref> 형식).',
      );
    }

    globalThis.__insurancePool = new Pool({
      connectionString,
      max: serverless ? 1 : 5,
      idleTimeoutMillis: serverless ? 10_000 : 30_000,
      ssl: sslOptionsFor(connectionString, process.env.DATABASE_CA_CERT),
    });
  }
  return globalThis.__insurancePool;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params as unknown[]);
  return result.rows as T[];
}

/** 여러 쓰기를 한 트랜잭션으로 묶는다. 동기화 저장에 쓴다. */
export async function withTransaction<T>(
  fn: (q: <R extends Record<string, unknown>>(text: string, params?: readonly unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const scoped = async <R extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) => {
      const r = await client.query(text, params as unknown[]);
      return r.rows as R[];
    };
    const out = await fn(scoped);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

/** 스크립트에서 풀을 닫는다. 열어두면 프로세스가 끝나지 않는다. */
export async function closePool(): Promise<void> {
  const pool = globalThis.__insurancePool;
  globalThis.__insurancePool = undefined;
  await pool?.end();
}
