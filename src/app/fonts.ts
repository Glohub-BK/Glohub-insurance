import localFont from 'next/font/local';

/**
 * Pretendard 를 자체 호스팅한다.
 *
 * Google Fonts 에 없는 서체이고, CDN 을 쓰면 폐쇄망이나 CI 에서 빌드·렌더가 깨진다.
 * npm `pretendard` 패키지의 한글 subset(2780자)을 public/fonts 에 두고 읽는다.
 * 파일을 갱신하려면 npm 패키지를 올린 뒤 다시 복사한다:
 *   cp node_modules/pretendard/dist/web/static/woff2-subset/Pretendard-{Regular,SemiBold,Bold}.subset.woff2 public/fonts/
 */
export const pretendard = localFont({
  src: [
    { path: '../../public/fonts/Pretendard-Regular.subset.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Pretendard-SemiBold.subset.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Pretendard-Bold.subset.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-pretendard',
  display: 'swap',
  fallback: [
    '-apple-system',
    'BlinkMacSystemFont',
    'system-ui',
    'Apple SD Gothic Neo',
    'Malgun Gothic',
    'sans-serif',
  ],
});
