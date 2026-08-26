import { NextResponse } from 'next/server';
import { ensureMember } from '@/lib/repo/household';
import { firstIssueMessage, startSchema } from '@/lib/connect/schema';
import { startConnect } from '@/lib/connect/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 내보험다보여 1차 조회.
 *
 * 비밀번호는 이 핸들러 안에서만 존재한다. 로그로 남기지 않고, 응답에 되돌려주지 않고,
 * DB 에 쓰지 않는다. 실패해도 마찬가지다 — 실패 로그에 본문을 통째로 남기는 실수가
 * 가장 흔한 유출 경로다.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'failed', failure: { code: 'BAD_JSON', message: '요청 형식이 올바르지 않습니다.', fixable: false } }, { status: 400 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        status: 'failed',
        failure: {
          code: 'INVALID_INPUT',
          message: firstIssueMessage(parsed.error),
          fixable: true,
        },
      },
      { status: 400 },
    );
  }

  const { memberName, ...credentials } = parsed.data;

  // DB 가 없으면 조회해도 저장할 곳이 없다. CODEF 를 부르기 전에 여기서 끝낸다 —
  // 실패할 호출을 굳이 보내면 대상기관 쪽 실패 이력만 쌓인다.
  let memberId: string;
  try {
    ({ memberId } = await ensureMember(memberName));
  } catch (error) {
    console.error('[connect] 구성원 확인 실패', error);
    return NextResponse.json(
      {
        status: 'failed',
        failure: { code: 'DB_UNAVAILABLE', message: '데이터베이스에 연결하지 못했습니다.', fixable: false },
      },
      { status: 503 },
    );
  }

  const outcome = await startConnect(memberId, credentials);

  return NextResponse.json(outcome, { status: outcome.status === 'failed' ? 502 : 200 });
}
