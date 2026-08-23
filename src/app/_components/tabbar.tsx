'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, ICONS } from './ui';

const LEFT = [
  { href: '/', label: '홈', icon: ICONS.home },
  { href: '/coverage', label: '보장', icon: ICONS.grid },
] as const;

const RIGHT = [
  { href: '/family', label: '가족', icon: ICONS.family },
  { href: '/profile', label: '나', icon: ICONS.person },
] as const;

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * 바닥에 붙지 않고 떠 있는 반투명 탭바.
 * 가운데 AI 버튼은 바 밖으로 돌출시킨다 — 이 제품의 핵심 기능이 다섯 중 하나로 묻히면 안 된다.
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav aria-label="주요 메뉴" className="tabdock">
      {LEFT.map((t) => (
        <Link key={t.href} href={t.href} aria-current={isActive(pathname, t.href) ? 'page' : undefined}>
          <Icon path={t.icon} size={21} />
          {t.label}
        </Link>
      ))}

      <span className="dock-fab-wrap">
        <Link href="/ai" className="dock-fab" aria-label="AI 청구 진단">
          <Icon path={ICONS.search} size={25} />
        </Link>
        <span className="dock-fab-label" style={{ color: isActive(pathname, '/ai') ? 'var(--brand-ink)' : 'var(--ink-3)' }}>
          AI 청구
        </span>
      </span>

      {RIGHT.map((t) => (
        <Link key={t.href} href={t.href} aria-current={isActive(pathname, t.href) ? 'page' : undefined}>
          <Icon path={t.icon} size={21} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
