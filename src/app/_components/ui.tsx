import type { CSSProperties, ReactNode } from 'react';

type Tone = 'ok' | 'warn' | 'bad' | 'grey';

export function Pill({ children, tone = 'grey' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Card({
  children,
  className = '',
  flat = false,
  tone,
  style,
}: {
  children: ReactNode;
  className?: string;
  flat?: boolean;
  /** 카드 전체를 의미색으로 칠한다. 배경과 테두리가 함께 바뀐다. */
  tone?: 'brand' | 'alert' | 'warn';
  style?: CSSProperties;
}) {
  const toneStyle: CSSProperties | undefined = tone
    ? {
        background: `var(--${tone === 'brand' ? 'brand' : tone}-soft)`,
        borderColor: `var(--${tone === 'brand' ? 'brand' : tone}-line)`,
      }
    : undefined;
  return (
    <section className={`${flat ? 'card-flat' : 'card'} ${className}`} style={{ ...toneStyle, ...style }}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-[19px] font-bold tracking-[-0.015em]">{children}</h2>
      {meta ? <span className="text-[14px] text-[var(--ink-3)]">{meta}</span> : null}
    </div>
  );
}

/** 손해사정업 경계를 지키기 위해 결과 화면마다 붙인다. */
export function Disclaimer({ extra }: { extra?: ReactNode }) {
  return (
    <p className="note">
      가입하신 약관을 근거로 한 참고 정보입니다. 보험금을 산정하거나 대신 접수하지 않으며,{' '}
      <b className="font-semibold text-[var(--ink-2)]">
        최종 지급 여부와 금액은 보험사 심사로 결정됩니다.
      </b>
      {extra ? <> {extra}</> : null}
    </p>
  );
}

export function Won({ value, className = '' }: { value: number | null; className?: string }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={`text-[var(--ink-3)] ${className}`}>—</span>;
  }
  return (
    <span className={`tnum ${className}`}>
      {value.toLocaleString('ko-KR')}
      <span className="ml-0.5 text-[14px] font-medium">원</span>
    </span>
  );
}

/** 큰 금액은 억/만 단위로 줄여 읽는다. 격자 칸처럼 좁은 자리에서 쓴다. */
export function shortWon(won: number): string {
  if (won <= 0) return '';
  if (won >= 100_000_000) {
    const eok = won / 100_000_000;
    return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억`;
  }
  if (won >= 10_000) return `${Math.round(won / 10_000).toLocaleString('ko-KR')}만`;
  return won.toLocaleString('ko-KR');
}

/** 이름 첫 글자를 딴 아바타. 사진을 받지 않으므로 글자로 구분한다. */
export function Avatar({
  name,
  variant = 'brand',
  size = 44,
}: {
  name: string;
  variant?: 'brand' | 'muted' | 'ghost';
  size?: number;
}) {
  const cls = variant === 'brand' ? 'avatar' : `avatar avatar-${variant}`;
  return (
    <span
      className={cls}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function Icon({ path, size = 22 }: { path: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export const ICONS = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
      <path d="M14 5.5h7M3 18.5h7" opacity=".4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
      <path d="M11 8.2v5.6M8.2 11h5.6" />
    </>
  ),
  family: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle cx="17.5" cy="9.5" r="2.4" />
      <path d="M16 14.4c3 .2 5 2.3 5 5.6" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="9" r="3.4" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </>
  ),
  check: <path d="m5 12 5 5L19 7" />,
  alert: (
    <>
      <path d="M12 8v5M12 16.5v.01" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </>
  ),
  send: <path d="m3 11 18-8-8 18-2-8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
} as const;
