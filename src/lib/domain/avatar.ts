/**
 * 프로필 사진 규격과 검증.
 *
 * 기기(클라이언트)와 서버가 같은 상수·같은 판정을 써야 해서 DB 를 모르는 자리에 둔다.
 * repo/avatar.ts 가 이걸 그대로 다시 내보내므로 서버 코드는 어느 쪽을 import 해도 된다.
 */

/*
 * 서버는 이미지를 가공하지 않는다. 크롭·축소는 기기에서 끝내고, 여기서는 "받아도 되는
 * 것인지"만 판단한다. 이미지 처리 라이브러리를 서버에 두면 사용자가 올린 바이트를
 * 디코딩하는 코드가 하나 더 늘어난다 — 그만한 이유가 없다.
 */

/** 허용 형식. 기기에서 만든 WebP 가 기본이고, 나머지는 캔버스가 없는 브라우저의 폴백이다. */
export const ALLOWED_MIME = ['image/webp', 'image/png', 'image/jpeg'] as const;
export type AvatarMime = (typeof ALLOWED_MIME)[number];

/** 256px WebP 는 보통 10~30KB 다. 500KB 면 어떤 폴백이든 넉넉하다. */
export const MAX_BYTES = 500 * 1024;
/** 화면에서 쓰는 최대 크기(72px)의 2배수까지만 받는다. */
export const AVATAR_SIZE = 256;

export type AvatarValidation = { ok: true; mime: AvatarMime } | { ok: false; message: string };

/**
 * 확장자나 클라이언트가 붙인 이름은 믿지 않는다. MIME 과 실제 바이트의 매직 넘버가
 * 함께 맞을 때만 통과시킨다.
 */
export function validateAvatar(mime: string, bytes: Uint8Array): AvatarValidation {
  if (!ALLOWED_MIME.includes(mime as AvatarMime)) {
    return { ok: false, message: 'JPG · PNG · WebP 사진만 올릴 수 있어요.' };
  }
  if (bytes.byteLength === 0) return { ok: false, message: '사진 파일이 비어 있어요.' };
  if (bytes.byteLength > MAX_BYTES) {
    return { ok: false, message: '사진 용량이 너무 커요. 다시 골라주세요.' };
  }
  if (sniffMime(bytes) !== mime) {
    return { ok: false, message: '사진 파일을 읽지 못했어요. 다른 사진으로 시도해주세요.' };
  }
  return { ok: true, mime: mime as AvatarMime };
}

/** 매직 넘버로 실제 형식을 읽는다. 모르는 형식이면 null. */
export function sniffMime(bytes: Uint8Array): AvatarMime | null {
  const at = (i: number) => bytes[i] ?? -1;
  // RIFF....WEBP
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
      at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) {
    return 'image/webp';
  }
  // \x89PNG\r\n\x1a\n
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 &&
      at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) {
    return 'image/png';
  }
  // JPEG SOI
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  return null;
}

/**
 * 사진이 있는 구성원의 이미지 주소. 없으면 null 이고, 화면은 이니셜 아바타로 돌아간다.
 * `v` 는 갱신 시각이라 사진을 바꾸면 주소가 바뀐다 — 캐시된 옛 사진이 남지 않는다.
 */
export function avatarSrc(memberId: string, updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  return `/api/avatar/${memberId}?v=${Date.parse(updatedAt) || 0}`;
}
