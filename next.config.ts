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
};

export default nextConfig;
