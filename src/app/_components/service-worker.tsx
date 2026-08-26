'use client';

import { useEffect } from 'react';

/**
 * 서비스 워커 등록.
 *
 * 개발 중에는 등록하지 않는다. 캐시된 예전 번들이 되살아나 "고쳤는데 안 바뀐다"는
 * 시간을 잡아먹는 문제를 만든다.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // 등록 실패는 앱 사용을 막지 않는다. 오프라인 안내만 못 받을 뿐이다.
    });
  }, []);

  return null;
}
