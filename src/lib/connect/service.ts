import { CodefClient, configFromEnv, readEnvName, type ContractInfoResult } from '../codef/client';
import { normalizeContractInfo } from '../codef/normalize';
import type { CodefEnvironment, CodefTwoWayData } from '../codef/types';
import { saveSyncResult, type SaveSyncOutput } from '../repo/sync';
import { checkThrottle } from './throttle';
import { throttledFailure, toFailure, type ConnectFailure } from './errors';
import { checkLiveGuard } from './live-guard';

/**
 * 내보험다보여 연결 흐름.
 *
 * 두 단계다. 1차 요청에 대상기관이 추가 인증을 요구하면(CF-03002) twoWayInfo 가
 * 내려오고, 사용자가 휴대폰에서 승인한 뒤 2차 요청에 그 값을 그대로 실어 보낸다.
 *
 * 비밀번호를 서버에 보관하지 않는다. 2차 요청에도 대상기관은 아이디·비밀번호를
 * 다시 요구하므로, 값은 사용자의 브라우저 메모리에만 두고 매 요청에 실어 받는다.
 * 세션이나 DB 에 두면 "저장하지 않습니다" 라는 화면의 약속이 거짓이 된다.
 */

export type Credentials = {
  loginId: string;
  password: string;
  userName?: string;
  phoneNo?: string;
  telecom?: '0' | '1' | '2' | '3' | '4' | '5';
};

export type TwoWayHandle = Pick<
  CodefTwoWayData,
  'jobIndex' | 'threadIndex' | 'jti' | 'twoWayTimestamp'
>;

export type ConnectOutcome =
  | { status: 'two_way'; twoWayInfo: TwoWayHandle; extraMessage: string | null }
  | {
      status: 'done';
      summary: SaveSyncOutput;
      policyCount: number;
      /** 유지 중인 계약 수. 내보험다보여는 만기·해지된 옛 계약까지 돌려주므로
       *  전체 건수만 보여주면 "내 계약이 이렇게 많을 리가" 하는 오해가 생긴다. */
      activeCount: number;
      environment: CodefEnvironment;
    }
  | { status: 'failed'; failure: ConnectFailure };

export type ConnectDeps = {
  /** 테스트에서 갈아끼운다. 기본은 환경변수로 만든 실제 클라이언트. */
  makeClient?: () => CodefClient;
  save?: typeof saveSyncResult;
  now?: () => number;
  /** 실데이터 안전장치. 테스트에서 통과시키거나 막아본다. */
  guard?: typeof checkLiveGuard;
};

/** 저장 기록에 어느 환경에서 받은 데이터인지 남긴다. 샌드박스 데이터가 실데이터로 둔갑하면 안 된다. */
export function currentEnvironment(env: NodeJS.ProcessEnv = process.env): CodefEnvironment {
  // 따옴표·공백이 붙은 채로 들어오는 일이 잦다. 값을 다듬은 뒤에 판단한다.
  // 읽기 규칙은 configFromEnv 와 같아야 한다 — 화면 라벨과 실제 호출 대상이
  // 갈리면 "설정은 데모인데 결과는 샌드박스" 를 눈으로 잡을 수 없다.
  const raw = readEnvName(env);
  if (raw === 'demo' || raw === 'api' || raw === 'sandbox') return raw;
  // 여기는 **표시용 라벨**이다. 실제 호출은 configFromEnv() 가 막으므로(미설정이면 예외)
  // 이 폴백으로는 데이터가 한 건도 들어오지 않는다. 그래서 던지지 않는다 —
  // 실패 로그를 남기는 경로가 이 함수를 부르기 때문에, 여기서 던지면 처리된 실패가
  // 크래시로 바뀐다.
  console.warn(
    `[connect] CODEF_ENV 를 읽을 수 없습니다: ${JSON.stringify(raw ?? null)} → 표시는 demo 로 두지만 실제 조회는 거부됩니다`,
  );
  return 'demo';
}

function clientFrom(deps: ConnectDeps): CodefClient {
  if (deps.makeClient) return deps.makeClient();
  return new CodefClient(configFromEnv());
}

async function finish(
  result: ContractInfoResult,
  memberId: string,
  deps: ConnectDeps,
): Promise<ConnectOutcome> {
  if (result.kind === 'two_way') {
    return {
      status: 'two_way',
      twoWayInfo: {
        jobIndex: result.twoWay.jobIndex,
        threadIndex: result.twoWay.threadIndex,
        jti: result.twoWay.jti,
        twoWayTimestamp: result.twoWay.twoWayTimestamp,
      },
      extraMessage: result.twoWay.extraInfo?.reqSecureNo ?? null,
    };
  }

  const policies = normalizeContractInfo(result.data);
  const save = deps.save ?? saveSyncResult;
  const summary = await save({
    memberId,
    environment: currentEnvironment(),
    policies,
    rawSnapshot: result.data,
  });
  const activeCount = policies.filter((p) => p.status === '유지').length;
  return {
    status: 'done',
    summary,
    policyCount: policies.length,
    activeCount,
    environment: currentEnvironment(),
  };
}

export async function startConnect(
  memberId: string,
  credentials: Credentials,
  deps: ConnectDeps = {},
): Promise<ConnectOutcome> {
  const now = deps.now?.() ?? Date.now();
  const gate = checkThrottle(`start:${memberId}`, now);
  if (!gate.ok) {
    return { status: 'failed', failure: throttledFailure() };
  }

  const guard = await (deps.guard ?? checkLiveGuard)(currentEnvironment());
  if (!guard.ok) return { status: 'failed', failure: guard.failure };

  try {
    const client = clientFrom(deps);
    const result = await client.requestContractInfo({
      loginId: credentials.loginId,
      password: credentials.password,
      userName: credentials.userName,
      phoneNo: credentials.phoneNo,
      telecom: credentials.telecom,
    });
    return await finish(result, memberId, deps);
  } catch (error) {
    return { status: 'failed', failure: logged(error) };
  }
}

export async function continueConnect(
  memberId: string,
  credentials: Credentials,
  twoWayInfo: TwoWayHandle,
  deps: ConnectDeps = {},
): Promise<ConnectOutcome> {
  try {
    const client = clientFrom(deps);
    const result = await client.continueContractInfo({
      loginId: credentials.loginId,
      password: credentials.password,
      userName: credentials.userName,
      phoneNo: credentials.phoneNo,
      telecom: credentials.telecom,
      twoWayInfo,
      simpleAuth: '1',
    });
    return await finish(result, memberId, deps);
  } catch (error) {
    return { status: 'failed', failure: logged(error) };
  }
}

/**
 * 실패를 서버 로그에도 남긴다. 화면에는 사람이 읽을 문장만 나가므로 원인 코드가
 * 어디에도 남지 않으면 "안 되는데요" 에서 더 나아갈 수가 없다.
 * 아이디·비밀번호는 절대 싣지 않는다.
 */
function logged(error: unknown): ConnectFailure {
  const failure = toFailure(error);
  console.error(
    `[connect] 실패 code=${failure.code} env=${currentEnvironment()} message=${failure.message}`,
  );
  return failure;
}
