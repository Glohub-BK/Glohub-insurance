'use client';

import { useEffect, useState } from 'react';
import { Beoni, LogoHorizontal } from './brand';

/**
 * 앱을 열었을 때 나오는 첫 화면.
 *
 * 여기서 파는 것은 기능이 아니라 태도다. 새로 가입하라고 하지 않고,
 * "이미 가입한 것부터 챙기자"고 말한다. 뻐니가 자신감 포즈로 서 있는 유일한 자리다.
 *
 * 세션 저장소로 억제하지 않는다. 앱을 열 때마다 나오는 것이 스플래시이고,
 * 1.4초 뒤 스스로 사라진다. 사라진 뒤에는 아래 화면의 클릭을 막지 않는다.
 */
const HOLD_MS = 1400;

export function Splash() {
  const [hidden, setHidden] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setHidden(true), HOLD_MS);
    // 트랜지션이 끝난 뒤에 DOM 에서 지운다. 남겨두면 스크린리더가 계속 읽는다.
    const t2 = setTimeout(() => setGone(true), HOLD_MS + 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div className="nc-splash" data-hidden={hidden} role="status" aria-live="polite">
      <Beoni pose="confident" height={132} className="nc-bob" priority />
      <div className="flex flex-col items-center gap-2.5">
        <LogoHorizontal height={44} />
        <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
          우리 가족 보험, 놓치지 않게
        </p>
      </div>
      <span className="sr-only">놓칠뻔을 여는 중입니다</span>
    </div>
  );
}
