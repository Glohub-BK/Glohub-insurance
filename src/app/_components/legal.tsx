import type { ReactNode } from 'react';
import Link from 'next/link';
import { COMPANY } from '@/lib/legal/company';
import type { LegalDoc } from '@/lib/legal/documents';
import { Card, Icon, ICONS } from './ui';

/**
 * 법적 고지 문서 렌더러.
 *
 * 본문에 `**강조**` 만 허용한다. 마크다운 파서를 들이면 문서에 링크·이미지가 섞이기
 * 시작하고, 법적 고지에 그런 게 들어가면 원문과 표시가 어긋난다.
 */
function emphasize(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <b key={i} className="font-semibold" style={{ color: 'var(--ink)' }}>
        {part.slice(2, -2)}
      </b>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function LegalBody({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <div>
        <h1 className="mt-1 mb-1.5 text-[22px] leading-snug font-bold tracking-[-0.02em]">
          {doc.title}
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
          {doc.summary}
        </p>
        <p className="mt-1.5 text-[14px]" style={{ color: 'var(--ink-3)' }}>
          근거 {doc.basis} · 시행일 {doc.effectiveFrom}
        </p>
      </div>

      {doc.sections.map((s) => (
        <Card key={s.heading} className="flex flex-col gap-2.5">
          <h2 className="text-[16px] font-bold" style={{ color: 'var(--brand-ink)' }}>
            {s.heading}
          </h2>
          {s.body.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {emphasize(p)}
            </p>
          ))}
          {s.list ? (
            <ul className="flex flex-col gap-2">
              {s.list.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-[15px] leading-relaxed"
                  style={{ color: 'var(--ink-2)' }}
                >
                  <span className="mt-0.5 flex-none" style={{ color: 'var(--brand-ink)' }}>
                    <Icon path={ICONS.check} size={18} />
                  </span>
                  <span>{emphasize(item)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ))}

      <BusinessInfo />
    </>
  );
}

/**
 * 사업자 정보.
 *
 * 전자상거래법·정보통신망법상 표시 의무 항목이다. 약관 안쪽에 묻지 않고 문서마다
 * 하단에 같은 모양으로 붙인다 — 어느 문서를 열어도 누가 운영하는지 보여야 한다.
 */
export function BusinessInfo() {
  const rows: [string, ReactNode][] = [
    ['서비스', COMPANY.serviceName],
    ['운영', COMPANY.operator],
    ['대표', COMPANY.representative],
    ['사업자등록번호', COMPANY.businessNumber],
    [
      '문의',
      <a key="m" href={`mailto:${COMPANY.email}`} style={{ color: 'var(--brand-ink)' }}>
        {COMPANY.email}
      </a>,
    ],
  ];

  return (
    <Card className="!p-0">
      <div className="px-4 pt-3.5 pb-1 text-[14px] font-semibold" style={{ color: 'var(--ink-3)' }}>
        사업자 정보
      </div>
      <dl className="flex flex-col">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-baseline justify-between gap-3 border-t px-4 py-2.5"
            style={{ borderColor: 'var(--line)' }}
          >
            <dt className="flex-none text-[14px]" style={{ color: 'var(--ink-3)' }}>
              {k}
            </dt>
            <dd className="text-right text-[15px]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="note m-4 mt-3">
        놓칠뻔은 글로버브가 만듭니다. 같은 곳에서 만든 다른 서비스는{' '}
        <a href={COMPANY.site} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-ink)' }}>
          glohub.co.kr
        </a>{' '}
        에 있습니다.
      </p>
    </Card>
  );
}

/** 모든 문서로 가는 길. 문서 하단과 내 정보에서 같은 모양으로 쓴다. */
export function LegalLinks() {
  return (
    <Link
      href="/legal"
      className="flex items-center justify-between gap-3 px-4 py-3.5 text-[15px] font-semibold"
    >
      약관 및 정책 전체 보기
      <span style={{ color: 'var(--ink-3)' }}>
        <Icon path={ICONS.chevron} size={18} />
      </span>
    </Link>
  );
}
