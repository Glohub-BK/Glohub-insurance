import { getAvatar } from '@/lib/repo/avatar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 프로필 사진을 그대로 흘려보낸다.
 *
 * 주소에 `?v=` 갱신 시각이 붙어 있어 사진을 바꾸면 주소가 달라진다. 그래서 브라우저에는
 * 오래 캐시하게 두되, 공유 캐시에는 두지 않는다 — 가족에게만 보이는 사진이다.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/avatar/[memberId]'>) {
  const { memberId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) {
    return new Response('Not Found', { status: 404 });
  }

  const avatar = await getAvatar(memberId).catch((error) => {
    console.error('[avatar] 조회 실패', error);
    return null;
  });
  if (!avatar) return new Response('Not Found', { status: 404 });

  const body = new Uint8Array(avatar.bytes);
  return new Response(body, {
    headers: {
      'Content-Type': avatar.mime,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
