/**
 * 조회 간격 제한.
 *
 * CODEF 문서는 과도한 호출 시 IP 차단을 경고한다. 대상기관(신용정보원) 쪽도
 * 같은 계정으로 연속 인증을 시도하면 잠근다. 그래서 클라이언트가 버튼을 연타해도
 * 서버에서 막는다. 프로세스 메모리 기반이라 인스턴스가 여러 개면 완벽하지 않지만,
 * 지금 구조(단일 인스턴스)에서는 이걸로 충분하고, 없는 것보다 낫다.
 */
const MIN_INTERVAL_MS = 5_000;

const lastCallAt = new Map<string, number>();

export type ThrottleResult = { ok: true } | { ok: false; retryAfterMs: number };

export function checkThrottle(
  key: string,
  now: number = Date.now(),
  minIntervalMs: number = MIN_INTERVAL_MS,
): ThrottleResult {
  const last = lastCallAt.get(key);
  if (last !== undefined && now - last < minIntervalMs) {
    return { ok: false, retryAfterMs: minIntervalMs - (now - last) };
  }
  lastCallAt.set(key, now);
  return { ok: true };
}

/** 테스트용. 프로덕션 코드에서 부르지 않는다. */
export function resetThrottle(): void {
  lastCallAt.clear();
}
