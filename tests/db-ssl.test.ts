import { describe, expect, it } from 'vitest';
import { sslOptionsFor } from '@/lib/db';

describe('sslOptionsFor', () => {
  it('로컬 Postgres 는 TLS 를 끈다', () => {
    expect(sslOptionsFor('postgresql://u:p@localhost:5433/db')).toBe(false);
    expect(sslOptionsFor('postgresql://u:p@127.0.0.1:5432/db')).toBe(false);
  });

  it('원격 호스트는 TLS 를 켠다', () => {
    const s = sslOptionsFor('postgresql://postgres.abc:pw@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres');
    expect(s).toEqual({ rejectUnauthorized: false });
  });

  it('CA 인증서를 주면 검증까지 켠다', () => {
    const ca = '-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----';
    expect(sslOptionsFor('postgresql://u:p@db.abc.supabase.co:5432/postgres', ca)).toEqual({
      ca,
      rejectUnauthorized: true,
    });
  });

  it('빈 CA 문자열은 없는 것으로 본다', () => {
    expect(sslOptionsFor('postgresql://u:p@db.abc.supabase.co:5432/postgres', '   ')).toEqual({
      rejectUnauthorized: false,
    });
  });

  it('연결 문자열이 깨져 있으면 TLS 를 켜지 않는다 (뒤에서 pg 가 제대로 실패하게 둔다)', () => {
    expect(sslOptionsFor('이건 URL 이 아니다')).toBe(false);
  });
});
