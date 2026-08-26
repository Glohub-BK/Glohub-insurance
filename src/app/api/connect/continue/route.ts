import { NextResponse } from 'next/server';
import { ensureMember } from '@/lib/repo/household';
import { continueSchema, firstIssueMessage } from '@/lib/connect/schema';
import { continueConnect } from '@/lib/connect/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 2차 조회. 사용자가 휴대폰에서 인증을 마친 뒤 호출한다.
 * twoWayInfo 는 1차 응답 그대로여야 한다 — 값 하나만 달라도 대상기관이 세션을 버린다.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'failed', failure: { code: 'BAD_JSON', message: '요청 형식이 올바르지 않습니다.', fixable: false } }, { status: 400 });
  }

  const parsed = continueSchema.safeParse(body);
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

  const { memberName, twoWayInfo, ...credentials } = parsed.data;

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

  const outcome = await continueConnect(memberId, credentials, twoWayInfo);

  return NextResponse.json(outcome, { status: outcome.status === 'failed' ? 502 : 200 });
}
