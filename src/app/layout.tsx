import type { Metadata, Viewport } from 'next';
import { pretendard } from './fonts';
import { TabBar } from './_components/tabbar';
import './globals.css';

export const metadata: Metadata = {
  title: '보장맵',
  description: '가입한 보험을 한눈에 보고, 사고가 났을 때 청구를 놓치지 않게 합니다.',
};

export const viewport: Viewport = {
  themeColor: '#a32a5e',
  width: 'device-width',
  initialScale: 1,
  // 확대를 막지 않는다. 글자를 키워 보는 사용자가 있다.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col">
          <header className="flex items-center justify-between gap-3 px-[18px] pt-4 pb-2">
            <span className="flex items-center gap-2 text-[20px] font-bold tracking-[-0.025em]">
              <span
                className="grid size-7 place-items-center rounded-[9px] text-white"
                style={{ background: 'var(--brand-grad)', boxShadow: 'var(--e-brand)' }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              보장맵
            </span>
            <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
              우리집
            </span>
          </header>

          {/* 떠 있는 탭바에 마지막 요소가 가리지 않게 아래를 비워둔다 */}
          <main className="flex flex-1 flex-col gap-[14px] px-[18px] pt-1 pb-[118px]">{children}</main>
        </div>

        <TabBar />
      </body>
    </html>
  );
}
