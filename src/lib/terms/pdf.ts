/**
 * PDF → 텍스트.
 *
 * 처음에는 pdftotext(poppler)를 썼는데, 윈도우에서는 관리자 권한으로 별도 설치를
 * 해야 한다. 약관 한 건 넣자고 시스템에 도구를 깔게 만들 이유가 없어서
 * pdfjs(브라우저 PDF 뷰어와 같은 엔진)로 바꿨다. npm 의존성 하나면 끝나고
 * 맥·윈도우·리눅스에서 같은 결과가 나온다.
 *
 * 줄 구분은 pdfjs 가 알려주는 hasEOL 을 그대로 믿는다. 좌표로 줄을 다시 묶으면
 * 2단 편집된 약관에서 좌우 단이 한 줄로 섞인다.
 */
type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsLoading: Promise<Pdfjs> | null = null;

/**
 * pdfjs 를 전역 폴리필을 깐 뒤에 불러온다.
 *
 * legacy 빌드는 모듈 평가 시점에 브라우저 전역(DOMMatrix 등)을 맨 이름으로 참조한다.
 * 로컬에서는 선택 의존성 @napi-rs/canvas 가 폴리필을 대주지만, Vercel 함수 번들에는
 * 그 네이티브 패키지가 실리지 않아 "DOMMatrix is not defined" 로 죽었다 —
 * 로컬에서는 멀쩡하고 **배포한 뒤에만** 깨지는 종류다.
 * 우리는 렌더링 없이 텍스트만 뽑으므로 빈 구현이면 충분하다.
 * 정적 import 는 폴리필보다 먼저 평가되므로 반드시 동적 import 여야 한다.
 */
function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsLoading) {
    const g = globalThis as Record<string, unknown>;
    g.DOMMatrix ??= class {};
    g.Path2D ??= class {};
    g.ImageData ??= class {};
    pdfjsLoading = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLoading;
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { getDocument } = await loadPdfjs();

  // pdfjs 는 넘겨받은 버퍼를 워커로 넘기며 분리(detach)한다. 그대로 주면 호출한 쪽의
  // 배열이 빈 껍데기가 되어 같은 파일을 두 번 읽는 순간 DataCloneError 로 죽는다.
  // 복사본을 준다 — 호출부가 그걸 알고 있어야 할 이유가 없다.
  const data = bytes.slice();

  // 렌더링은 하지 않고 텍스트만 뽑는다. 시스템 폰트를 찾아 헤매지 않도록 꺼둔다.
  const task = getDocument({ data, useSystemFonts: false });
  const doc = await task.promise;

  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      }
    }
    if (line.length > 0) lines.push(line);
    pages.push(lines.join('\n'));
    page.cleanup();
  }

  // 워커를 닫지 않으면 스크립트가 끝나지 않는다.
  await task.destroy();
  return pages.join('\n');
}
