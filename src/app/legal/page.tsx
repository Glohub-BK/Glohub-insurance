import Link from 'next/link';
import { LEGAL_DOCS } from '@/lib/legal/documents';
import { Card, Icon, ICONS } from '../_components/ui';
import { BusinessInfo } from '../_components/legal';
import { Beoni } from '../_components/brand';

export const metadata = { title: '약관 및 정책' };

/**
 * 법적 고지 인덱스.
 *
 * 경로는 글로버브(glohub.co.kr/legal/...)와 같은 스킴을 쓴다 — 같은 곳이 만든
 * 서비스라는 걸 사용자가 알아볼 수 있어야 한다.
 */
export default function LegalIndexPage() {
  return (
    <>
      <div>
        <h1 className="mt-1 mb-1.5 text-[22px] leading-snug font-bold tracking-[-0.02em]">
          약관 및 정책
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
          놓칠뻔이 무엇을 하고 무엇을 하지 않는지, 어떤 정보를 어떻게 다루는지 적어두었습니다.
        </p>
      </div>

      <Card className="flex items-start gap-3" tone="brand">
        <Beoni pose="shield" height={40} />
        <span className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          <b className="font-semibold">「알아두실 사항」부터 읽어보세요.</b> 이 앱이 해주는 것과
          해주지 않는 것을 한 장에 정리했습니다.
        </span>
      </Card>

      <Card className="!p-0">
        {LEGAL_DOCS.map((doc, i) => (
          <Link
            key={doc.slug}
            href={`/legal/${doc.slug}`}
            className={`flex items-center gap-3 px-4 py-3.5${i === 0 ? '' : ' border-t'}`}
            style={i === 0 ? undefined : { borderColor: 'var(--line)' }}
          >
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">{doc.title}</b>
              <span className="mt-0.5 block text-[14px]" style={{ color: 'var(--ink-3)' }}>
                {doc.summary}
              </span>
            </span>
            <span className="flex-none" style={{ color: 'var(--ink-3)' }}>
              <Icon path={ICONS.chevron} size={18} />
            </span>
          </Link>
        ))}
      </Card>

      <Card className="!p-0">
        <Link href="/about" className="flex items-center gap-3 px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold">회사 소개</b>
            <span className="mt-0.5 block text-[14px]" style={{ color: 'var(--ink-3)' }}>
              글로버브가 왜 이 앱을 만들었나
            </span>
          </span>
          <span className="flex-none" style={{ color: 'var(--ink-3)' }}>
            <Icon path={ICONS.chevron} size={18} />
          </span>
        </Link>
      </Card>

      <BusinessInfo />
    </>
  );
}
