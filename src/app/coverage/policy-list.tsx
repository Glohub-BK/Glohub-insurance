'use client';

import { useState } from 'react';
import { Card, Pill, Won } from '../_components/ui';

/**
 * 계약 목록 — 유형 토글.
 *
 * 실손·정액형·자동차… 를 전부 세로로 펼치면 계약이 열 건만 되어도 화면이 한없이
 * 길어진다. 유형을 칩 토글로 두고 한 번에 한 유형만 보여준다 — 기본 선택은
 * 계약이 있는 첫 유형이라, 열자마자 화면이 짧다.
 * 서버가 직렬화해 넘긴 데이터만 받는다. 이 파일은 DB 를 모른다.
 */

export type PolicyCardData = {
  id: string;
  productName: string;
  insurerName: string;
  memberName: string;
  premium: number | null;
  paymentCycle: string | null;
  status: string;
  start: string | null;
  end: string | null;
  /** 이 계약의 상품에 약관 조항이 확보돼 있는가 (공유 조항 포함 — 약관 보관함과 같은 기준). */
  hasTerms: boolean;
  cats: string[];
};

export type PolicyGroupData = {
  key: string;
  label: string;
  policies: PolicyCardData[];
};

function statusTone(status: string) {
  if (status === '유지') return 'ok' as const;
  if (status === '만기') return 'grey' as const;
  if (status === '미상') return 'warn' as const;
  return 'bad' as const;
}

function PolicyCard({ p }: { p: PolicyCardData }) {
  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <b className="block text-[16px] leading-snug">{p.productName}</b>
          <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
            {p.insurerName} · {p.memberName}
          </span>
        </span>
        <span className="flex-none text-right">
          <Won value={p.premium} className="text-[16px] font-bold" />
          {p.paymentCycle ? (
            <span className="block text-[14px]" style={{ color: 'var(--ink-3)' }}>
              {p.paymentCycle}
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Pill tone={statusTone(p.status)}>{p.status}</Pill>
        {p.cats.slice(0, 3).map((c) => (
          <Pill key={c}>{c}</Pill>
        ))}
        {p.cats.length > 3 ? <Pill>+{p.cats.length - 3}</Pill> : null}
      </div>

      <div
        className="flex items-center justify-between gap-2 border-t pt-2.5 text-[14px]"
        style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}
      >
        <span className="tnum">
          {p.start ?? '?'} ~ {p.end ?? '종신'}
        </span>
        {p.hasTerms ? (
          <Pill tone="ok">약관 확보</Pill>
        ) : (
          <Pill tone="warn">약관 미수집</Pill>
        )}
      </div>
    </Card>
  );
}

export function PolicyList({ groups }: { groups: PolicyGroupData[] }) {
  const nonEmpty = groups.filter((g) => g.policies.length > 0);
  const [selected, setSelected] = useState(nonEmpty[0]?.key ?? '');
  const current = nonEmpty.find((g) => g.key === selected) ?? nonEmpty[0];

  if (!current) {
    return (
      <Card>
        <p className="text-center text-[15px]" style={{ color: 'var(--ink-3)' }}>
          아직 수집된 계약이 없습니다.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="chiprow" role="tablist" aria-label="계약 유형">
        {nonEmpty.map((g) => {
          const active = g.key === current.key;
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={active}
              className="chip"
              style={
                active
                  ? { background: 'var(--brand-grad)', color: '#fff', borderColor: 'transparent' }
                  : { background: 'var(--white)', color: 'var(--ink-2)', borderColor: 'var(--line)' }
              }
              onClick={() => setSelected(g.key)}
            >
              {g.label} {g.policies.length}
            </button>
          );
        })}
      </div>

      {current.policies.map((p) => (
        <PolicyCard key={p.id} p={p} />
      ))}
    </>
  );
}
