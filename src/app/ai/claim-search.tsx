'use client';

import { useState } from 'react';
import {
  explainMatch,
  groupByPolicy,
  hasPersonInjuryContext,
  matchIncident,
  type CoverageCandidate,
  type MatchedCoverage,
  type MatchResult,
} from '@/lib/domain/incident-match';
import { BASIS_LABEL, BASIS_SUFFIX } from '@/lib/domain/coverage-basis';
import { Beoni } from '../_components/brand';
import { AiAnalyze } from './ai-analyze';
import type { ClauseCitation } from '@/lib/repo/terms';
import { Card, Disclaimer, Icon, ICONS, Pill, shortWon } from '../_components/ui';
import { ConnectCard, PreviewNotice } from '../_components/connect';

const CONSENT_KEY = 'nochil-ai-interpret-consent';

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
  preview = false,
  citations = {},
  aiEnabled = false,
}: {
  candidates: CoverageCandidate[];
  initialQuery?: string;
  /** 연결 전 예시 담보로 돌고 있는지. 화면에 반드시 밝힌다. */
  preview?: boolean;
  /** 사고 유형별로 내 약관에서 찾은 조항. 없으면 규칙 파일의 예시 문구를 쓴다. */
  citations?: Partial<Record<string, ClauseCitation>>;
  /** 서버에 GEMINI_API_KEY 가 있을 때만 true. 예시 데이터에는 AI 를 붙이지 않는다. */
  aiEnabled?: boolean;
}) {
  const [text, setText] = useState(initialQuery);
  const [ran, setRan] = useState(initialQuery.trim());
  const [result, setResult] = useState<MatchResult | null>(
    initialQuery.trim() ? matchIncident(initialQuery.trim(), candidates) : null,
  );
  // AI 해석기 상태. 해석은 관문이지 결론이 아니다 — 실패하면 키워드 규칙으로 폴백한다.
  const [interpreting, setInterpreting] = useState(false);
  const [normalized, setNormalized] = useState<string | undefined>(undefined);
  // 'unknown' 은 아직 물어보지 않은 상태. 저장소는 서버 렌더와 첫 화면에 없으므로
  // 렌더에서 읽지 않는다 — 검색 버튼을 누르는 순간(이벤트 핸들러)에만 읽는다.
  // 그래야 서버와 클라이언트의 첫 화면이 어긋나지 않는다.
  const [consent, setConsent] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [pending, setPending] = useState<string | null>(null);

  function storedConsent(): 'unknown' | 'granted' | 'denied' {
    try {
      const saved = localStorage.getItem(CONSENT_KEY);
      return saved === 'granted' || saved === 'denied' ? saved : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  function saveConsent(value: 'granted' | 'denied') {
    setConsent(value);
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // 저장 실패해도 이번 세션은 동작한다
    }
  }

  function runKeyword(trimmed: string) {
    setNormalized(undefined);
    setResult(matchIncident(trimmed, candidates));
  }

  async function runWithAi(trimmed: string) {
    setInterpreting(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/interpret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const body = (await res.json()) as {
        interpretation: { ruleId: string | null; normalizedQuery: string } | null;
      };
      const it = res.ok ? body.interpretation : null;
      setNormalized(it?.normalizedQuery);
      // 해석이 규칙을 짚으면 그 규칙으로, 못 짚으면 키워드로 — 결정은 여기까지가 AI 의 몫이고
      // 담보 선별·금액·인용은 전부 기존 결정적 코드가 한다.
      setResult(matchIncident(trimmed, candidates, it?.ruleId ? { forceRuleId: it.ruleId } : undefined));
    } catch {
      runKeyword(trimmed);
    } finally {
      setInterpreting(false);
    }
  }

  function run(q: string) {
    const trimmed = q.trim();
    if (trimmed.length === 0) return;
    setText(trimmed);
    setRan(trimmed);
    const effective = consent !== 'unknown' ? consent : storedConsent();
    if (effective !== consent && effective !== 'unknown') setConsent(effective);
    if (!aiEnabled || preview || effective === 'denied') {
      runKeyword(trimmed);
      return;
    }
    if (effective === 'unknown') {
      // 첫 검색 — 전송 전에 한 번 묻는다. 답을 받으면 이 질의를 그대로 이어간다.
      setPending(trimmed);
      setResult(null);
      return;
    }
    void runWithAi(trimmed);
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

      {preview ? <PreviewNotice>예시 가구의 담보 {candidates.length}개로 진단합니다</PreviewNotice> : null}

      {result === null ? (
        <Card flat>
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {preview ? '예시 가구의' : '보유하신'} 담보{' '}
            <b className="font-semibold">{candidates.length}개</b>를 대상으로 찾습니다. 누가 다쳤는지,
            무엇이 망가졌는지, 언제 어디서 일어났는지를 적으면 더 정확합니다.
          </p>
        </Card>
      ) : null}

      {/* 최초 1회 동의 — 이후에는 모든 검색 문장을 AI 가 먼저 약관 어휘로 해석한다 */}
      {pending !== null && consent === 'unknown' ? (
        <Card className="flex flex-col gap-2.5">
          <h2 className="text-[16px] font-bold">더 정확한 검색을 위해 AI 해석을 켤까요?</h2>
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            어떻게 적어도 알아듣도록, 입력하신 사고 문장을 AI(Google Gemini)가 보험 용어로
            해석합니다. 문장에는 건강 정보가 포함될 수 있고, 해석 목적으로만 전송되며 저장되지
            않습니다. 이름·증권번호는 보내지 않습니다. 한 번 동의하면 다음부터는 바로 검색됩니다.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                saveConsent('granted');
                setPending(null);
                void runWithAi(pending);
              }}
            >
              동의하고 검색
            </button>
            <button
              type="button"
              className="rounded-[12px] px-3 py-2 text-[14px] font-semibold"
              style={{ background: 'var(--sub)', border: '1px solid var(--line)' }}
              onClick={() => {
                saveConsent('denied');
                setPending(null);
                runKeyword(pending);
              }}
            >
              AI 없이 검색
            </button>
          </div>
        </Card>
      ) : null}

      {interpreting ? (
        <Card className="flex items-center gap-3 !py-6">
          <span className="nc-tilt inline-flex">
            <Beoni pose="search" height={40} />
          </span>
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            문장을 해석하는 중
            <span className="nc-dot" style={{ animationDelay: '0s' }}>.</span>
            <span className="nc-dot" style={{ animationDelay: '0.2s' }}>.</span>
            <span className="nc-dot" style={{ animationDelay: '0.4s' }}>.</span>
          </span>
        </Card>
      ) : null}

      {result?.kind === 'unknown' ? <UnknownResult /> : null}
      {result?.kind === 'matched' ? (
        <MatchedResult
          result={result}
          citation={citationFor(citations, result.rule.id, ran)}
          queryText={ran}
          candidates={candidates}
        />
      ) : null}

      {/* 규칙이 못 잡았거나 보유 담보가 없으면, 약관 조항을 AI 로 직접 대조하는 2차 경로.
          이미 동의했으면 버튼 없이 바로 돈다. 예시 데이터(preview)에는 붙이지 않는다. */}
      {aiEnabled &&
      !preview &&
      (result?.kind === 'unknown' || (result?.kind === 'matched' && result.noCoverage)) ? (
        <AiAnalyze key={ran} text={ran} normalized={normalized} autoRun={consent === 'granted'} />
      ) : null}

      {/* AI 를 껐던 사용자가 마음을 바꿀 길 */}
      {aiEnabled && !preview && consent === 'denied' ? (
        <button
          type="button"
          className="text-left text-[13px] underline"
          style={{ color: 'var(--ink-3)' }}
          onClick={() => saveConsent('granted')}
        >
          AI 해석이 꺼져 있어요 — 다시 켜기
        </button>
      ) : null}

      {/* 결과를 다 본 뒤에 연결을 권한다. 앞에 세우지 않는다. */}
      {preview && result !== null ? (
        <ConnectCard
          title="내 보험으로도 확인해보세요"
          lines={['방금 본 진단을 우리 가족의 실제 담보로 돌립니다', '가입한 보험을 몰라서 놓치는 일이 없게']}
        />
      ) : null}
    </>
  );
}

/**
 * 사고 유형에 맞는 근거 조항을 고른다.
 *
 * 자동차 사고는 물적/인명 갈래에 따라 근거 조항이 다르다 — 「옆차를 긁었어요」의
 * 근거는 대물배상 조항이지, 자기신체사고 조항이 아니다. 갈래 조항이 없으면
 * 공용 자동차 키로, 그것도 없으면 null(규칙 예시 문구)로 떨어진다.
 */
function citationFor(
  citations: Partial<Record<string, ClauseCitation>>,
  ruleId: string,
  text: string,
): ClauseCitation | null {
  if (ruleId === 'car') {
    const key = hasPersonInjuryContext(text) ? 'car-person' : 'car-property';
    return citations[key] ?? citations.car ?? null;
  }
  return citations[ruleId] ?? null;
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

/**
 * 담보 한 줄.
 *
 * 금액 옆에 **지급 방식**을 반드시 붙인다. 5,000만원이 「연간 한도」인지 「1회 정액」인지
 * 「하루치」인지가 신청 방법을 바꾼다. 이걸 안 적으면 세 숫자가 같은 것처럼 읽힌다.
 */
function CoverageLine({ c }: { c: MatchedCoverage }) {
  return (
    <div className="border-t pt-2.5 first:border-0 first:pt-0" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-start justify-between gap-3">
        <b className="text-[15px] leading-snug" style={{ color: 'var(--brand-ink)' }}>
          {c.name}
        </b>
        <span className="flex-none text-right">
          {c.shownAmount === null ? (
            <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
              가입금액 확인 필요
            </span>
          ) : (
            <b className="grad-num tnum text-[18px] font-extrabold">
              {shortWon(c.shownAmount)}원
            </b>
          )}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Pill tone={c.basis === 'actual' ? 'ok' : 'grey'}>{BASIS_LABEL[c.basis]}</Pill>
        {BASIS_SUFFIX[c.basis] ? (
          <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
            {BASIS_SUFFIX[c.basis]}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** 계약 하나 = 접수처 하나. 이 묶음이 곧 "어디에 무엇을 넣을지" 다. */
function PolicyCard({
  group,
  index,
}: {
  group: ReturnType<typeof groupByPolicy>[number];
  index: number;
}) {
  return (
    <div className="glowcard">
      <div className="inner">
        <div className="flex items-center gap-2">
          <span
            className="grid size-[22px] flex-none place-items-center rounded-full text-[13px] font-bold text-white"
            style={{ background: 'var(--brand)' }}
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] leading-snug">{group.insurerName}</b>
            <span className="block text-[14px]" style={{ color: 'var(--ink-3)' }}>
              {group.productName}
            </span>
          </span>
          <Pill tone="ok">{group.memberName}</Pill>
        </div>
        <div className="mt-2.5 flex flex-col gap-2.5">
          {group.coverages.map((c, i) => (
            <CoverageLine key={`${c.policyId}-${c.name}-${i}`} c={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchedResult({
  result,
  citation,
  queryText,
  candidates,
}: {
  result: Extract<MatchResult, { kind: 'matched' }>;
  citation: ClauseCitation | null;
  queryText: string;
  candidates: CoverageCandidate[];
}) {
  const { rule, coverages, related, noCoverage } = result;

  // 담보를 못 찾았을 때는 히어로를 쓰지 않는다. 화려한 판 위에 나쁜 소식을 얹으면
  // 무엇을 읽어야 할지 알 수 없다.
  if (noCoverage) {
    return (
      <>
        <Card style={{ background: 'var(--warn-soft)', borderColor: 'var(--warn-line)' }}>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex-none">
              <Beoni pose="sorry" height={34} />
            </span>
            <h2 className="text-[17px] font-bold" style={{ color: 'var(--warn)' }}>
              해당 담보를 보유하고 있지 않아요
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed">
            {rule.label} 사고로 판단했지만, 우리집 보장내역에 해당 담보가 없습니다. 아래 약관 조항은
            이 사고에 통상 적용되는 내용이니 다른 가족 계약이나 상대방 보험을 확인해보세요.
          </p>
        </Card>
        <RelatedCoverages items={related} />
        <WhyNoCoverage text={queryText} candidates={candidates} />
        <ClauseCard citation={citation} fallback={rule.quote} />
        <ClaimGuide rule={rule} />
      </>
    );
  }

  const groups = groupByPolicy(coverages);
  const byBasis = {
    actual: coverages.filter((c) => c.basis === 'actual').length,
    lumpsum: coverages.filter((c) => c.basis === 'lumpsum').length,
    daily: coverages.filter((c) => c.basis === 'daily').length,
  };
  // 지급 방식별 건수. 금액을 더하지 않는다 — 실손 한도·1회 정액·하루치는 단위가 다르다.
  const mix = [
    byBasis.actual > 0 ? `실손 ${byBasis.actual}` : null,
    byBasis.lumpsum > 0 ? `정액 ${byBasis.lumpsum}` : null,
    byBasis.daily > 0 ? `일당 ${byBasis.daily}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {/* 히어로 — 이 화면의 결론을 한 판에 담는다. */}
      <div className="aihero">
        <div className="flex items-center gap-2.5">
          <Beoni pose="found" height={44} />
          <span className="min-w-0 flex-1">
            <b className="block text-[13px] font-bold tracking-[0.08em]" style={{ color: 'rgba(255,255,255,.8)' }}>
              놓칠 뻔했어요
            </b>
            <b className="block text-[19px] leading-snug font-bold">{rule.headline}</b>
          </span>
        </div>
        <p className="lead mt-2 text-[15px] leading-relaxed">{rule.lead}</p>

        <div className="slab">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px]" style={{ color: 'var(--ink-3)' }}>
              청구할 담보
            </span>
            <b className="grad-num tnum text-[24px] leading-tight font-extrabold">
              {coverages.length}건
            </b>
          </span>
          <span className="w-px self-stretch" style={{ background: 'var(--line)' }} />
          <span className="min-w-0 flex-1 text-right">
            <span className="block text-[14px]" style={{ color: 'var(--ink-3)' }}>
              접수할 곳
            </span>
            <b className="grad-num tnum text-[24px] leading-tight font-extrabold">
              {groups.length}곳
            </b>
          </span>
        </div>
        {mix ? (
          <p className="mt-2 text-[13px]" style={{ color: 'rgba(255,255,255,.78)' }}>
            {mix} · 지급 방식이 달라 금액을 합산하지 않습니다.
          </p>
        ) : null}
      </div>

      {/* 어느 보험의 · 어느 담보를 · 얼마 기준으로 */}
      <div className="flex flex-col gap-2.5">
        {groups.map((g, i) => (
          <PolicyCard key={g.policyId} group={g} index={i} />
        ))}
      </div>

      <Card flat>
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {rule.note}
        </p>
      </Card>

      <RelatedCoverages items={related} />
      <ClauseCard citation={citation} fallback={rule.quote} />
      <ClaimGuide rule={rule} />
    </>
  );
}

/**
 * 곁가지 담보.
 *
 * 같은 분류에 있지만 담보 이름이 이 사고와 직접 이어지지 않는 것들이다.
 * 지우지 않는 이유: 판단은 사람이 한다. 앞에 세우지 않는 이유: 감기로 통원했는데
 * 암진단비까지 31건이 늘어서면 정작 넣어야 할 담보가 묻힌다.
 */
function RelatedCoverages({ items }: { items: MatchedCoverage[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="!p-0">
      <details>
        <summary className="cursor-pointer px-4 py-3.5 text-[15px] font-semibold">
          같은 분류의 다른 담보 {items.length}건
          <span className="ml-1.5 font-normal" style={{ color: 'var(--ink-3)' }}>
            직접 해당하진 않아요
          </span>
        </summary>
        <div className="flex flex-col gap-2.5 px-4 pt-1 pb-3.5">
          {items.map((c, i) => (
            <CoverageLine key={`${c.policyId}-${c.name}-${i}`} c={c} />
          ))}
        </div>
      </details>
    </Card>
  );
}

/**
 * 판단 근거. 내 약관에서 찾은 조항이 있으면 그것을 쓰고, 없을 때만 예시 문구를 쓰되
 * 반드시 예시라고 밝힌다 — 없는 근거를 있는 것처럼 보여주지 않는다.
 */

const FATE_LABEL: Record<string, string> = {
  direct: '✅ 직접 해당',
  related: '참고로 분류됨',
  'cause-mismatch': '참고 (원인 상충)',
  'excluded-name': '제외 — 이름 규칙',
  'excluded-kind': '제외 — 계약 종류',
  'excluded-context': '제외 — 교통 전용 담보 (차·운전 정황 없음)',
  'excluded-status': '제외 — 해지·소멸',
  'out-of-category': '이 사고 유형의 대상 아님',
};

/**
 * "담보가 없다"는 결론의 계산 근거를 그 자리에서 펼쳐 보인다.
 *
 * 결론만 던지면 사용자는 "일배책 있는데?" 라며 앱을 불신하고, 운영자는 스크린샷으로
 * 추측한다 — 실제로 그 왕복을 여러 번 했다. 어떤 담보가 어떤 규칙에 걸려 어디로
 * 갔는지 보여주면, 오판이면 그 줄이 바로 신고 내용이 된다.
 */
function WhyNoCoverage({ text, candidates }: { text: string; candidates: CoverageCandidate[] }) {
  const [open, setOpen] = useState(false);
  const [showRest, setShowRest] = useState(false);
  const ex = explainMatch(text, candidates);
  if (!ex.ruleId) return null;
  // 이 사고 유형이 보는 분류의 담보만 앞에 세운다. 나머지는 접어 두되 **숨기지는 않는다** —
  // 「일배책이 없다」는 판정을 확인하려면, 다른 분류로 잘못 들어간 담보가 없다는 것까지
  // 눈으로 볼 수 있어야 한다. 접힌 목록이 그 사각지대를 메운다.
  const rows = ex.rows.filter((r) => r.fate !== 'out-of-category');
  const rest = ex.rows.filter((r) => r.fate === 'out-of-category');

  return (
    <Card flat>
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-[14px] font-semibold"
        onClick={() => setOpen((v) => !v)}
      >
        <span>이렇게 판단했어요 — 담보별 상세</span>
        <span style={{ color: 'var(--ink-3)' }}>{open ? '접기' : '펼치기'}</span>
      </button>
      {open ? (
        <ul className="mt-2.5 flex flex-col gap-2">
          {rows.length === 0 ? (
            <li className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
              이 사고 유형이 보는 분류의 담보가 보장내역에 없습니다.
            </li>
          ) : (
            rows.map((r, i) => (
              <li key={i} className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                <b className="font-semibold">{r.candidate.name}</b>
                <span style={{ color: 'var(--ink-3)' }}>
                  {' '}
                  ({r.candidate.insurerName} · {r.candidate.contractKind ?? '종류 미상'}) —{' '}
                  {FATE_LABEL[r.fate] ?? r.fate}
                </span>
                <span className="block" style={{ color: 'var(--ink-3)' }}>
                  {r.detail}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {open && rest.length > 0 ? (
        <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: 'var(--line)' }}>
          <button
            type="button"
            className="text-left text-[13px] underline"
            style={{ color: 'var(--ink-3)' }}
            onClick={() => setShowRest((v) => !v)}
          >
            {showRest
              ? '다른 분류 담보 접기'
              : `이 사고와 다른 분류로 잡힌 담보 ${rest.length}건 보기`}
          </button>
          {showRest ? (
            <ul className="mt-2 flex flex-col gap-1">
              {rest.map((r, i) => (
                <li key={i} className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                  {r.candidate.name}
                  <span> — {r.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function ClauseCard({ citation, fallback }: { citation: ClauseCitation | null; fallback: string }) {
  // 약관 조항은 한 조가 수백 자다. 전문을 다 펼치면 화면이 근거에 파묻힌다 —
  // 핵심 4줄만 보여주고, 원문 전체는 원하는 사람만 편다.
  const [open, setOpen] = useState(false);
  const body = citation ? citation.body : fallback;
  const long = body.length > 160;
  return (
    <Card>
      <h2 className="text-[16px] font-semibold">판단 근거 — 약관 원문</h2>
      {/* 펼쳐도 페이지가 길어지지 않는다 — 카드 안에서 스크롤로 읽는다.
          긴 조항이 화면 전체를 밀어내면 아래의 서류·기한 안내가 파묻힌다. */}
      <div
        className="mt-2.5"
        style={
          open
            ? { maxHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain' }
            : undefined
        }
      >
        <p
          className="quotecard"
          style={
            open || !long
              ? undefined
              : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
          }
        >
          {body}
        </p>
      </div>
      {long ? (
        <button
          type="button"
          className="mt-1.5 self-start text-[13px] font-semibold underline"
          style={{ color: 'var(--brand-ink)' }}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '접기' : '원문 전체 보기 (스크롤)'}
        </button>
      ) : null}
      {citation ? (
        <span className="quote-src">
          <Icon path={ICONS.doc} size={15} />
          {citation.citation}
        </span>
      ) : (
        <p className="mt-2.5 flex items-start gap-2 text-[14px]" style={{ color: 'var(--warn)' }}>
          <span className="flex-none pt-0.5">
            <Icon path={ICONS.alert} size={17} />
          </span>
          <span>
            <b className="font-semibold">예시 문구입니다.</b>{' '}
            <span style={{ color: 'var(--ink-3)' }}>
              가입하신 상품의 약관을 넣으면 실제 조항으로 바뀝니다.
            </span>
          </span>
        </p>
      )}
    </Card>
  );
}

/** 서류 → 경로 → 기한 → 면책. 순서를 바꾸지 않는다(AI 답변 형식 고정). */
function ClaimGuide({ rule }: { rule: Extract<MatchResult, { kind: 'matched' }>['rule'] }) {
  return (
    <>
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
