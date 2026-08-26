/**
 * 놓칠뻔 서비스 워커.
 *
 * 목적은 오프라인 앱이 아니라 두 가지다.
 *   1) 설치 가능한 PWA 로 만든다(안드로이드는 fetch 핸들러가 있어야 설치를 제안한다).
 *   2) 네트워크가 끊겼을 때 흰 화면 대신 뻐니가 있는 안내를 보여준다.
 *
 * 보험 데이터는 절대 캐시하지 않는다. 오래된 보장내역을 최신인 것처럼 보여주면
 * 잘못된 청구 판단으로 이어진다. 캐시하는 것은 브랜드 자산과 오프라인 안내뿐이다.
 */
const VERSION = 'v1';
const SHELL = `nochilppeon-shell-${VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE = [
  OFFLINE_URL,
  '/brand/mascot-relief.svg',
  '/brand/logo-horizontal.svg',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // 조회·연결 API 는 건드리지 않는다. 캐시된 응답이 재생되면 인증 흐름이 깨진다.
  if (url.pathname.startsWith('/api/')) return;

  // 화면 이동: 항상 네트워크 먼저. 실패했을 때만 오프라인 안내를 준다.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // 브랜드 자산만 캐시 우선. 내용이 바뀌지 않는 파일들이다.
  if (url.pathname.startsWith('/brand/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(SHELL).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
  }
});
