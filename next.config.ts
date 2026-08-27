import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * pdfjs 는 번들러가 손대면 안 된다.
   *
   * 약관 PDF 를 서버에서 읽을 때 pdfjs 가 워커 파일(pdf.worker.mjs)을 런타임에
   * 동적 import 한다. 번들러가 청크 경로를 다시 써버리면 그 import 가
   * "Cannot find module .../chunks/pdf.worker.mjs" 로 죽는다 —
   * tsx 로 직접 돌릴 때는 멀쩡하고 Next 안에서만 깨져서 찾기 어려웠다.
   * 서버 외부 패키지로 두면 Node 가 원래 자리에서 그대로 불러온다.
   */
  serverExternalPackages: ['pdfjs-dist'],

  /**
   * 서버리스(Vercel)에 올릴 때 pdfjs 파일을 함수 번들에 같이 실어 보낸다.
   *
   * 위 `serverExternalPackages` 로 번들에서 빼두면, 이번엔 Vercel 의 파일 추적기가
   * "아무도 정적으로 import 하지 않는 파일" 로 보고 배포에서 빼버린다. 로컬에서는
   * node_modules 가 그대로 있어 멀쩡하고 **배포한 뒤에만** 약관 업로드가 깨진다.
   * 워커까지 명시적으로 포함시켜 그 경우를 막는다.
   */
  outputFileTracingIncludes: {
    '/api/terms/upload': ['./node_modules/pdfjs-dist/legacy/build/**/*'],
  },
};

export default nextConfig;
