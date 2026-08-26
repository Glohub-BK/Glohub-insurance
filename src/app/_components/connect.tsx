import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, Icon, ICONS } from './ui';

/**
 * 연결 전 화면 최상단에 붙는 라벨.
 * 예시 데이터를 내 데이터로 오인하면 잘못된 판단으로 이어진다. 숨기지 않는다.
 */
export function PreviewNotice({ children }: { children?: ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-[12px] px-3 py-2 text-[14px]"
      style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
    >
      <span className="flex-none pt-px">
        <Icon path={ICONS.alert} size={17} />
      </span>
      {/* 라벨은 절대 줄바꿈되지 않게 둔다. "예시 화 / 면" 으로 쪼개지면 경고로 읽히지 않는다. */}
      <span className="flex-none font-semibold whitespace-nowrap">예시 화면</span>
      <span className="min-w-0 flex-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
        {children ?? '실제 내 보험이 아닙니다'}
      </span>
    </div>
  );
}

/**
 * 연결 유도 카드. 굿리치처럼 금액을 가려두고 "조회하기"로 넘긴다.
 * 다른 점은 이걸 앱 첫 화면이 아니라 체험 뒤에 놓는다는 것이다.
 */
export function ConnectCard({
  title = '내 보험을 연결하면',
  lines = ['가족이 가입한 보험을 전부 모아 보고', '사고가 났을 때 청구할 담보를 찾아드립니다'],
  cta = '내 보험 연결하기',
}: {
  title?: string;
  lines?: string[];
  cta?: string;
}) {
  return (
    <Card tone="brand" className="flex flex-col gap-3">
      <div>
        <b className="text-[17px]" style={{ color: 'var(--brand-ink)' }}>
          {title}
        </b>
        {lines.map((l) => (
          <span key={l} className="block text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {l}
          </span>
        ))}
      </div>
      <Link href="/connect" className="btn btn-primary">
        {cta}
      </Link>
      <p className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
        한국신용정보원 계정으로 연결합니다. 주민등록번호는 저장하지 않습니다.
      </p>
    </Card>
  );
}

/** 금액을 가리고 그 위에 연결 버튼을 얹는다. */
export function MaskedAmount({ label }: { label: string }) {
  return (
    <Card>
      <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
        {label}
      </span>
      <div className="relative mt-0.5">
        <div
          className="tnum text-[34px] leading-[1.1] font-bold tracking-[-0.03em] select-none"
          style={{ filter: 'blur(7px)', color: 'var(--ink-3)' }}
          aria-hidden="true"
        >
          402,910원
        </div>
        <span className="sr-only">연결 전에는 보험료를 볼 수 없습니다</span>
      </div>
      <Link href="/connect" className="btn btn-primary mt-3">
        내 보험 조회하기
      </Link>
    </Card>
  );
}
