'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const EXAMPLES = [
  { chip: '아이가 물건 파손', q: '아이가 친구 안경을 깨뜨렸어요' },
  { chip: '넘어져서 골절', q: '계단에서 넘어져서 손목이 골절됐어요' },
  { chip: '병원 통원', q: '감기로 병원 다녀왔어요' },
  { chip: '주차 중 접촉', q: '주차하다 옆차를 긁었어요' },
];

/**
 * 홈 최상단. 배너가 아니라 실제 입력창을 둔다.
 * 배너는 한 번 더 눌러야 하지만 입력창은 앱을 열자마자 바로 쓸 수 있다.
 */
export function HomeHero() {
  const router = useRouter();
  const [text, setText] = useState('');

  function go(q: string) {
    const trimmed = q.trim();
    if (trimmed.length === 0) return;
    router.push(`/ai?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <>
      <section
        className="flex flex-col gap-3.5 rounded-[20px] p-[18px] text-white"
        style={{ background: 'var(--brand-grad)', boxShadow: 'var(--e-brand)' }}
      >
        <div>
          <h1 className="text-[21px] leading-[1.35] font-bold tracking-[-0.02em]">무슨 일이 있었나요?</h1>
          <p className="mt-1 text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,.86)' }}>
            있었던 일을 그대로 적어주세요. 우리집 보장에서 청구할 수 있는 담보를 찾아 드립니다.
          </p>
        </div>

        <div
          className="flex min-h-[54px] items-center gap-2.5 rounded-[14px] py-0 pr-2 pl-3.5"
          style={{
            background: 'rgba(255,255,255,.97)',
            boxShadow: '0 2px 6px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.9)',
          }}
        >
          <span className="flex-none" style={{ color: 'var(--ink-3)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="20" height="20" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <label htmlFor="home-incident" className="sr-only">
            사고 상황
          </label>
          <input
            id="home-incident"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') go(text);
            }}
            placeholder="예: 아이가 친구 안경을 깨뜨렸어요"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            style={{ color: 'var(--ink)' }}
          />
          <button
            type="button"
            onClick={() => go(text)}
            aria-label="담보 찾기"
            className="grid size-10 flex-none place-items-center rounded-[12px] text-white"
            style={{ background: 'var(--brand)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19" aria-hidden="true">
              <path d="m5 12 14 0M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>

      <div className="chiprow">
        {EXAMPLES.map((e) => (
          <button key={e.chip} type="button" className="chip" onClick={() => go(e.q)}>
            {e.chip}
          </button>
        ))}
      </div>
    </>
  );
}
