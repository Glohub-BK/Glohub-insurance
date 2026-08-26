import { CodefError } from '../codef/client';

/**
 * CODEF 오류코드를 사용자가 읽을 문장으로 바꾼다.
 *
 * 원본 메시지를 그대로 노출하지 않는 이유: 대상기관 메시지는 내부 용어와 코드가 섞여
 * 있어 사용자가 무엇을 고쳐야 할지 알 수 없다. 우리가 아는 코드는 문장으로 바꾸고,
 * 모르는 코드는 "다시 시도" 로 수렴시키되 코드값은 화면에 남겨 문의할 때 쓰게 한다.
 */
export type ConnectFailure = {
  code: string;
  message: string;
  /** 사용자가 입력을 고쳐야 하는 오류인가. false 면 재시도·문의 안내로 간다. */
  fixable: boolean;
};

const KNOWN: Record<string, { message: string; fixable: boolean }> = {
  'CF-12100': { message: '아이디 또는 비밀번호가 맞지 않습니다.', fixable: true },
  'CF-12827': { message: '아이디·비밀번호 형식이 대상기관 규칙과 맞지 않습니다.', fixable: true },
  'CF-12801': { message: '인증 시간이 지났습니다. 처음부터 다시 시도해주세요.', fixable: true },
  'CF-12802': { message: '휴대폰 인증이 취소되었습니다.', fixable: true },
  'CF-00401': { message: '한국신용정보원 계정이 없거나 본인인증이 만료되었습니다.', fixable: true },
  UNAUTHORIZED: { message: '연결 토큰이 만료되었습니다. 다시 시도해주세요.', fixable: false },
  PARSE_ERROR: { message: '대상기관 응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.', fixable: false },
  NOT_CONFIGURED: { message: '연결 설정이 아직 준비되지 않았습니다.', fixable: false },
  THROTTLED: { message: '조회 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.', fixable: false },
};

export function toFailure(error: unknown): ConnectFailure {
  if (error instanceof CodefError) {
    const known = KNOWN[error.code];
    if (known) return { code: error.code, ...known };
    return {
      code: error.code,
      message: '조회에 실패했습니다. 잠시 후 다시 시도해주세요.',
      fixable: false,
    };
  }
  if (error instanceof Error && error.message.includes('CODEF_CLIENT_ID')) {
    return { code: 'NOT_CONFIGURED', ...KNOWN.NOT_CONFIGURED };
  }
  return { code: 'UNKNOWN', message: '조회에 실패했습니다. 잠시 후 다시 시도해주세요.', fixable: false };
}

/** 조회 간격 제한. CODEF 로 나가기 전에 우리가 막은 것이라 오류 변환을 거치지 않는다. */
export function throttledFailure(): ConnectFailure {
  return { code: 'THROTTLED', ...KNOWN.THROTTLED };
}
