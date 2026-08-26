import { query } from '../db';
import { type AvatarMime } from '../domain/avatar';

export {
  ALLOWED_MIME,
  AVATAR_SIZE,
  MAX_BYTES,
  avatarSrc,
  sniffMime,
  validateAvatar,
  type AvatarMime,
  type AvatarValidation,
} from '../domain/avatar';

export type AvatarRow = { mime: AvatarMime; bytes: Buffer; updated_at: string };

export async function getAvatar(memberId: string): Promise<AvatarRow | null> {
  const rows = await query<AvatarRow>(
    `select mime, bytes, updated_at from member_avatar where member_id = $1`,
    [memberId],
  );
  return rows[0] ?? null;
}

export async function saveAvatar(
  memberId: string,
  mime: AvatarMime,
  bytes: Uint8Array,
  width: number,
): Promise<void> {
  await query(
    `insert into member_avatar (member_id, mime, bytes, byte_size, width, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (member_id) do update
       set mime = excluded.mime,
           bytes = excluded.bytes,
           byte_size = excluded.byte_size,
           width = excluded.width,
           updated_at = now()`,
    [memberId, mime, Buffer.from(bytes), bytes.byteLength, width],
  );
}

export async function deleteAvatar(memberId: string): Promise<void> {
  await query(`delete from member_avatar where member_id = $1`, [memberId]);
}
