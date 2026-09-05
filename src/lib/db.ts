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
  // 비밀번호 **길이**만 싣는다.
  //
  // 배포된 곳과 내 PC 의 DATABASE_URL 이 같은 값인지 확인할 방법이 없어서 왕복이 길어진다
  // (Vercel Secret 은 저장 후 열람 불가, 로컬 .env.local 은 서로 보여줄 수 없다).
  // 두 곳의 이 한 줄을 나란히 놓으면 어디가 다른지 바로 보인다 — 실제로
  // "Vercel 은 고쳤는데 .env.local 은 한 글자 빠진 채로 남아 있던" 일이 있었다.
  // 값은 절대 싣지 않는다. 길이는 값이 아니다.
  const pw = url.password ? `${safeDecode(url.password).length}자` : '(없음)';
  return `user=${user} host=${url.hostname} port=${port} db=${database} pw=${pw}`;
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

/**
 * 28P01(password authentication failed) 이 났을 때, **비밀번호를 드러내지 않고**
 * 흔한 원인을 가려낸다.
 *
 * 이 오류는 "비밀번호가 틀렸다" 로만 읽히지만 실제 원인은 여러 갈래다. 그중 몇 가지는
 * 값을 제대로 붙여넣었는데도 발생한다 — URL 문법 때문에 비밀번호가 잘리는 경우다.
 * Supabase 가 만들어주는 비밀번호에는 특수문자가 섞이는데, `#` 와 `?` 는 URL 에서
 * 각각 프래그먼트·쿼리의 시작이라 그 뒤가 통째로 날아간다. 화면에는 아무 표시도
 * 나지 않고, 서버는 짧아진 비밀번호를 받아 28P01 을 돌려준다.
 *
 * ⚠ 반환 문자열에 비밀번호는 어떤 경우에도 들어가지 않는다. 길이(숫자)만 쓴다.
 */
export function diagnoseCredentials(connectionString: string): string | null {
  // 예약문자 검사가 **먼저**다.
  //
  // `#` 나 `?` 가 비밀번호에 있으면 authority 구간이 거기서 끝나버려, 뒤따르는
  // "…@호스트:포트" 가 통째로 프래그먼트/쿼리로 넘어간다. 그러면 URL 파서는
  // 호스트조차 못 읽고 그냥 던진다 — 원인은 비밀번호인데 "형식 오류" 로만 보인다.
  // 그래서 파싱을 시도하기 전에 원문에서 먼저 본다.
  const authorityStart = connectionString.indexOf('://') + 3;
  const slash = connectionString.indexOf('/', authorityStart);
  const authority =
    slash === -1 ? connectionString.slice(authorityStart) : connectionString.slice(authorityStart, slash);
  const at = authority.lastIndexOf('@');
  const userinfo = at === -1 ? '' : authority.slice(0, at);

  const reserved = ['#', '?'].filter((ch) => userinfo.includes(ch));
  if (reserved.length > 0) {
    return (
      `비밀번호에 ${reserved.join(' 와 ')} 가 그대로 들어 있어 뒷부분이 잘립니다. ` +
      'URL 인코딩하세요 (# → %23, ? → %3F). 비밀번호를 바꾸는 게 더 간단할 수도 있습니다.'
    );
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return 'DATABASE_URL 을 URL 로 해석하지 못했습니다 — 따옴표나 줄바꿈이 섞이지 않았는지 보세요.';
  }

  if (poolerUserLooksWrong(connectionString)) {
    return 'pooler 주소인데 사용자명에 프로젝트 ref 가 없습니다 — Direct 문자열을 붙여넣은 경우입니다.';
  }

  const password = safeDecode(url.password);
  if (password.length === 0) {
    return '연결 문자열에 비밀번호가 없습니다 — Supabase 문자열의 [YOUR-PASSWORD] 자리를 채우세요.';
  }
  if (/^[[<].*[\]>]$/.test(password) || password.toUpperCase().includes('YOUR-PASSWORD')) {
    return '비밀번호 자리에 안내용 문구가 그대로 남아 있습니다 (대괄호까지 지우고 실제 값만 넣으세요).';
  }

  // 여기까지 왔으면 형식은 멀쩡하다. 남은 후보를 사람이 좁힐 수 있게 사실만 준다.
  return (
    `형식은 정상입니다 (비밀번호 ${password.length}자). ` +
    '값 자체가 다르거나, Supabase 에서 비밀번호를 재설정했거나, 셸의 DATABASE_URL 이 .env.local 을 덮어쓰고 있을 수 있습니다.'
  );
}

/** 28P01 안내는 인스턴스당 한 번만 남긴다. 매 쿼리마다 찍으면 로그가 덮인다. */
let authHintShown = false;

export function noteAuthFailure(error: unknown): void {
  const code = (error as { code?: string } | null)?.code;
  if (code !== '28P01' || authHintShown) return;
  authHintShown = true;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  console.error('[db] 인증 실패(28P01) 원인 후보 —', diagnoseCredentials(connectionString));
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
  try {
    const result = await getPool().query(text, params as unknown[]);
    return result.rows as T[];
  } catch (error) {
    // 인증 실패는 원인이 여러 갈래다. 값을 드러내지 않고 후보를 좁혀 남긴다.
    noteAuthFailure(error);
    throw error;
  }
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
