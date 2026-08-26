import type { MetadataRoute } from 'next';

/**
 * 홈 화면에 설치되는 앱의 정체.
 *
 * 스토어 심사 전에도 PWA 로 먼저 쓴다. 가족이 각자 휴대폰에 얹어 보는 것이
 * 첫 사용자 테스트다.
 *
 * maskable 아이콘을 따로 두는 이유: 안드로이드는 아이콘을 원·둥근사각 등 기기마다
 * 다른 모양으로 잘라낸다. 일반 아이콘만 주면 방울 끝이 잘린다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '놓칠뻔 — 우리 가족 보험',
    short_name: '놓칠뻔',
    description:
      '우리 가족 보험, 놓치지 않게. 사고가 났을 때 청구할 수 있는 담보를 찾아드립니다.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ko',
    background_color: '#faf5f7',
    theme_color: '#a32a5e',
    categories: ['finance', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      // 사고가 난 직후에 여는 앱이다. 홈을 거치지 않고 바로 질문 화면으로 보낸다.
      { name: '사고 진단', short_name: '진단', url: '/ai' },
      { name: '보장 맵', short_name: '보장', url: '/coverage' },
    ],
  };
}
