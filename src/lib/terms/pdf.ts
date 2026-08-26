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
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
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
