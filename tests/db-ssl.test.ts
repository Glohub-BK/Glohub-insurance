import { describe, expect, it } from 'vitest';
import { describeConnection, diagnoseCredentials, poolerUserLooksWrong, sslOptionsFor } from '@/lib/db';

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

describe('describeConnection', () => {
  const PW = 'SuperSecret123';

  it('연결 대상을 사람이 읽을 수 있게 요약한다', () => {
    const s = describeConnection(
      `postgresql://postgres.gcygrynkbhcytwjxwdit:${PW}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
    );
    expect(s).toContain('user=postgres.gcygrynkbhcytwjxwdit');
    expect(s).toContain('host=aws-1-ap-northeast-2.pooler.supabase.com');
    expect(s).toContain('port=6543');
    expect(s).toContain('db=postgres');
  });

  // 배포된 곳과 내 PC 의 값이 같은지 확인할 방법이 없어 왕복이 길어졌다.
  // 두 곳의 로그 한 줄을 나란히 놓으면 어디가 다른지 바로 보인다.
  it('비밀번호 길이를 실어 두 환경을 대조할 수 있게 한다', () => {
    const s = describeConnection(
      `postgresql://postgres.abc:${PW}@x.pooler.supabase.com:6543/postgres`,
    );
    expect(s).toContain(`pw=${PW.length}자`);
  });

  it('비밀번호가 없으면 길이 대신 없다고 말한다', () => {
    expect(describeConnection('postgresql://postgres.abc@x.pooler.supabase.com:6543/postgres')).toContain(
      'pw=(없음)',
    );
  });

  it('인코딩된 비밀번호는 디코딩한 실제 길이를 센다', () => {
    // p@ss/word#1 은 11자다. %40 을 3자로 세면 두 환경 비교가 엇나간다.
    const s = describeConnection(
      `postgresql://postgres.abc:${encodeURIComponent('p@ss/word#1')}@x.pooler.supabase.com:6543/postgres`,
    );
    expect(s).toContain('pw=11자');
  });

  it('비밀번호는 절대 새어 나가지 않는다 — 이 로그는 남는다', () => {
    for (const raw of [
      `postgresql://postgres:${PW}@db.abc.supabase.co:5432/postgres`,
      `postgresql://postgres.abc:${encodeURIComponent('p@ss/word#1')}@x.pooler.supabase.com:6543/postgres`,
      `postgresql://u:${PW}@localhost:5433/nochil`,
    ]) {
      const s = describeConnection(raw);
      expect(s).not.toContain(PW);
      expect(s).not.toContain('p@ss');
      expect(s).not.toContain(':');
    }
  });

  it('URL 이 아니면 형식을 의심하라고 말한다', () => {
    expect(describeConnection('이건 URL 이 아니다')).toContain('URL 로 해석하지 못했습니다');
  });

  it('사용자·DB 가 비어 있어도 죽지 않는다', () => {
    const s = describeConnection('postgresql://aws-1-ap-northeast-2.pooler.supabase.com:6543');
    expect(s).toContain('user=(없음)');
    expect(s).toContain('db=(없음)');
  });

  it('포트를 안 적으면 기본값이라고 밝힌다', () => {
    expect(describeConnection('postgresql://u:p@db.abc.supabase.co/postgres')).toContain('port=(기본값)');
  });
});

describe('poolerUserLooksWrong', () => {
  it('pooler 인데 사용자명이 postgres 뿐이면 잡아낸다 — 28P01 의 실제 원인이었다', () => {
    expect(
      poolerUserLooksWrong('postgresql://postgres:pw@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres'),
    ).toBe(true);
  });

  it('프로젝트 ref 가 붙어 있으면 통과시킨다', () => {
    expect(
      poolerUserLooksWrong(
        'postgresql://postgres.gcygrynkbhcytwjxwdit:pw@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres',
      ),
    ).toBe(false);
  });

  it('pooler 가 아닌 곳은 판단하지 않는다 — Direct 와 로컬은 postgres 가 정상이다', () => {
    expect(poolerUserLooksWrong('postgresql://postgres:pw@db.abc.supabase.co:5432/postgres')).toBe(false);
    expect(poolerUserLooksWrong('postgresql://postgres:pw@localhost:5433/nochil')).toBe(false);
  });

  it('깨진 문자열은 조용히 넘긴다 — 여기서 죽으면 진짜 오류가 가려진다', () => {
    expect(poolerUserLooksWrong('이건 URL 이 아니다')).toBe(false);
  });
});

describe('diagnoseCredentials — 28P01 원인 좁히기', () => {
  const BASE = 'postgresql://postgres.abcdefghijklmnop:';
  const HOST = '@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres';

  it('# 가 들어 있으면 비밀번호가 잘린다고 알려준다', () => {
    // Supabase 가 만들어주는 비밀번호에 # 가 섞이면 URL 에서 뒤가 통째로 날아간다.
    // 사용자는 제대로 붙여넣었는데 서버는 짧아진 값을 받는다.
    const hint = diagnoseCredentials(`${BASE}pa#ssword${HOST}`);
    expect(hint).toMatch(/잘립니다/);
    expect(hint).toMatch(/%23/);
  });

  it('? 도 같은 함정이다', () => {
    expect(diagnoseCredentials(`${BASE}pa?ssword${HOST}`)).toMatch(/잘립니다/);
  });

  it('비밀번호가 비어 있으면 그렇게 말한다', () => {
    expect(diagnoseCredentials(`${BASE}${HOST}`)).toMatch(/비밀번호가 없습니다/);
  });

  it('안내용 대괄호가 남아 있으면 짚어준다', () => {
    expect(diagnoseCredentials(`${BASE}[YOUR-PASSWORD]${HOST}`)).toMatch(/안내용 문구/);
  });

  it('pooler 인데 ref 가 없으면 Direct 문자열을 붙여넣은 것이다', () => {
    const hint = diagnoseCredentials(
      'postgresql://postgres:secret@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres',
    );
    expect(hint).toMatch(/프로젝트 ref/);
  });

  it('형식이 멀쩡하면 길이만 알려주고 남은 후보를 준다 — 비밀번호는 절대 싣지 않는다', () => {
    const secret = 'sup3rSecretValue';
    const hint = diagnoseCredentials(`${BASE}${secret}${HOST}`);
    expect(hint).toContain(`${secret.length}자`);
    expect(hint).not.toContain(secret);
    expect(hint).toMatch(/재설정|덮어쓰고/);
  });

  it('URL 로 해석되지 않으면 형식을 의심하라고 한다', () => {
    expect(diagnoseCredentials('그냥 문자열')).toMatch(/해석하지 못했습니다/);
  });

  it('퍼센트 인코딩된 비밀번호는 정상으로 본다', () => {
    // %23 은 이미 올바르게 인코딩된 # 이므로 경고 대상이 아니다.
    expect(diagnoseCredentials(`${BASE}pa%23ssword${HOST}`)).toMatch(/형식은 정상/);
  });
});
