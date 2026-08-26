import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { pretendard } from './fonts';
import { TabBar } from './_components/tabbar';
import { LogoHorizontal } from './_components/brand';
import { Avatar } from './_components/ui';
import { avatarSrc } from '@/lib/repo/avatar';
import { getSelfBadge } from '@/lib/repo/household';
import { Splash } from './_components/splash';
import { ServiceWorker } from './_components/service-worker';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '놓칠뻔', template: '%s · 놓칠뻔' },
  description: '우리 가족 보험, 놓치지 않게. 사고가 나면 청구할 수 있는 담보를 찾아드립니다.',
  applicationName: '놓칠뻔',
  // iOS 는 웹 매니페스트의 아이콘을 쓰지 않는다. apple-touch-icon 을 따로 준다.
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: '놓칠뻔',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#a32a5e',
  width: 'device-width',
  initialScale: 1,
  // 확대를 막지 않는다. 글자를 키워 보는 사용자가 있다.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 헤더 아바타. 여기서 실패해도 화면은 그대로 떠야 하므로 getSelfBadge 가 null 을 삼킨다.
  const self = await getSelfBadge();

  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col">
          <header className="flex items-center justify-between gap-3 px-[18px] pt-4 pb-2">
            {/* 헤더는 CI 가로 조합을 그대로 쓴다. 여기서 글자를 다시 조판하면
                자간·크기 비율이 로고와 어긋난다. */}
            <LogoHorizontal height={30} />
            {self ? (
              <Link href="/profile" className="flex items-center gap-2" aria-label="내 정보">
                <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
                  {self.householdName}
                </span>
                <Avatar
                  name={self.displayName}
                  size={30}
                  src={avatarSrc(self.memberId, self.avatarUpdatedAt)}
                />
              </Link>
            ) : (
              <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
                우리집
              </span>
            )}
          </header>

          {/* 떠 있는 탭바에 마지막 요소가 가리지 않게 아래를 비워둔다 */}
          <main className="flex flex-1 flex-col gap-[14px] px-[18px] pt-1 pb-[118px]">{children}</main>
        </div>

        <TabBar />
        <Splash />
        <ServiceWorker />
      </body>
    </html>
  );
}
