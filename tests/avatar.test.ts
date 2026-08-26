import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_BYTES, avatarSrc, sniffMime, validateAvatar } from '@/lib/repo/avatar';

/** 매직 넘버만 맞춘 최소 바이트열. 실제 디코딩은 하지 않으므로 이걸로 충분하다. */
function webp(size = 32): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return b;
}
function png(size = 32): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return b;
}
function jpeg(size = 32): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0xff, 0xd8, 0xff], 0);
  return b;
}

describe('형식 판별', () => {
  it('세 형식의 매직 넘버를 읽는다', () => {
    expect(sniffMime(webp())).toBe('image/webp');
    expect(sniffMime(png())).toBe('image/png');
    expect(sniffMime(jpeg())).toBe('image/jpeg');
  });

  it('모르는 형식은 null 이다', () => {
    expect(sniffMime(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
    expect(sniffMime(new Uint8Array())).toBeNull();
  });

  it('RIFF 로 시작해도 WEBP 가 아니면 통과하지 않는다 — WAV 를 사진이라 우길 수 없다', () => {
    const wav = new Uint8Array(32);
    wav.set([0x52, 0x49, 0x46, 0x46], 0);
    wav.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
    expect(sniffMime(wav)).toBeNull();
  });
});

describe('업로드 검증', () => {
  it('허용 형식이고 바이트가 일치하면 통과한다', () => {
    expect(validateAvatar('image/webp', webp())).toEqual({ ok: true, mime: 'image/webp' });
    expect(validateAvatar('image/jpeg', jpeg())).toEqual({ ok: true, mime: 'image/jpeg' });
  });

  it('허용하지 않는 형식은 막는다', () => {
    const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    const result = validateAvatar('image/svg+xml', svg);
    expect(result.ok).toBe(false);
  });

  it('선언한 형식과 실제 바이트가 다르면 막는다 — 확장자를 믿지 않는다', () => {
    const result = validateAvatar('image/png', jpeg());
    expect(result.ok).toBe(false);
  });

  it('빈 파일과 한도를 넘는 파일을 막는다', () => {
    expect(validateAvatar('image/webp', new Uint8Array()).ok).toBe(false);
    expect(validateAvatar('image/webp', webp(MAX_BYTES + 1)).ok).toBe(false);
    expect(validateAvatar('image/webp', webp(MAX_BYTES)).ok).toBe(true);
  });
});

describe('사진 주소', () => {
  it('갱신 시각이 없으면 주소도 없다 — 화면은 이니셜로 돌아간다', () => {
    expect(avatarSrc('11111111-1111-1111-1111-111111111111', null)).toBeNull();
  });

  it('갱신 시각이 바뀌면 주소도 바뀐다 — 옛 사진이 캐시에 남지 않는다', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const a = avatarSrc(id, '2026-08-26T00:00:00Z');
    const b = avatarSrc(id, '2026-08-26T00:00:01Z');
    expect(a).not.toBe(b);
    expect(a).toContain(`/api/avatar/${id}`);
  });
});

describe('저장 경계', () => {
  const SQL = readFileSync('db/migrations/0007_member_avatar.sql', 'utf8');

  it('DB 도 용량 상한을 강제한다 — 애플리케이션 검증만 믿지 않는다', () => {
    expect(SQL).toMatch(/byte_size\s+integer\s+not null\s+check/);
    expect(SQL).toContain('512000');
  });

  it('허용 MIME 을 DB 제약으로도 못박는다', () => {
    expect(SQL).toContain("mime in ('image/webp','image/png','image/jpeg')");
  });

  it('뷰가 사진 바이트를 싣지 않는다 — 구성원 목록마다 이미지가 딸려오면 안 된다', () => {
    const view = SQL.slice(SQL.indexOf('create or replace view member_sync_status'));
    expect(view).toContain('a.updated_at        as avatar_updated_at');
    expect(view).not.toMatch(/\ba\.bytes\b/);
  });

  it('구성원이 지워지면 사진도 함께 지워진다', () => {
    expect(SQL).toContain('references member(id) on delete cascade');
  });
});

describe('서버 액션', () => {
  const SRC = readFileSync('src/app/profile/actions.ts', 'utf8');

  it('화면과 별개로 가구 소속을 다시 확인한다', () => {
    expect(SRC).toContain('assertMemberOfCurrentHousehold');
    // 업로드와 삭제 양쪽 모두에서 부른다.
    expect(SRC.match(/await assertMemberOfCurrentHousehold\(/g)?.length).toBe(2);
  });

  it('업로드는 형식 검증을 거친다', () => {
    expect(SRC).toContain('validateAvatar(file.type, bytes)');
  });
});
