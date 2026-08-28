'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, Icon, ICONS, Pill, shortWon } from '../_components/ui';
import { Beoni } from '../_components/brand';

/**
 * 규칙이 못 잡은 문장을 LLM + 내 약관으로 분석하는 2차 경로.
 *
 * 자동으로 부르지 않는다. 사고 문장에는 건강정보가 들어갈 수 있으므로,
 * 외부 AI 로 보내는 것은 사용자가 안내 문구를 보고 버튼을 눌러 시작한다.
 * 결과에는 반드시 「AI 분석」 라벨과 근거 조항 원문이 붙는다 —
 * 인용문은 서버의 검증 게이트가 조항 원문과 대조해 통과시킨 것만 온다.
 */

type Finding = {
  coverage: {
    policyId: string;
    memberName: string;
    insurerName: string;
    productName: string;
    name: string;
    category: string;
    amount: number | null;
  };
  applies: 'likely' | 'maybe';
  quote: string;
  reason: string;
  clause: { articleLabel: string; title: string | null; source: string };
};

type Analysis = { findings: Finding[]; summary: string; clausesSearched: number; clausesTotal: number };

export function AiAnalyze({
  text,
  normalized,
  autoRun = false,
}: {
  text: string;
  /** AI 해석기가 약관 어휘로 재서술한 문장. 조항 검색 정확도를 올린다. */
  normalized?: string;
  /** 사용자가 AI 해석에 이미 동의한 상태 — 버튼 없이 바로 분석한다. */
  autoRun?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  async function run() {
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, normalized }),
      });
      const body = (await res.json()) as Analysis & { error?: string };
      if (!res.ok) {
        setError(body.error ?? '분석에 실패했습니다.');
        setState('error');
        return;
      }
      setData(body);
      setState('done');
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setState('error');
    }
  }

  if (state === 'idle' || state === 'error') {
    return (
      <Card className="flex flex-col gap-2.5">
        <h2 className="text-[16px] font-bold">AI로 약관을 직접 분석해볼까요?</h2>
        <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          보관함의 약관 조항과 보유 담보 목록을 AI가 대조합니다. 입력하신 사고 문장이 분석을 위해
          AI 서비스(Google Gemini)로 전송됩니다. 이름·증권번호는 보내지 않습니다.
        </p>
        {state === 'error' ? (
          <p className="text-[14px] font-semibold" style={{ color: 'var(--alert)' }}>
            {error}
          </p>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={run}>
          동의하고 AI 분석 시작
        </button>
      </Card>
    );
  }

  if (state === 'loading') {
    return (
      <Card className="flex items-center gap-3 !py-6">
        {/* 멈춘 것처럼 보이면 앱이 죽은 줄 안다 — 캐릭터가 갸우뚱하며 기다린다 */}
        <span className="nc-tilt inline-flex">
          <Beoni pose="search" height={40} />
        </span>
        <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
          약관 조항을 대조하고 있어요
          <span className="nc-dot" style={{ animationDelay: '0s' }}>.</span>
          <span className="nc-dot" style={{ animationDelay: '0.2s' }}>.</span>
          <span className="nc-dot" style={{ animationDelay: '0.4s' }}>.</span>
        </span>
      </Card>
    );
  }

  if (!data) return null;

  if (data.findings.length === 0) {
    return (
      <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Pill tone="grey">AI 분석</Pill>
          <h2 className="text-[16px] font-bold">해당하는 담보를 찾지 못했어요</h2>
        </div>
        {data.summary ? (
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {data.summary}
          </p>
        ) : null}
        <p className="note">
          {data.clausesTotal === 0
            ? '약관 보관함이 비어 있어 대조할 조항이 없습니다. 보관함에서 안내에 따라 약관 PDF를 추가하면 AI가 조항을 근거로 분석할 수 있어요.'
            : `보관함의 조항 중 ${data.clausesSearched}건을 대조한 결과입니다. 다른 표현으로 다시 적어보거나, 해당 상품의 약관이 보관함에 있는지 확인해보세요.`}
        </p>
        <Link href="/terms" className="btn btn-primary">
          약관 보관함 열기 — 받는 법도 안내해드려요
        </Link>
      </Card>
    );
  }

  return (
    <>
      <Card className="flex flex-col gap-1.5" style={{ borderColor: 'var(--brand)' }}>
        <div className="flex items-center gap-2">
          <Pill tone="grey">AI 분석</Pill>
          <h2 className="text-[16px] font-bold">약관에서 이런 근거를 찾았어요</h2>
        </div>
        {data.summary ? (
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {data.summary}
          </p>
        ) : null}
      </Card>

      {data.findings.map((f, i) => (
        <Card key={i} className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <b className="block text-[15px] font-bold">{f.coverage.name}</b>
              <span className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                {f.coverage.memberName} · {f.coverage.insurerName} · {f.coverage.productName}
              </span>
            </div>
            <Pill tone={f.applies === 'likely' ? 'ok' : 'warn'}>
              {f.applies === 'likely' ? '해당 가능성 높음' : '조건 확인 필요'}
            </Pill>
          </div>

          {f.coverage.amount !== null ? (
            <p className="text-[14px]" style={{ color: 'var(--ink-2)' }}>
              가입금액 <b className="font-semibold">{shortWon(f.coverage.amount)}</b>
              <span style={{ color: 'var(--ink-3)' }}> — 보장내역 기준</span>
            </p>
          ) : null}

          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {f.reason}
          </p>

          {/* 근거 조항 — 서버가 원문 대조를 통과시킨 인용만 온다 */}
          <blockquote
            className="rounded-[10px] px-3.5 py-3 text-[14px] leading-relaxed"
            style={{
              background: 'var(--sub)',
              borderLeft: '3px solid var(--brand)',
              // 인용이 길어도 카드가 화면을 밀어내지 않는다 — 안에서 스크롤.
              maxHeight: 220,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            “{f.quote}”
            <footer className="mt-1.5 text-[13px]" style={{ color: 'var(--ink-3)' }}>
              {f.clause.source} · {f.clause.articleLabel}
              {f.clause.title ? ` ${f.clause.title}` : ''}
            </footer>
          </blockquote>
        </Card>
      ))}

      <Card flat className="flex items-start gap-2.5">
        <span className="mt-0.5 flex-none" style={{ color: 'var(--ink-3)' }}>
          <Icon path={ICONS.alert} size={18} />
        </span>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          AI가 약관 조항을 대조한 참고 정보입니다. 실제 지급 여부와 금액은 보험회사의 심사로
          결정됩니다. 인용된 조항은 약관 보관함의 원문과 대조를 거쳤습니다.
        </p>
      </Card>
    </>
  );
}
