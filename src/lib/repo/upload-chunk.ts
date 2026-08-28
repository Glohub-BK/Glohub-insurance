import { query } from '../db';

/**
 * 큰 약관 PDF 의 조각 보관.
 *
 * Vercel 서버리스는 요청 본문을 4.5MB 로 자른다. 그보다 큰 PDF 는 클라이언트가
 * 3MB 조각으로 나눠 보내고, 마지막 요청이 여기서 이어붙인다.
 * 조각은 문서로 저장되는 순간 지워지고, 버려진 조각은 다음 업로드가 치운다.
 */

export const CHUNK_BYTES = 3 * 1024 * 1024;
/** 40MB(약관 상한) ÷ 3MB ≈ 14. 여유를 둔다. */
export const MAX_CHUNKS = 20;

export async function saveChunk(uploadId: string, seq: number, bytes: Uint8Array): Promise<void> {
  await query(
    `insert into upload_chunk (upload_id, seq, bytes)
     values ($1, $2, $3)
     on conflict (upload_id, seq) do update set bytes = excluded.bytes, created_at = now()`,
    [uploadId, seq, Buffer.from(bytes)],
  );
}

/** 조각 이어붙이기. 순수 함수 — 연속성 검증을 네트워크 없이 테스트한다. */
export function assembleBuffers(rows: { seq: number; bytes: Uint8Array }[]): Uint8Array | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  // 0부터 빠짐없이 이어져야 한다. 중간이 비면 파일이 깨진 것이므로 조립하지 않는다.
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].seq !== i) return null;
  }
  const total = sorted.reduce((n, r) => n + r.bytes.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const r of sorted) {
    out.set(r.bytes, offset);
    offset += r.bytes.byteLength;
  }
  return out;
}

/** 조각을 모아 원본을 복원한다. 빠진 조각이 있으면 null. */
export async function assembleUpload(uploadId: string, expected: number): Promise<Uint8Array | null> {
  const rows = await query<{ seq: number; bytes: Buffer }>(
    `select seq, bytes from upload_chunk where upload_id = $1 order by seq`,
    [uploadId],
  );
  if (rows.length !== expected) return null;
  return assembleBuffers(rows.map((r) => ({ seq: r.seq, bytes: new Uint8Array(r.bytes) })));
}

export async function deleteUpload(uploadId: string): Promise<void> {
  await query(`delete from upload_chunk where upload_id = $1`, [uploadId]);
}

/** 한 시간 넘게 방치된 조각을 치운다. 새 업로드가 시작될 때 기회적으로 부른다. */
export async function purgeStaleChunks(): Promise<void> {
  await query(`delete from upload_chunk where created_at < now() - interval '1 hour'`);
}
