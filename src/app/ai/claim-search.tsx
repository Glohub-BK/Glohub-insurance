'use client';

import { useState } from 'react';
import {
  matchIncident,
  type CoverageCandidate,
  type MatchResult,
} from '@/lib/domain/incident-match';
import { Card, Disclaimer, Icon, ICONS, Pill, shortWon } from '../_components/ui';

const EXAMPLES = [
  { chip: '아이가 물건 파손', q: '아이가 친구 안경을 깨뜨렸어요' },
  { chip: '넘어져서 골절', q: '계단에서 넘어져서 손목이 골절됐어요' },
  { chip: '병원 통원', q: '감기로 병원 다녀왔어요 진료비 3만원' },
  { chip: '주차 중 접촉', q: '주차하다 옆차를 긁었어요' },
  { chip: '누수 피해', q: '윗집 누수로 우리집 벽지가 젖었어요' },
  { chip: '중대질병 진단', q: '암 진단을 받았어요' },
];

export function ClaimSearch({
  candidates,
  initialQuery = '',
}: {
  candidates: CoverageCandidate[];
  initialQuery?: string;
}) {
  const [text, setText] = useState(initialQuery);
  const [result, setResult] = useState<MatchResult | null>(
    initialQuery.trim() ? matchIncident(initialQuery.trim(), candidates) : null,
  );

  function run(q: string) {
    const trimmed = q.trim();
    if (trimmed.length === 0) return;
    setText(trimmed);
    setResult(matchIncident(trimmed, candidates));
  }

  return (
    <>
      <div>
        <h1 className="mt-1 mb-1.5 text-[22px] leading-snug font-bold tracking-[-0.02em]">
          무슨 일이 있었나요?
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
          있었던 일을 그대로 적어주세요. 보장내역에서 해당되는 담보를 찾아 드릴게요.
        </p>
      </div>

      <div
        className="flex min-h-[56px] items-center gap-2.5 rounded-[14px] px-3.5"
        style={{ background: 'var(--white)', border: '2px solid var(--brand)', boxShadow: 'var(--e2)' }}
      >
        <span className="flex-none" style={{ color: 'var(--ink-3)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="20" height="20" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <label htmlFor="incident" className="sr-only">
          사고 상황
        </label>
        <input
          id="incident"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run(text);
          }}
          placeholder="예: 아이가 친구 안경을 깨뜨렸어요"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          style={{ color: 'var(--ink)' }}
        />
        <button
          type="button"
          onClick={() => run(text)}
          aria-label="담보 찾기"
          className="grid size-10 flex-none place-items-center rounded-[12px] text-white"
          style={{ background: 'var(--brand-grad)', boxShadow: 'var(--e-brand)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19" aria-hidden="true">
            <path d="m5 12 14 0M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="chiprow">
        {EXAMPLES.map((e) => (
          <button key={e.chip} type="button" className="chip" onClick={() => run(e.q)}>
            {e.chip}
          </button>
        ))}
      </div>

      {result === null ? (
        <Card flat>
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            보유하신 담보 <b className="font-semibold">{candidates.length}개</b>를 대상으로 찾습니다.
            누가 다쳤는지, 무엇이 망가졌는지, 언제 어디서 일어났는지를 적으면 더 정확합니다.
          </p>
        </Card>
      ) : null}

      {result?.kind === 'unknown' ? <UnknownResult /> : null}
      {result?.kind === 'matched' ? <MatchedResult result={result} /> : null}
    </>
  );
}

function UnknownResult() {
  return (
    <>
      <Card style={{ background: 'var(--alert-soft)', borderColor: 'var(--alert-line)' }}>
        <h2 className="text-[17px] font-bold" style={{ color: 'var(--alert)' }}>
          어떤 사고인지 판단하지 못했어요
        </h2>
        <p className="mt-1 text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          입력하신 문장에서 사고 유형을 찾지 못했습니다. 조금 더 구체적으로 적어주세요.
        </p>
      </Card>
      <Card>
        <h2 className="text-[16px] font-semibold">이렇게 적어보세요</h2>
        <ul className="mt-2.5 flex flex-col gap-2">
          {[
            '누가 다쳤는지 / 무엇이 망가졌는지',
            '언제 어디서 일어났는지',
            '병원에 갔다면 진단명이나 진료 종류',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[15px]">
              <span className="mt-0.5 flex-none" style={{ color: 'var(--brand-ink)' }}>
                <Icon path={ICONS.check} size={19} />
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function MatchedResult({ result }: { result: Extract<MatchResult, { kind: 'matched' }> }) {
  const { rule, coverages, noCoverage } = result;

  return (
    <>
      <Card
        style={
          noCoverage
            ? { background: 'var(--warn-soft)', borderColor: 'var(--warn-line)' }
            : { background: 'var(--brand-soft)', borderColor: 'var(--brand-line)' }
        }
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="flex-none" style={{ color: noCoverage ? 'var(--warn)' : 'var(--brand-ink)' }}>
            <Icon path={noCoverage ? ICONS.alert : ICONS.check} size={21} />
          </span>
          <h2
            className="text-[17px] font-bold"
            style={{ color: noCoverage ? 'var(--warn)' : 'var(--brand-ink)' }}
          >
            {noCoverage ? '해당 담보를 보유하고 있지 않아요' : rule.headline}
          </h2>
        </div>
        <p className="text-[15px] leading-relaxed">
          {noCoverage
            ? `${rule.label} 사고로 판단했지만, 우리집 보장내역에 해당 담보가 없습니다. 아래 약관 조항은 이 사고에 통상 적용되는 내용이니 다른 가족 계약이나 상대방 보험을 확인해보세요.`
            : rule.lead}
        </p>
      </Card>

      {coverages.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
            적용 가능한 담보 {coverages.length}건
          </span>
          {coverages.map((c, i) => (
            <div
              key={`${c.policyId}-${c.name}-${i}`}
              className="rounded-[11px] p-3"
              style={{ background: 'var(--brand-soft)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <b className="text-[16px] leading-snug" style={{ color: 'var(--brand-ink)' }}>
                  {c.name}
                </b>
                <span className="tnum flex-none text-[16px] font-bold">
                  {c.amount === null || !Number.isFinite(Number(c.amount)) ? (
                    <span style={{ color: 'var(--ink-3)' }}>—</span>
                  ) : (
                    <>
                      {shortWon(Number(c.amount))}
                      <span className="ml-0.5 text-[14px] font-medium">원</span>
                    </>
                  )}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Pill tone="ok">{c.memberName}</Pill>
                <span className="text-[14px]" style={{ color: 'var(--ink-2)' }}>
                  {c.insurerName} · {c.productName}
                </span>
              </div>
            </div>
          ))}
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {rule.note}
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-[16px] font-semibold">판단 근거 — 약관 원문</h2>
        <p className="quote mt-2.5">{rule.quote}</p>
        <p className="mt-2.5 text-[14px]" style={{ color: 'var(--ink-3)' }}>
          가입하신 상품의 약관 문구는 다를 수 있습니다. 약관 수집이 끝나면 실제 조항으로 대체됩니다.
        </p>
      </Card>

      <Card>
        <h2 className="text-[16px] font-semibold">준비할 서류</h2>
        <ul className="mt-2.5 flex flex-col gap-2">
          {rule.docs.map((d) => (
            <li key={d} className="flex items-start gap-2.5 text-[15px]">
              <span className="mt-0.5 flex-none" style={{ color: 'var(--brand-ink)' }}>
                <Icon path={ICONS.check} size={19} />
              </span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            청구 경로
          </span>
          <span className="max-w-[62%] text-right text-[15px] font-semibold">{rule.route}</span>
        </div>
        <div
          className="flex items-center justify-between gap-3 border-t pt-2.5"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            청구 기한
          </span>
          <Pill tone="warn">사고일로부터 3년</Pill>
        </div>
      </Card>

      <Card style={{ background: 'var(--warn-soft)', borderColor: 'var(--warn-line)' }}>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex-none" style={{ color: 'var(--warn)' }}>
            <Icon path={ICONS.alert} size={21} />
          </span>
          <span className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            <b className="block font-semibold" style={{ color: 'var(--warn)' }}>
              면책 주의
            </b>
            {rule.warn}
          </span>
        </div>
      </Card>

      <Disclaimer />
    </>
  );
}
