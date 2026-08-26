import { describe, expect, it } from 'vitest';
import { checkLiveGuard, dailyLimit, isLive, isLiveAllowed } from '../src/lib/connect/live-guard';

/**
 * 데모 키는 켜는 순간 한 달 시계가 돌고 하루 100건이 끝이다.
 * 실수 한 번으로 그 예산이 새지 않도록 두 겹으로 막는다.
 */
/** NODE_ENV 까지 갖춘 완전한 환경을 만들 필요는 없다. 읽는 키만 넣는다. */
const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe('실데이터 안전장치', () => {
  it('샌드박스는 막지 않는다', async () => {
    expect(isLive('sandbox')).toBe(false);
    const r = await checkLiveGuard('sandbox', { env: env({}) });
    expect(r.ok).toBe(true);
  });

  it('스위치를 켜지 않으면 데모·정식 조회를 거부한다', async () => {
    const r = await checkLiveGuard('demo', { env: env({}) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.code).toBe('LIVE_NOT_ALLOWED');
  });

  it('스위치를 켜면 통과한다', async () => {
    const e = env({ CODEF_ALLOW_LIVE: 'true' });
    expect(isLiveAllowed(e)).toBe(true);
    const r = await checkLiveGuard('demo', { env: e, count: async () => 0 });
    expect(r.ok).toBe(true);
  });

  it('하루 한도를 채우면 막는다 — 경계에서 한 건 더 나가면 안 된다', async () => {
    const e = env({ CODEF_ALLOW_LIVE: 'true', CODEF_DAILY_LIMIT: '3' });
    expect(dailyLimit(e)).toBe(3);
    expect((await checkLiveGuard('demo', { env: e, count: async () => 2 })).ok).toBe(true);
    const full = await checkLiveGuard('demo', { env: e, count: async () => 3 });
    expect(full.ok).toBe(false);
    if (full.ok) return;
    expect(full.failure.code).toBe('DAILY_LIMIT');
    expect(full.failure.message).toContain('3건');
  });

  it('한도 설정이 이상하면 기본값 100 을 쓴다', () => {
    expect(dailyLimit(env({ CODEF_DAILY_LIMIT: '0' }))).toBe(100);
    expect(dailyLimit(env({ CODEF_DAILY_LIMIT: 'abc' }))).toBe(100);
  });

  it('정식 환경도 실데이터로 본다', () => {
    expect(isLive('api')).toBe(true);
    expect(isLive('demo')).toBe(true);
  });
});
