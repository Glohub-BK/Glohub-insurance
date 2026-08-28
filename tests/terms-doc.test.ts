import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSOCIATION, disclosureFor, searchTermFor } from '@/lib/domain/insurer-disclosure';
import { MAX_TERMS_BYTES, isPdf } from '@/lib/repo/terms-doc';

describe('보험사 공시실 찾기', () => {
  it.each([
    ['메리츠화재', 'meritzfire.com'],
    ['KB손해보험', 'kbinsure.co.kr'],
    ['DB손해보험', 'idbins.com'],
    ['삼성화재', 'samsungfire.com'],
    ['현대해상', 'hi.co.kr'],
    ['롯데손해보험', 'lotteins.co.kr'],
    ['한화생명', 'hanwhalife.com'],
  ])('%s → %s', (insurer, host) => {
    expect(disclosureFor(insurer).url).toContain(host);
  });

  it('모르는 손해보험사는 손보협회 통합공시로 보낸다 — 빈손으로 돌려보내지 않는다', () => {
    expect(disclosureFor('**손해보험').url).toBe(ASSOCIATION.nonlife.url);
    expect(disclosureFor('처음보는화재').url).toBe(ASSOCIATION.nonlife.url);
  });

  it('모르는 생명보험사는 생보협회로 보낸다', () => {
    expect(disclosureFor('처음보는생명').url).toBe(ASSOCIATION.life.url);
    expect(disclosureFor('**생명보험').url).toBe(ASSOCIATION.life.url);
  });

  it('회사명이 비어도 죽지 않는다', () => {
    expect(disclosureFor(null).url).toBeTruthy();
    expect(disclosureFor(undefined).url).toBeTruthy();
    expect(disclosureFor('').url).toBeTruthy();
  });

  it('공시실 주소는 전부 https 다', () => {
    for (const name of ['메리츠화재', 'KB손해보험', '현대해상', '한화생명', '알수없음']) {
      expect(disclosureFor(name).url.startsWith('https://')).toBe(true);
    }
  });
});

describe('공시실 검색어', () => {
  it('판매채널·연도 꼬리표를 떼어 검색이 0건으로 끝나지 않게 한다', () => {
    expect(searchTermFor('(무)메리츠 올바른 암보험1906')).toBe('메리츠 올바른 암보험');
    expect(searchTermFor('KB다이렉트(인터넷)개인용자동차보험')).toBe('KB다이렉트개인용자동차보험');
  });

  it('빈 상품명도 처리한다', () => {
    expect(searchTermFor(null)).toBe('');
    expect(searchTermFor(undefined)).toBe('');
  });
});

describe('약관 파일 검증', () => {
  it('PDF 매직 넘버로만 판단한다 — 확장자·MIME 은 믿지 않는다', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(isPdf(pdf)).toBe(true);
    expect(isPdf(new TextEncoder().encode('<html>not a pdf</html>'))).toBe(false);
    expect(isPdf(new Uint8Array())).toBe(false);
  });

  it('상한이 DB 제약과 같다 — 앱만 통과하고 DB 에서 터지면 안 된다', () => {
    const sql = readFileSync('db/migrations/0009_document_blob.sql', 'utf8');
    expect(sql).toContain(String(MAX_TERMS_BYTES));
  });
});

describe('약관 원본 보관 경계', () => {
  const route = readFileSync('src/app/api/terms/[documentId]/route.ts', 'utf8');
  const upload = readFileSync('src/app/api/terms/upload/route.ts', 'utf8');

  it('다운로드는 가구 소속을 확인한 뒤에만 파일을 준다', () => {
    expect(route).toContain('belongsToHousehold');
    // 확인보다 먼저 파일을 읽어오면 안 된다.
    expect(route.indexOf('belongsToHousehold')).toBeLessThan(route.indexOf('getTermsBlob'));
  });

  it('첨부로 내려준다 — 브라우저가 열지 않고 파일로 저장하게', () => {
    expect(route).toContain('Content-Disposition');
    expect(route).toContain('attachment');
  });

  it('업로드는 조항을 못 뽑으면 저장하지 않는다', () => {
    expect(upload).toContain('clauses.length === 0');
    // import 문이 아니라 실제 호출 자리와 비교한다.
    expect(upload.indexOf('clauses.length === 0')).toBeLessThan(upload.indexOf('await saveTermsDoc('));
  });

  it('업로드는 지정한 계약이 우리 가구 것인지 확인한다', () => {
    expect(upload).toContain('and m.household_id = $2');
  });

  it('약관 사본을 우리가 재배포하지 않는다는 것을 화면에 적는다', () => {
    const page = readFileSync('src/app/terms/page.tsx', 'utf8');
    expect(page).toContain('저작권');
    expect(page).toContain('파일 사본을 배포하지 않습니다');
  });
});

describe('NUL(0x00) 방어 — Postgres 22021', () => {
  // 실제 사고: 내생애든든종합보험 약관 PDF 의 추출 텍스트에 NUL 이 섞여
  // term_clause 저장이 invalid byte sequence 로 죽었다.
  it('pdf 추출이 NUL 을 걷어낸다', () => {
    const src = readFileSync('src/lib/terms/pdf.ts', 'utf8');
    expect(src).toContain("replace(/\\u0000/g, '')");
  });

  it('저장소도 한 번 더 걷어낸다 — 다른 경로 하나가 트랜잭션을 죽이면 안 된다', () => {
    const src = readFileSync('src/lib/repo/terms-doc.ts', 'utf8');
    expect(src).toContain('function stripNul');
    expect(src).toContain('stripNul(c.body)');
    expect(src).toContain('stripNul(input.title)');
  });
});
