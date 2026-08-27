import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGAL_DOCS, findDoc } from '@/lib/legal/documents';
import { COMPANY } from '@/lib/legal/company';

describe('법적 고지 문서', () => {
  it('필수 문서가 모두 있다', () => {
    const slugs = LEGAL_DOCS.map((d) => d.slug).sort();
    expect(slugs).toEqual(['location', 'notice', 'privacy', 'service', 'youth']);
  });

  it('모든 문서가 제목·요약·근거·시행일을 갖는다', () => {
    for (const d of LEGAL_DOCS) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.summary.length).toBeGreaterThan(0);
      expect(d.basis.length).toBeGreaterThan(0);
      expect(d.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.sections.length).toBeGreaterThan(0);
    }
  });

  it('빈 조항이 없다 — 제목만 있고 내용이 없으면 고지가 아니다', () => {
    for (const d of LEGAL_DOCS) {
      for (const s of d.sections) {
        expect(s.body.length + (s.list?.length ?? 0)).toBeGreaterThan(0);
      }
    }
  });

  it('모르는 slug 는 undefined', () => {
    expect(findDoc('없는문서')).toBeUndefined();
  });
});

describe('우리 앱 특성이 빠짐없이 고지되는가', () => {
  const all = JSON.stringify(LEGAL_DOCS);

  it('손해사정업 경계를 밝힌다', () => {
    expect(all).toContain('보험업법');
    expect(all).toContain('손해사정');
    expect(all).toContain('산정');
    expect(all).toContain('청구의 대행');
  });

  it('한국신용정보원 조회 위탁처(쿠콘)를 밝힌다 — 이게 빠지면 위탁 고지 위반이다', () => {
    const privacy = findDoc('privacy')!;
    const text = JSON.stringify(privacy);
    expect(text).toContain('쿠콘');
    expect(text).toContain('위탁');
    expect(text).toContain('한국신용정보원');
  });

  it('저장하지 않는 것을 먼저 밝힌다', () => {
    const privacy = JSON.stringify(findDoc('privacy'));
    expect(privacy).toContain('주민등록번호');
    expect(privacy).toContain('비밀번호');
    expect(privacy).toContain('폐기');
  });

  it('약관 조항은 공유하고 PDF 원본은 공유하지 않는다는 것을 밝힌다', () => {
    const text = JSON.stringify([findDoc('service'), findDoc('privacy')]);
    expect(text).toContain('조항');
    expect(text).toContain('원본은 공유하지 않습니다');
  });

  it('위치정보를 수집하지 않는다는 것과 그 결과를 밝힌다', () => {
    const loc = JSON.stringify(findDoc('location'));
    expect(loc).toContain('전송되거나 저장되지 않습니다');
    expect(loc).toContain('신고 대상에 해당하지 않습니다');
  });

  it('미성년 구성원과 법정대리인 동의를 다룬다', () => {
    const text = JSON.stringify([findDoc('service'), findDoc('youth'), findDoc('privacy')]);
    expect(text).toContain('법정대리인');
    expect(text).toContain('만 14세');
  });

  it('실손·정액·일당을 합산하지 않는다는 것을 밝힌다', () => {
    expect(JSON.stringify(findDoc('notice'))).toContain('합산하지 않습니다');
  });

  it('최종 지급은 보험회사가 결정한다는 문장이 들어 있다', () => {
    expect(all).toContain('보험회사의 심사로 결정');
  });
});

describe('사업자 정보', () => {
  it('표시 의무 항목이 모두 채워져 있다', () => {
    expect(COMPANY.operator).toBeTruthy();
    expect(COMPANY.representative).toBeTruthy();
    expect(COMPANY.businessNumber).toMatch(/^\d{3}-\d{2}-\d{5}$/);
    expect(COMPANY.email).toContain('@');
  });

  it('개인정보 보호책임자를 지정한다 — 개인정보보호법 제31조', () => {
    expect(COMPANY.privacyOfficer.name).toBeTruthy();
    expect(COMPANY.privacyOfficer.email).toContain('@');
  });

  it('모든 문서 화면 하단에 사업자 정보가 붙는다', () => {
    const doc = readFileSync('src/app/legal/[slug]/page.tsx', 'utf8');
    const body = readFileSync('src/app/_components/legal.tsx', 'utf8');
    expect(doc).toContain('LegalBody');
    expect(body).toContain('<BusinessInfo />');
  });
});

describe('앱 안에서 닿을 수 있는가', () => {
  const profile = readFileSync('src/app/profile/page.tsx', 'utf8');

  it('내 정보 하단에서 한 줄로 모든 문서에 닿는다 — 굿리치와 같은 자리', () => {
    // 다섯 개를 다 펼치지 않는다. 목록 페이지 한 줄 + 자주 볼 두 개만 노출.
    expect(profile).toContain('href="/legal"');
    expect(profile).toContain('/legal/notice');
    expect(profile).toContain('/about');
  });

  it('목록 페이지에서는 다섯 문서 전부로 갈 수 있다', () => {
    const index = readFileSync('src/app/legal/page.tsx', 'utf8');
    expect(index).toContain('LEGAL_DOCS.map');
    expect(index).toContain('/legal/${doc.slug}');
  });

  it('조회 직전에 필수 동의를 받는다 — 데이터를 받아오기 전이어야 한다', () => {
    const flow = readFileSync('src/app/connect/connect-flow.tsx', 'utf8');
    expect(flow).toContain('[필수]');
    expect(flow).toContain('/legal/service');
    expect(flow).toContain('/legal/privacy');
    // 동의하지 않으면 조회 버튼이 눌리지 않는다.
    expect(flow).toMatch(/const ready =\s*\n?\s*agreed &&/);
    // 위탁처를 동의 자리에서 밝힌다.
    expect(flow).toContain('쿠콘');
  });

  it('「준비 중」으로 막아두지 않는다', () => {
    const section = profile.slice(profile.indexOf('<GroupTitle>약관 및 정책'));
    expect(section).not.toContain('right={SOON}');
  });
});
