import { query } from '../db';
import type { CodefEnvironment } from '../codef/types';
import type { ConnectFailure } from './errors';

/**
 * 실데이터 환경 안전장치.
 *
 * 데모 키는 켜는 순간 한 달짜리 시계가 돌기 시작하고 하루 100건 제한이 걸린다.
 * 정식 키는 호출당 과금된다. 실수로 한 번 누르는 것과 예산이 새는 것 사이에
 * 사람이 명시적으로 켠 스위치(CODEF_ALLOW_LIVE)와 하루 한도 두 개를 둔다.
 *
 * 샌드박스는 고정 응답이라 제한하지 않는다 — 마음껏 눌러도 된다.
 */
export const DEFAULT_DAILY_LIMIT = 100;

export function isLive(environment: CodefEnvironment): boolean {
  return environment !== 'sandbox';
}

export function dailyLimit(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.CODEF_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_DAILY_LIMIT;
}

export function isLiveAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CODEF_ALLOW_LIVE === 'true';
}

/** 오늘(서버 시각 기준) 실제로 대상기관까지 나간 조회 건수. */
export async function countTodayRuns(
  environment: CodefEnvironment,
  run: typeof query = query,
): Promise<number> {
  const rows = await run<{ n: string }>(
    // 컬럼명은 requested_at 이다. started_at 이 아니다 — 실제 DB 에 붙여보지 않아
    // 한 번 틀렸고, 그 사이 한도 계산이 통째로 죽어 있었다.
    `select count(*)::text as n
       from sync_run
      where environment = $1
        and requested_at >= date_trunc('day', now())`,
    [environment],
  );
  // pg 는 count 를 문자열로 준다. 그대로 비교하면 '100' < 100 이 false 가 되어 한도가 새어나간다.
  return Number(rows[0]?.n ?? 0);
}

export type GuardResult = { ok: true } | { ok: false; failure: ConnectFailure };

export async function checkLiveGuard(
  environment: CodefEnvironment,
  deps: { env?: NodeJS.ProcessEnv; count?: () => Promise<number> } = {},
): Promise<GuardResult> {
  if (!isLive(environment)) return { ok: true };

  const env = deps.env ?? process.env;
  if (!isLiveAllowed(env)) {
    return {
      ok: false,
      failure: {
        code: 'LIVE_NOT_ALLOWED',
        message:
          '실데이터 조회가 잠겨 있습니다. 준비가 되면 CODEF_ALLOW_LIVE=true 로 직접 열어주세요.',
        fixable: false,
      },
    };
  }

  const limit = dailyLimit(env);
  const used = deps.count ? await deps.count() : await countTodayRuns(environment);
  if (used >= limit) {
    return {
      ok: false,
      failure: {
        code: 'DAILY_LIMIT',
        message: `오늘 조회 한도(${limit}건)를 모두 썼습니다. 내일 다시 시도해주세요.`,
        fixable: false,
      },
    };
  }

  return { ok: true };
}
