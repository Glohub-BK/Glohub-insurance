import type { ReactNode } from 'react';
import { Icon, ICONS } from './ui';

/**
 * 이 화면의 데이터가 어디서 왔는지 밝힌다.
 *
 * 샌드박스는 계약 50건·담보 337개 같은 그럴듯한 가짜를 돌려준다. 화면이 아무 말도
 * 하지 않으면 사용자는 그것을 자기 보험으로 읽는다 — 예시 가구를 "예시"라고 밝히는
 * 것과 같은 급의 문제이고, 오히려 더 위험하다. 가짜인데 진짜처럼 생겼기 때문이다.
 */
export type DataEnvironment = 'sandbox' | 'demo' | 'api' | null;

const LABEL: Record<'sandbox' | 'demo' | 'api', { title: string; body: string; tone: 'warn' | 'ok' }> = {
  sandbox: {
    title: '샌드박스 데이터',
    body: '테스트용 가짜 계약입니다. 실제 가입 내역이 아닙니다.',
    tone: 'warn',
  },
  demo: { title: '데모 조회', body: '실제 계약을 가져왔습니다.', tone: 'ok' },
  api: { title: '정식 조회', body: '실제 계약을 가져왔습니다.', tone: 'ok' },
};

export function DataSourceNotice({
  environment,
  children,
}: {
  environment: DataEnvironment;
  children?: ReactNode;
}) {
  // 샌드박스일 때만 화면을 가로막는다. 실데이터는 조용히 지나간다.
  if (environment !== 'sandbox') return null;
  const label = LABEL.sandbox;

  return (
    <div
      className="flex items-start gap-2 rounded-[12px] px-3 py-2 text-[14px]"
      style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
      role="status"
    >
      <span className="flex-none pt-px">
        <Icon path={ICONS.alert} size={17} />
      </span>
      <span className="flex-none font-semibold whitespace-nowrap">{label.title}</span>
      <span className="min-w-0 flex-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
        {children ?? label.body}
      </span>
    </div>
  );
}
