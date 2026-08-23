import { describe, expect, it } from 'vitest';
import {
  buildIdentityKey,
  isWholeLife,
  normalizeContractInfo,
  normalizePaymentCycle,
  normalizeStatus,
  parseAmount,
  parseDate,
} from '@/lib/codef/normalize';
import { parseCodefBody, CodefError, encryptPassword } from '@/lib/codef/client';
import { isTwoWayResponse } from '@/lib/codef/types';
import { sampleContractInfo } from './fixtures/contract-info';

describe('parseDate', () => {
  it('YYYYMMDD 를 ISO 로 바꾼다', () => {
    expect(parseDate('20160530')).toBe('2016-05-30');
  });

  it('"종신"은 날짜가 아니므로 null', () => {
    expect(parseDate('종신')).toBeNull();
  });

  it('빈값·undefined 는 null', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate(null)).toBeNull();
  });

  it('실재하지 않는 날짜는 null', () => {
    expect(parseDate('20230230')).toBeNull();
    expect(parseDate('20231301')).toBeNull();
  });

  it('자릿수가 안 맞으면 null', () => {
    expect(parseDate('2016053')).toBeNull();
    expect(parseDate('201605301')).toBeNull();
  });

  it('먼 미래 만기(20920519)도 정상 처리한다', () => {
    expect(parseDate('20920519')).toBe('2092-05-19');
  });
});

describe('parseAmount', () => {
  it('숫자 문자열을 그대로 읽는다', () => {
    expect(parseAmount('756000')).toBe(756000);
  });

  it('콤마와 단위를 걷어낸다', () => {
    expect(parseAmount('50,000,000')).toBe(50000000);
    expect(parseAmount('1,250,000원')).toBe(1250000);
  });

  it('마스킹된 값은 신뢰할 수 없으므로 null', () => {
    expect(parseAmount('12**')).toBeNull();
  });

  it('빈값은 null', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe('normalizeStatus', () => {
  it.each([
    ['정상', '유지'],
    ['정', '유지'],
    ['계약부활', '유지'],
    ['해지', '해지'],
    ['청약철회', '해지'],
    ['만기', '만기'],
    ['소멸', '만기'],
    ['실효', '실효'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeStatus(input)).toBe(expected);
  });

  it('빈값이나 모르는 값은 미상', () => {
    expect(normalizeStatus('')).toBe('미상');
    expect(normalizeStatus(undefined)).toBe('미상');
    expect(normalizeStatus('알수없음')).toBe('미상');
  });
});

describe('normalizePaymentCycle', () => {
  it.each([
    ['매월납', '월납'],
    ['년납', '연납'],
    ['일시납', '일시납'],
    ['분기납', '분기납'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePaymentCycle(input)).toBe(expected);
  });

  it('빈값은 null', () => {
    expect(normalizePaymentCycle('')).toBeNull();
  });
});

describe('isWholeLife', () => {
  it('종신이면 true', () => {
    expect(isWholeLife('종신')).toBe(true);
    expect(isWholeLife('20310530')).toBe(false);
    expect(isWholeLife(undefined)).toBe(false);
  });
});

describe('buildIdentityKey', () => {
  it('같은 계약은 같은 키를 낸다', () => {
    const c = { resCompanyNm: '**손해보험', resPolicyNumber: '201**', resInsuranceName: 'A보험' };
    expect(buildIdentityKey('flat_rate', c)).toBe(buildIdentityKey('flat_rate', c));
  });

  it('리스트 종류가 다르면 다른 계약으로 본다', () => {
    const c = { resCompanyNm: '**손해보험', resPolicyNumber: '201**', resInsuranceName: 'A보험' };
    expect(buildIdentityKey('flat_rate', c)).not.toBe(buildIdentityKey('actual_loss', c));
  });

  it('상품명이 다르면 다른 키', () => {
    const base = { resCompanyNm: '**손해보험', resPolicyNumber: '201**' };
    expect(buildIdentityKey('flat_rate', { ...base, resInsuranceName: 'A' })).not.toBe(
      buildIdentityKey('flat_rate', { ...base, resInsuranceName: 'B' }),
    );
  });

  it('모든 필드가 비어도 던지지 않는다', () => {
    expect(buildIdentityKey('flat_rate', {})).toHaveLength(32);
  });
});

describe('normalizeContractInfo', () => {
  const policies = normalizeContractInfo(sampleContractInfo);

  it('5개 리스트를 평탄화해 계약 3건을 만든다', () => {
    expect(policies).toHaveLength(3);
    expect(policies.map((p) => p.contractKind).sort()).toEqual([
      'actual_loss',
      'flat_rate',
      'property',
    ]);
  });

  it('잘린 계약상태 "정"을 유지로 읽는다', () => {
    const actualLoss = policies.find((p) => p.contractKind === 'actual_loss')!;
    expect(actualLoss.status).toBe('유지');
  });

  it('보험료와 납입주기를 정규화한다', () => {
    const flat = policies.find((p) => p.contractKind === 'flat_rate')!;
    expect(flat.premium).toBe(756000);
    expect(flat.paymentCycle).toBe('월납');
  });

  it('담보를 카테고리로 분류한다', () => {
    const flat = policies.find((p) => p.contractKind === 'flat_rate')!;
    const categories = flat.coverages.map((c) => c.category);
    expect(categories).toContain('disability');
    expect(categories).toContain('liability');
  });

  it('해지된 담보도 버리지 않고 상태를 보존한다', () => {
    const flat = policies.find((p) => p.contractKind === 'flat_rate')!;
    const terminated = flat.coverages.find((c) => c.name.includes('재해장해'))!;
    expect(terminated.coverageStatus).toBe('해지');
  });

  it('계약 보장기간이 없으면 담보 기간에서 채운다', () => {
    const actualLoss = policies.find((p) => p.contractKind === 'actual_loss')!;
    expect(actualLoss.startDate).toBe('2016-05-30');
    expect(actualLoss.endDate).toBe('2031-05-30');
  });

  it('종신 계약은 종료일이 null 이고 담보에 표시가 남는다', () => {
    const property = policies.find((p) => p.contractKind === 'property')!;
    expect(property.endDate).toBeNull();
    expect(property.coverages[0].category).toBe('fire');
    expect(property.coverages[0].amount).toBe(50000000);
  });

  it('보험료가 빈 문자열이면 null', () => {
    const property = policies.find((p) => p.contractKind === 'property')!;
    expect(property.premium).toBeNull();
  });

  it('빈 리스트와 없는 리스트를 모두 견딘다', () => {
    expect(normalizeContractInfo({})).toEqual([]);
    expect(normalizeContractInfo({ resCarContractList: [] })).toEqual([]);
  });

  it('리스트 자리에 배열이 아닌 값이 와도 던지지 않는다', () => {
    const broken = { resFlatRateContractList: null } as never;
    expect(normalizeContractInfo(broken)).toEqual([]);
  });

  it('계약 객체에 null 이 섞여도 건너뛴다', () => {
    const withNull = {
      resFlatRateContractList: [null, { resInsuranceName: 'X' }],
    } as never;
    expect(normalizeContractInfo(withNull)).toHaveLength(1);
  });

  it('상품명이 없으면 자리표시자를 넣는다', () => {
    const [p] = normalizeContractInfo({ resFlatRateContractList: [{}] });
    expect(p.productName).toBe('(상품명 미상)');
    expect(p.insurerName).toBe('(보험사 미상)');
  });
});

describe('parseCodefBody', () => {
  it('평문 JSON 을 읽는다', () => {
    const body = parseCodefBody<{ ok: boolean }>('{"result":{"code":"CF-00000"},"data":{"ok":true}}');
    expect(body.result.code).toBe('CF-00000');
  });

  it('URL 인코딩된 JSON 을 디코딩해 읽는다', () => {
    const original = '{"result":{"code":"CF-00000","message":"성공"},"data":{}}';
    const body = parseCodefBody(encodeURIComponent(original));
    expect(body.result.message).toBe('성공');
  });

  it('해석 불가능하면 CodefError 를 던진다', () => {
    expect(() => parseCodefBody('<html>error</html>')).toThrow(CodefError);
  });
});

describe('isTwoWayResponse', () => {
  it('CF-03002 이고 continue2Way 가 true 면 추가 인증이다', () => {
    expect(
      isTwoWayResponse({ result: { code: 'CF-03002' }, data: { continue2Way: true } }),
    ).toBe(true);
  });

  it('코드만 맞고 continue2Way 가 없으면 추가 인증이 아니다', () => {
    expect(isTwoWayResponse({ result: { code: 'CF-03002' }, data: {} })).toBe(false);
  });

  it('성공 응답은 추가 인증이 아니다', () => {
    expect(isTwoWayResponse({ result: { code: 'CF-00000' }, data: {} })).toBe(false);
  });

  it('data 가 null 이어도 던지지 않는다', () => {
    expect(isTwoWayResponse({ result: { code: 'CF-03002' }, data: null })).toBe(false);
  });
});

describe('encryptPassword', () => {
  // 실제 CODEF 공개키 대신 테스트용 키를 생성해 왕복을 검증한다.
  it('RSA 공개키로 암호화하면 원문이 남지 않는다', async () => {
    const { generateKeyPairSync, privateDecrypt, constants } = await import('node:crypto');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

    const cipher = encryptPassword('MyP@ssw0rd', spki);
    expect(cipher).not.toContain('MyP@ssw0rd');

    const plain = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(cipher, 'base64'),
    );
    expect(plain.toString('utf8')).toBe('MyP@ssw0rd');
  });

  it('개행이 섞인 공개키 문자열도 받아들인다', async () => {
    const { generateKeyPairSync } = await import('node:crypto');
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    const withNewlines = spki.replace(/(.{20})/g, '$1\n');
    expect(() => encryptPassword('x', withNewlines)).not.toThrow();
  });
});
