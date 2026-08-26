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

/**
 * 구성원 아바타. 사진이 있으면 사진을, 없으면 이름 첫 글자를 보여준다.
 *
 * 사진은 `<img>` 로 직접 건다. next/image 를 쓰면 최적화 프록시를 한 번 더 타는데,
 * 이미 256px 로 줄여 저장한 이미지라 얻을 게 없고 가족만 볼 수 있는 주소를 그쪽에
 * 흘리게 된다.
 */
export function Avatar({
  name,
  variant = 'brand',
  size = 44,
  src,
}: {
  name: string;
  variant?: 'brand' | 'muted' | 'ghost';
  size?: number;
  /** 프로필 사진 주소. null 이면 이니셜로 돌아간다. */
  src?: string | null;
}) {
  const cls = variant === 'brand' ? 'avatar' : `avatar avatar-${variant}`;
  const radius = Math.round(size * 0.34);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} 프로필 사진`}
        width={size}
        height={size}
        className="flex-none object-cover"
        style={{ width: size, height: size, borderRadius: radius, boxShadow: 'var(--e1)' }}
      />
    );
  }

  return (
    <span
      className={cls}
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.36) }}
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
  bell: (
    <>
      <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  chat: (
    <>
      <path d="M20 13.5A3.5 3.5 0 0 1 16.5 17H9l-4 3v-3.6A3.5 3.5 0 0 1 4 13V7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5z" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.2 13 5a7.6 7.6 0 0 1 2 .8l1.9-.7 1.6 2.8-1.5 1.3a7.6 7.6 0 0 1 0 2.1l1.5 1.3-1.6 2.8-1.9-.7a7.6 7.6 0 0 1-2 .8l-1 1.8h-3.2l-1-1.8a7.6 7.6 0 0 1-2-.8l-1.9.7-1.6-2.8 1.5-1.3a7.6 7.6 0 0 1 0-2.1L3.3 7.9 4.9 5.1l1.9.7a7.6 7.6 0 0 1 2-.8l1-1.8z" />
    </>
  ),
  donut: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 3.5v5" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-1.6-3 1.6-3-1.6L6 21z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.2 1.9" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 1 6.5 21H19" />
    </>
  ),
  doc: (
    <>
      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
      <path d="M13.5 3v5.5H19" />
    </>
  ),
} as const;
