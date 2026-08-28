import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { productKeyOf } from '@/lib/domain/product-key';
import { searchTermFor } from '@/lib/domain/insurer-disclosure';

describe('상품키 — 같은 상품이면 같은 약관', () => {
  it('표기가 달라도 같은 상품이면 같은 키다', () => {
    const a = productKeyOf('메리츠화재', '(무)메리츠 올바른 암보험1906');
    const b = productKeyOf('메리츠화재 ', '메리츠올바른암보험1906');
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });

  it('회사명이 마스킹돼도 같은 키가 나온다 — 신용정보원은 별표를 섞어 보낸다', () => {
    expect(productKeyOf('**손해보험', '내생애든든종합보험1404')).toBe(
      productKeyOf('손해보험', '내생애든든종합보험1404'),
    );
  });

  it('개정 회차가 다르면 다른 상품이다 — 1812 와 1906 의 약관은 다르다', () => {
    expect(productKeyOf('메리츠화재', '(무)메리츠 올바른 암보험1812')).not.toBe(
      productKeyOf('메리츠화재', '(무)메리츠 올바른 암보험1906'),
    );
  });

  it('회사가 다르면 상품명이 같아도 다른 키다', () => {
    expect(productKeyOf('KB손해보험', '실손의료비보험')).not.toBe(
      productKeyOf('현대해상', '실손의료비보험'),
    );
  });

  it('반쪽짜리 정보로는 키를 만들지 않는다 — 남의 약관을 내 계약에 붙이면 안 된다', () => {
    expect(productKeyOf(null, '암보험')).toBeNull();
    expect(productKeyOf('메리츠화재', null)).toBeNull();
    expect(productKeyOf('메리츠화재', 'A')).toBeNull();
    expect(productKeyOf('***', '암보험')).toBeNull();
  });

  it('동일성 판단은 회차를 지우지 않는다 — 공시실 검색어와 역할이 다르다', () => {
    // 검색어는 회차를 떼어 검색이 0건이 되지 않게 한다.
    expect(searchTermFor('(무)메리츠 올바른 암보험1906')).not.toContain('1906');
    // 키는 회차를 남겨 다른 판의 약관과 섞이지 않게 한다.
    expect(productKeyOf('메리츠화재', '(무)메리츠 올바른 암보험1906')).toContain('1906');
  });
});

describe('조항 공유 경계', () => {
  const terms = readFileSync('src/lib/repo/terms.ts', 'utf8');
  const sql = readFileSync('db/migrations/0012_rls_shared_terms_supabase.sql', 'utf8');

  it('조항 조회는 같은 상품의 다른 사용자 문서도 본다', () => {
    expect(terms).toContain('d.share_clauses');
    expect(terms).toContain('d.product_key in (');
  });

  it('나누는 건 조항뿐 — 조회에 파일 원본이 끼어들지 않는다', () => {
    const fn = terms.slice(
      terms.indexOf('export async function listHouseholdClauses'),
      terms.indexOf('export type PolicyTermsStatus'),
    );
    expect(fn).not.toContain('document_blob');
    expect(fn).not.toContain('bytes');
  });

  it('RLS 도 조항만 열어준다 — document_blob 에는 공유 권한을 주지 않는다', () => {
    expect(sql).toContain('document_shared_read');
    expect(sql).toContain('term_clause_shared_read');
    // 정책이 걸리는 대상은 document 와 term_clause 뿐이다(주석은 세지 않는다).
    const targets = [...sql.matchAll(/create policy \w+ on (\w+)/g)].map((m) => m[1]);
    expect(targets.sort()).toEqual(['document', 'term_clause']);
  });

  it('공유 읽기는 select 로만 열린다 — 남의 문서를 고칠 수 없다', () => {
    expect(sql).toContain('for select using');
    expect(sql).not.toMatch(/for all using/);
  });
});

describe("장식 문자 '+' · '·' 는 동일성 판단에서 지운다", () => {
  it('+ 유무만 다른 표기는 같은 상품이다 — 실제로 카드가 두 장으로 갈라졌던 사고', () => {
    expect(productKeyOf('DB손해보험', '다이렉트+가정보장보험2004(CM)')).toBe(
      productKeyOf('DB손해보험', '다이렉트가정보장보험2004(CM)'),
    );
  });

  it('회차 숫자는 여전히 보존된다', () => {
    expect(productKeyOf('DB손해보험', '다이렉트+가정보장보험2004(CM)')).not.toBe(
      productKeyOf('DB손해보험', '다이렉트가정보장보험2005(CM)'),
    );
  });
});
