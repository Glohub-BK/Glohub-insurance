import type { Metadata } from 'next';
import Link from 'next/link';
import { Beoni } from '../_components/brand';
import { Card } from '../_components/ui';

export const metadata: Metadata = { title: '연결이 끊겼어요' };

/**
 * 오프라인 안내.
 *
 * 저장된 보장내역을 대신 보여주지 않는다. 오래된 데이터를 최신인 것처럼 보여주면
 * 잘못된 청구 판단으로 이어진다 — 이 앱에서 그건 흰 화면보다 나쁘다.
 */
export default function OfflinePage() {
  return (
    <>
      <Card className="flex flex-col items-center gap-3 !py-9 text-center">
        <Beoni pose="sorry" height={104} />
        <span>
          <b className="text-[18px]">지금은 연결이 끊겼어요</b>
          <br />
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            네트워크가 돌아오면 그대로 이어서 볼 수 있습니다
          </span>
        </span>
      </Card>

      <p className="note">
        보장내역은 저장해두고 보여드리지 않습니다. 오래된 내용을 최신인 것처럼 보면 청구 판단이
        어긋날 수 있기 때문입니다.
      </p>

      <Link href="/" className="btn btn-primary">
        다시 시도
      </Link>
    </>
  );
}
