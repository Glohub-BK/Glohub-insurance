import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodefError } from '../src/lib/codef/client';
import { toFailure } from '../src/lib/connect/errors';
import { checkThrottle, resetThrottle } from '../src/lib/connect/throttle';
import { continueConnect, currentEnvironment, startConnect } from '../src/lib/connect/service';
import { continueSchema, startSchema } from '../src/lib/connect/schema';

const CREDS = { loginId: 'nochil01', password: 'abcd1234!' };

/** CodefClient 를 흉내내는 최소 구현. 네트워크에 나가지 않는다. */
function fakeClient(behavior: {
  first?: unknown;
  second?: unknown;
  throwOnFirst?: unknown;
}) {
  return {
    requestContractInfo: vi.fn(async () => {
      if (behavior.throwOnFirst) throw behavior.throwOnFirst;
      return behavior.first;
    }),
    continueContractInfo: vi.fn(async () => behavior.second),
  };
}

const TWO_WAY = {
  kind: 'two_way' as const,
  twoWay: {
    jobIndex: 0,
    threadIndex: 1,
    jti: 'abc',
    twoWayTimestamp: 1700000000000,
    continue2Way: true,
    method: 'simpleAuth',
    extraInfo: { reqSecureNo: '1234' },
  },
};

const SUCCESS = {
  kind: 'success' as const,
  data: { resFlatRateContractList: [] },
};

describe('연결 흐름', () => {
  beforeEach(() => resetThrottle());

  it('추가 인증이 필요하면 twoWayInfo 를 그대로 넘긴다', async () => {
    const client = fakeClient({ first: TWO_WAY });
    const out = await startConnect('m1', CREDS, {
      makeClient: () => client as never,
      save: vi.fn(),
    });
    expect(out.status).toBe('two_way');
    if (out.status !== 'two_way') return;
    // 값 하나만 달라도 대상기관이 세션을 버린다. 그대로 전달되는지 고정한다.
    expect(out.twoWayInfo).toEqual({
      jobIndex: 0,
      threadIndex: 1,
      jti: 'abc',
      twoWayTimestamp: 1700000000000,
    });
  });

  it('성공하면 정규화 결과를 저장한다', async () => {
    const save = vi.fn(async (input: { memberId: string; environment: string }) => {
      captured.push(input);
      return { syncRunId: 'r1', inserted: 0, updated: 0, coverageCount: 0 };
    });
    const captured: { memberId: string; environment: string }[] = [];
    const client = fakeClient({ first: SUCCESS });
    const out = await startConnect('m1', CREDS, { makeClient: () => client as never, save });
    expect(out.status).toBe('done');
    expect(captured).toHaveLength(1);
    expect(captured[0].memberId).toBe('m1');
    // 어느 환경에서 받은 데이터인지 반드시 남긴다. 샌드박스가 실데이터로 둔갑하면 안 된다.
    expect(captured[0].environment).toBe(currentEnvironment());
  });

  it('2차 요청은 twoWayInfo 를 클라이언트에 그대로 전달한다', async () => {
    const save = vi.fn(async () => ({ syncRunId: 'r', inserted: 0, updated: 0, coverageCount: 0 }));
    const sent: { twoWayInfo: unknown }[] = [];
    const client = {
      requestContractInfo: vi.fn(),
      continueContractInfo: vi.fn(async (input: { twoWayInfo: unknown }) => {
        sent.push(input);
        return SUCCESS;
      }),
    };
    const handle = { jobIndex: 0, threadIndex: 1, jti: 'abc', twoWayTimestamp: 17 };
    await continueConnect('m1', CREDS, handle, { makeClient: () => client as never, save });
    expect(sent[0].twoWayInfo).toEqual(handle);
  });

  it('CODEF 오류는 사용자 문장으로 바뀌어 나온다', async () => {
    const client = fakeClient({
      throwOnFirst: new CodefError('CF-12100', '로그인 정보가 올바르지 않습니다'),
    });
    const out = await startConnect('m1', CREDS, { makeClient: () => client as never, save: vi.fn() });
    expect(out.status).toBe('failed');
    if (out.status !== 'failed') return;
    expect(out.failure.fixable).toBe(true);
    expect(out.failure.message).toContain('비밀번호');
  });

  it('연타는 서버에서 막는다 — CODEF 는 과도한 호출에 IP 를 막는다', async () => {
    const client = fakeClient({ first: SUCCESS });
    const deps = { makeClient: () => client as never, save: vi.fn(async () => ({ syncRunId: 'r', inserted: 0, updated: 0, coverageCount: 0 })) };
    const first = await startConnect('m1', CREDS, { ...deps, now: () => 1_000 });
    const second = await startConnect('m1', CREDS, { ...deps, now: () => 2_000 });
    expect(first.status).toBe('done');
    expect(second.status).toBe('failed');
    if (second.status !== 'failed') return;
    expect(second.failure.code).toBe('THROTTLED');
    expect(client.requestContractInfo).toHaveBeenCalledOnce();
  });

  it('간격이 지나면 다시 호출된다', () => {
    expect(checkThrottle('k', 0).ok).toBe(true);
    expect(checkThrottle('k', 1_000).ok).toBe(false);
    expect(checkThrottle('k', 6_000).ok).toBe(true);
  });

  it('모르는 오류코드는 재시도 안내로 수렴하되 코드는 남긴다', () => {
    const f = toFailure(new CodefError('CF-99999', '알 수 없음'));
    expect(f.code).toBe('CF-99999');
    expect(f.fixable).toBe(false);
  });
});

describe('요청 검증', () => {
  it('대상기관 규칙에 맞지 않는 값은 서버에서도 막는다', () => {
    expect(startSchema.safeParse({ loginId: 'abc', password: 'abcd1234!' }).success).toBe(false);
    expect(startSchema.safeParse({ loginId: 'nochil01', password: 'abcdefghij' }).success).toBe(false);
    expect(startSchema.safeParse(CREDS).success).toBe(true);
  });

  it('memberName 은 생략하면 본인이 된다', () => {
    const parsed = startSchema.parse(CREDS);
    expect(parsed.memberName).toBe('본인');
  });

  it('2차 요청은 twoWayInfo 가 없으면 거절된다', () => {
    expect(continueSchema.safeParse(CREDS).success).toBe(false);
    expect(
      continueSchema.safeParse({
        ...CREDS,
        twoWayInfo: { jobIndex: 0, threadIndex: 1, jti: 'a', twoWayTimestamp: 1 },
      }).success,
    ).toBe(true);
  });
});

describe('검증 메시지', () => {
  it('twoWayInfo 유실은 타입 오류가 아니라 사람이 읽는 문장으로 나온다', async () => {
    const { firstIssueMessage } = await import('../src/lib/connect/schema');
    const parsed = continueSchema.safeParse(CREDS);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(firstIssueMessage(parsed.error)).toContain('처음부터 다시');
  });
});

describe('실데이터 안전장치 연결', () => {
  it('가드가 막으면 CODEF 를 아예 부르지 않는다', async () => {
    const client = fakeClient({ first: SUCCESS });
    const out = await startConnect('m-guard', CREDS, {
      makeClient: () => client as never,
      save: vi.fn(),
      guard: async () => ({
        ok: false,
        failure: { code: 'DAILY_LIMIT', message: '오늘 한도를 다 썼습니다.', fixable: false },
      }),
    });
    expect(out.status).toBe('failed');
    if (out.status !== 'failed') return;
    expect(out.failure.code).toBe('DAILY_LIMIT');
    // 막았는데 호출이 나가면 한도 자체가 무의미하다.
    expect(client.requestContractInfo).not.toHaveBeenCalled();
  });
});

describe('환경별 클라이언트 정보', () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
  const KEY = { CODEF_PUBLIC_KEY: 'pub' };

  it('환경에 맞는 키를 고른다 — 콘솔은 샌드박스·데모·정식 키를 따로 발급한다', async () => {
    const { configFromEnv } = await import('../src/lib/codef/client');
    const base = {
      ...KEY,
      CODEF_SANDBOX_CLIENT_ID: 'sand-id',
      CODEF_SANDBOX_CLIENT_SECRET: 'sand-sec',
      CODEF_DEMO_CLIENT_ID: 'demo-id',
      CODEF_DEMO_CLIENT_SECRET: 'demo-sec',
    };
    expect(configFromEnv(env({ ...base, CODEF_ENV: 'sandbox' })).clientId).toBe('sand-id');
    expect(configFromEnv(env({ ...base, CODEF_ENV: 'demo' })).clientId).toBe('demo-id');
  });

  it('환경 전용 값이 없으면 공용 값으로 떨어진다 — 한 환경만 쓰는 사람을 막지 않는다', async () => {
    const { configFromEnv } = await import('../src/lib/codef/client');
    const c = configFromEnv(
      env({ ...KEY, CODEF_ENV: 'demo', CODEF_CLIENT_ID: 'one', CODEF_CLIENT_SECRET: 'sec' }),
    );
    expect(c.clientId).toBe('one');
    expect(c.source).toBe('CODEF_CLIENT_ID');
  });

  it('키가 아예 없으면 어느 변수를 채워야 하는지 말한다', async () => {
    const { configFromEnv } = await import('../src/lib/codef/client');
    expect(() => configFromEnv(env({ ...KEY, CODEF_ENV: 'demo' }))).toThrow(/CODEF_DEMO_CLIENT_ID/);
  });

  it('공개키는 환경과 무관하게 하나다', async () => {
    const { configFromEnv } = await import('../src/lib/codef/client');
    expect(() =>
      configFromEnv(env({ CODEF_ENV: 'demo', CODEF_DEMO_CLIENT_ID: 'a', CODEF_DEMO_CLIENT_SECRET: 'b' })),
    ).toThrow(/CODEF_PUBLIC_KEY/);
  });
});

describe('CODEF_ENV 해석', () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

  it('따옴표와 공백이 붙어도 알아본다 — .env 편집에서 가장 흔한 실수다', () => {
    expect(currentEnvironment(env({ CODEF_ENV: ' demo ' }))).toBe('demo');
    expect(currentEnvironment(env({ CODEF_ENV: '"demo"' }))).toBe('demo');
    expect(currentEnvironment(env({ CODEF_ENV: "'api'" }))).toBe('api');
  });

  it('값이 없으면 샌드박스다', () => {
    expect(currentEnvironment(env({}))).toBe('sandbox');
  });

  it('모르는 값은 샌드박스로 보되 조용히 넘어가지 않는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(currentEnvironment(env({ CODEF_ENV: 'production' }))).toBe('sandbox');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
