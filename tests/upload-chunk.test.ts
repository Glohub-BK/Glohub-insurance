import { describe, expect, it } from 'vitest';
import { assembleBuffers, CHUNK_BYTES, MAX_CHUNKS } from '@/lib/repo/upload-chunk';

const b = (...ns: number[]) => new Uint8Array(ns);

describe('assembleBuffers — 조각 이어붙이기', () => {
  it('순서대로 이어붙인다', () => {
    const out = assembleBuffers([
      { seq: 0, bytes: b(1, 2) },
      { seq: 1, bytes: b(3) },
      { seq: 2, bytes: b(4, 5) },
    ]);
    expect(Array.from(out!)).toEqual([1, 2, 3, 4, 5]);
  });

  it('뒤섞여 도착해도 seq 순으로 맞춘다', () => {
    const out = assembleBuffers([
      { seq: 2, bytes: b(4) },
      { seq: 0, bytes: b(1) },
      { seq: 1, bytes: b(2) },
    ]);
    expect(Array.from(out!)).toEqual([1, 2, 4]);
  });

  it('중간 조각이 빠지면 조립하지 않는다 — 깨진 PDF 를 만들 바엔 실패가 낫다', () => {
    expect(assembleBuffers([{ seq: 0, bytes: b(1) }, { seq: 2, bytes: b(3) }])).toBeNull();
  });

  it('0부터 시작하지 않으면 조립하지 않는다', () => {
    expect(assembleBuffers([{ seq: 1, bytes: b(1) }])).toBeNull();
  });

  it('빈 목록은 null', () => {
    expect(assembleBuffers([])).toBeNull();
  });

  it('상수가 Vercel 제한과 정합한다 — 조각은 4.5MB 미만, 총량은 40MB 이상 커버', () => {
    expect(CHUNK_BYTES).toBeLessThan(4.5 * 1024 * 1024);
    expect(CHUNK_BYTES * MAX_CHUNKS).toBeGreaterThanOrEqual(40 * 1024 * 1024);
  });
});
