import { publicEncrypt, constants } from 'node:crypto';
import {
  CODEF_CODE,
  type CodefContractInfoData,
  type CodefEnvironment,
  type CodefResponse,
  type CodefTwoWayData,
  isTwoWayResponse,
} from './types';

const OAUTH_URL = 'https://oauth.codef.io/oauth/token';

const BASE_URL: Record<CodefEnvironment, string> = {
  // 샌드박스는 상품별 고정 응답만 돌려준다. 실제 계약은 나오지 않는다.
  sandbox: 'https://sandbox.codef.io',
  demo: 'https://development.codef.io',
  api: 'https://api.codef.io',
};

const CONTRACT_INFO_PATH = '/v1/kr/insurance/0001/credit4u/contract-info';

/** 신용정보원 기관코드 */
export const CREDIT4U_ORGANIZATION = '0001';

export class CodefError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'CodefError';
  }
}

export type CodefConfig = {
  clientId: string;
  clientSecret: string;
  publicKey: string;
  environment: CodefEnvironment;
  /** 어느 환경변수에서 키를 읽었는지. 실패했을 때 어디를 고쳐야 하는지 말해주기 위해 남긴다. */
  source: string;
};

/**
 * 환경마다 클라이언트 정보가 다르다.
 *
 * CODEF 콘솔은 샌드박스 / 데모 / 정식 각각의 클라이언트 ID·시크릿을 따로 발급한다.
 * 하나로 쓰면 환경을 바꾸는 순간 토큰 발급부터 막힌다.
 * 공개키(RSA)는 계정당 하나라 공통으로 쓴다.
 *
 * 환경별 변수를 먼저 보고, 없으면 접두어 없는 값으로 떨어진다 —
 * 한 환경만 쓰는 동안에는 CODEF_CLIENT_ID 하나로도 굴러가야 한다.
 */
const CLIENT_PREFIX: Record<CodefEnvironment, string> = {
  sandbox: 'CODEF_SANDBOX',
  demo: 'CODEF_DEMO',
  api: 'CODEF_API',
};

/**
 * 사람이 적은 CODEF_ENV 를 코드의 환경 값으로 읽는다.
 *
 * 두 가지를 흡수한다.
 *   1. 따옴표·공백 — .env 편집에서 가장 흔한 실수다.
 *   2. `development` → `demo` — **같은 환경의 다른 이름이다.**
 *      CODEF 는 이 환경을 콘솔에서 "데모버전" 이라 부르지만 도메인은
 *      development.codef.io 다. 그래서 도메인을 본 사람은 development 라고 적고,
 *      "CODEF_ENV 값이 올바르지 않습니다" 를 만난다. 이름 하나 때문에 연결이
 *      통째로 실패할 이유가 없다.
 *
 * 값이 없으면 빈 문자열이 아니라 undefined 를 돌려준다 — 미설정과 오타는 다른 문제다.
 */
export function readEnvName(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.CODEF_ENV?.trim().replace(/^["']|["']$/g, '');
  if (!raw) return undefined;
  return raw === 'development' ? 'demo' : raw;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): CodefConfig {
  // 기본값을 두지 않는다.
  //
  // 예전에는 미설정이면 조용히 'sandbox' 로 떨어졌다. 샌드박스는 휴대폰 인증 없이
  // 통과하고 그럴듯한 가짜 계약을 돌려주므로, 설정을 깜빡한 것과 "테스트 데이터를
  // 일부러 받는 것" 이 화면에서 구분되지 않았다. 환경은 반드시 명시해야 한다 —
  // 실제 호출로 가는 길목은 여기 하나뿐이라, 여기서 막으면 사고가 원천 차단된다.
  const raw = readEnvName(env);
  if (!raw) {
    throw new Error(
      'CODEF_ENV 가 설정되지 않았습니다. demo(=development, 실데이터·하루 100건) / api(정식) / sandbox(가짜 데이터) 중 하나를 명시하세요.',
    );
  }
  const environment = raw as CodefEnvironment;
  if (!(environment in BASE_URL)) {
    throw new Error(`CODEF_ENV 값이 올바르지 않습니다: ${environment}`);
  }

  const prefix = CLIENT_PREFIX[environment];
  const scopedId = env[`${prefix}_CLIENT_ID`];
  const scopedSecret = env[`${prefix}_CLIENT_SECRET`];
  const scoped = Boolean(scopedId && scopedSecret);

  const clientId = scopedId || env.CODEF_CLIENT_ID;
  const clientSecret = scopedSecret || env.CODEF_CLIENT_SECRET;
  const publicKey = env.CODEF_PUBLIC_KEY;

  if (!clientId || !clientSecret) {
    throw new Error(
      `${environment} 환경의 클라이언트 정보가 없습니다. ` +
        `${prefix}_CLIENT_ID / ${prefix}_CLIENT_SECRET 를 넣거나, ` +
        `이 환경만 쓸 거라면 CODEF_CLIENT_ID / CODEF_CLIENT_SECRET 에 ${environment} 키를 넣으세요.`,
    );
  }
  if (!publicKey) {
    throw new Error('CODEF_PUBLIC_KEY 가 필요합니다. 공개키는 환경과 무관하게 계정당 하나입니다.');
  }

  return {
    clientId,
    clientSecret,
    publicKey,
    environment,
    source: scoped ? `${prefix}_CLIENT_ID` : 'CODEF_CLIENT_ID',
  };
}

/**
 * 대상기관 비밀번호는 CODEF 공개키로 RSA 암호화해 보낸다.
 * 평문 비밀번호는 이 함수 밖으로 나가지 않으며 어디에도 저장하지 않는다.
 */
export function encryptPassword(plain: string, publicKeyBase64: string): string {
  const pem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64
    .replace(/\s+/g, '')
    .replace(/(.{64})/g, '$1\n')}\n-----END PUBLIC KEY-----\n`;
  return publicEncrypt(
    { key: pem, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(plain, 'utf8'),
  ).toString('base64');
}

type CachedToken = { value: string; expiresAt: number };

export class CodefClient {
  private token: CachedToken | null = null;

  constructor(private readonly config: CodefConfig) {}

  private get baseUrl(): string {
    return BASE_URL[this.config.environment];
  }

  /**
   * access_token 은 일주일 유효하다. 매 호출마다 발급받으면 느리므로 캐싱한다.
   * 만료 10분 전에 미리 갱신해 경계에서 401 이 나지 않게 한다.
   */
  async getAccessToken(now: number = Date.now()): Promise<string> {
    if (this.token && this.token.expiresAt - 10 * 60_000 > now) {
      return this.token.value;
    }

    const basic = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
      'utf8',
    ).toString('base64');

    const res = await fetch(OAUTH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=read',
    });

    if (!res.ok) {
      throw new CodefError(`HTTP_${res.status}`, `토큰 발급 실패 (${res.status})`);
    }

    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) {
      throw new CodefError('NO_TOKEN', '토큰 응답에 access_token 이 없습니다.', body);
    }

    this.token = {
      value: body.access_token,
      expiresAt: now + (body.expires_in ?? 7 * 24 * 60 * 60) * 1000,
    };
    return this.token.value;
  }

  /** CODEF 응답 본문은 URL 인코딩된 JSON 문자열이다. */
  private async request<T>(path: string, payload: Record<string, unknown>): Promise<CodefResponse<T>> {
    const token = await this.getAccessToken();

    // 어디로 나갔는지 로그에 남긴다. "설정은 데모인데 결과는 샌드박스" 를 눈으로
    // 확인할 방법이 없으면 추측만 하게 된다. 자격증명은 절대 싣지 않는다.
    console.info(`[codef] → ${this.baseUrl}${path} (env=${this.config.environment})`);

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (res.status === 401) {
      this.token = null;
      throw new CodefError('UNAUTHORIZED', '토큰이 만료되었습니다. 다시 시도하세요.');
    }
    const body = parseCodefBody<T>(text);
    const code = (body as { result?: { code?: string; message?: string } }).result;
    console.info(
      `[codef] ← ${res.status} code=${code?.code ?? '?'} message=${(code?.message ?? '').slice(0, 60)}`,
    );
    return body;
  }

  /**
   * 1차 요청. 추가 인증이 필요하면 CF-03002 와 함께 twoWayInfo 가 내려온다.
   */
  async requestContractInfo(input: ContractInfoInput): Promise<ContractInfoResult> {
    const payload: Record<string, unknown> = {
      organization: CREDIT4U_ORGANIZATION,
      id: input.loginId,
      password: encryptPassword(input.password, this.config.publicKey),
      type: input.type ?? '0',
      identityEncYn: 'N',
      ...(input.userName ? { userName: input.userName } : {}),
      ...(input.phoneNo ? { phoneNo: input.phoneNo } : {}),
      ...(input.telecom ? { telecom: input.telecom } : {}),
      ...(input.authMethod ? { authMethod: input.authMethod } : {}),
      ...(input.timeOut ? { timeOut: String(input.timeOut) } : {}),
    };

    const res = await this.request<CodefContractInfoData | CodefTwoWayData>(
      CONTRACT_INFO_PATH,
      payload,
    );
    return interpret(res);
  }

  /**
   * 2차 요청. 사용자가 휴대폰에서 인증을 마친 뒤 호출한다.
   * 1차 요청 파라미터를 그대로 다시 실어 보내야 한다.
   */
  async continueContractInfo(input: ContinueInput): Promise<ContractInfoResult> {
    const payload: Record<string, unknown> = {
      organization: CREDIT4U_ORGANIZATION,
      id: input.loginId,
      password: encryptPassword(input.password, this.config.publicKey),
      type: input.type ?? '0',
      identityEncYn: 'N',
      ...(input.userName ? { userName: input.userName } : {}),
      ...(input.phoneNo ? { phoneNo: input.phoneNo } : {}),
      ...(input.telecom ? { telecom: input.telecom } : {}),
      ...(input.smsAuthNo ? { smsAuthNo: input.smsAuthNo } : {}),
      ...(input.secureNo ? { secureNo: input.secureNo } : {}),
      simpleAuth: input.simpleAuth ?? '1',
      is2Way: true,
      twoWayInfo: {
        jobIndex: input.twoWayInfo.jobIndex,
        threadIndex: input.twoWayInfo.threadIndex,
        jti: input.twoWayInfo.jti,
        twoWayTimestamp: input.twoWayInfo.twoWayTimestamp,
      },
    };

    const res = await this.request<CodefContractInfoData | CodefTwoWayData>(
      CONTRACT_INFO_PATH,
      payload,
    );
    return interpret(res);
  }
}

export type ContractInfoInput = {
  loginId: string;
  /** 평문. 이 값은 즉시 RSA 암호화되며 저장되지 않는다. */
  password: string;
  /** "0" 전체 (기본값) */
  type?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7';
  userName?: string;
  phoneNo?: string;
  telecom?: '0' | '1' | '2' | '3' | '4' | '5';
  authMethod?: '0' | '1';
  timeOut?: number;
};

export type ContinueInput = ContractInfoInput & {
  twoWayInfo: Pick<CodefTwoWayData, 'jobIndex' | 'threadIndex' | 'jti' | 'twoWayTimestamp'>;
  smsAuthNo?: string;
  secureNo?: string;
  simpleAuth?: '0' | '1';
};

export type ContractInfoResult =
  | { kind: 'success'; data: CodefContractInfoData }
  | { kind: 'two_way'; twoWay: CodefTwoWayData };

/** 응답 본문 파싱. URL 인코딩 여부를 자동 판별한다. */
export function parseCodefBody<T>(text: string): CodefResponse<T> {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith('{') ? trimmed : decodeURIComponent(trimmed);
  try {
    return JSON.parse(jsonText) as CodefResponse<T>;
  } catch {
    throw new CodefError('PARSE_ERROR', 'CODEF 응답을 해석하지 못했습니다.', text.slice(0, 500));
  }
}

function interpret(res: CodefResponse<CodefContractInfoData | CodefTwoWayData>): ContractInfoResult {
  if (isTwoWayResponse(res)) {
    return { kind: 'two_way', twoWay: res.data };
  }
  if (res.result.code !== CODEF_CODE.SUCCESS) {
    throw new CodefError(
      res.result.code,
      res.result.message ?? res.result.extraMessage ?? '알 수 없는 오류',
      res.result,
    );
  }
  return { kind: 'success', data: res.data as CodefContractInfoData };
}
