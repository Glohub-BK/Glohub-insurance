import { belongsToHousehold, getTermsBlob } from '@/lib/repo/terms-doc';
import { getCurrentHousehold } from '@/lib/repo/household';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 약관 원본 내려받기.
 *
 * `Content-Disposition: attachment` 를 붙여 휴대폰에서 브라우저가 열지 않고 파일로
 * 저장하게 한다. iOS 사파리는 「다운로드」, 안드로이드 크롬은 알림으로 떨어진다.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/terms/[documentId]'>) {
  const { documentId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return new Response('Not Found', { status: 404 });

  const household = await getCurrentHousehold().catch(() => null);
  if (!household) return new Response('Not Found', { status: 404 });
  if (!(await belongsToHousehold(documentId, household.id).catch(() => false))) {
    return new Response('Not Found', { status: 404 });
  }

  const blob = await getTermsBlob(documentId).catch((error) => {
    console.error('[terms] 다운로드 실패', error);
    return null;
  });
  if (!blob) return new Response('Not Found', { status: 404 });

  const body = new Uint8Array(blob.bytes);
  // 파일명에 한글·공백이 들어가므로 RFC 5987 형식을 함께 준다.
  const ascii = blob.file_name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  return new Response(body, {
    headers: {
      'Content-Type': blob.mime,
      'Content-Length': String(body.byteLength),
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(blob.file_name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
