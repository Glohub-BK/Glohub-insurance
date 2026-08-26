'use client';

import { useRef, useState, useTransition } from 'react';
import { AVATAR_SIZE } from '@/lib/domain/avatar';
import { resetAvatar, uploadAvatar } from './actions';

/**
 * 사진 고르기 → 정사각 크롭 → 256px 축소까지 전부 기기에서 끝낸다.
 *
 * 원본 사진에는 촬영 위치·기기 같은 메타데이터가 붙어 있다. 캔버스에 다시 그리면
 * 픽셀만 남고 그 정보는 따라오지 않는다. 서버로 나가는 건 잘라 줄인 수십 KB 뿐이다.
 */

const PICK_ERROR = '사진을 읽지 못했어요. 다른 사진으로 시도해주세요.';

async function toSquareBlob(file: File): Promise<{ blob: Blob; type: string }> {
  const bitmap = await createImageBitmap(file);
  try {
    // 가운데를 정사각으로 잘라낸다. 얼굴은 대개 가운데 있고, 자르는 자리를 묻는 화면을
    // 하나 더 두는 것보다 이쪽이 빠르다.
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들지 못했습니다');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.86);
    });
    // WebP 인코딩이 없는 브라우저는 toBlob 이 PNG 를 돌려준다. 그대로 보내면 되고,
    // 서버는 매직 넘버로 실제 형식을 다시 확인한다.
    if (blob) return { blob, type: blob.type || 'image/png' };

    const jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.86);
    });
    if (!jpeg) throw new Error('toBlob 이 빈 결과를 돌려주었습니다');
    return { blob: jpeg, type: jpeg.type || 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}

export function AvatarUpload({
  memberId,
  hasPhoto,
  avatar,
  children,
}: {
  memberId: string;
  hasPhoto: boolean;
  /** 아바타 자체. 이 컴포넌트가 그 위에 ＋ 배지와 파일 입력을 얹는다. */
  avatar: React.ReactNode;
  /** 이름·가구 같은 오른쪽 칸. 「사진 지우기」와 오류 문구가 그 아래 붙는다. */
  children: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      let payload: { blob: Blob; type: string };
      try {
        payload = await toSquareBlob(file);
      } catch (cause) {
        console.error('[avatar] 크롭 실패', cause);
        setError(PICK_ERROR);
        return;
      }
      const form = new FormData();
      form.set('memberId', memberId);
      form.set('photo', new File([payload.blob], 'avatar', { type: payload.type }));
      const result = await uploadAvatar(form);
      if (!result.ok) setError(result.message ?? PICK_ERROR);
    });
  }

  function reset() {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set('memberId', memberId);
      const result = await resetAvatar(form);
      if (!result.ok) setError(result.message ?? PICK_ERROR);
    });
  }

  return (
    <div className="flex items-center gap-3.5">
      <span className="relative inline-flex flex-none">
        <span style={{ opacity: pending ? 0.5 : 1, transition: 'opacity .15s' }}>{avatar}</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-label={hasPhoto ? '프로필 사진 바꾸기' : '프로필 사진 올리기'}
          className="absolute -right-1 -bottom-1 grid h-[24px] w-[24px] place-items-center rounded-full text-[14px] leading-none font-bold text-white"
          style={{
            background: 'var(--brand)',
            border: '2px solid var(--card)',
            boxShadow: 'var(--e1)',
          }}
        >
          {pending ? '…' : '+'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            pick(event.target.files?.[0]);
            // 같은 파일을 다시 골라도 change 가 오도록 비운다.
            event.target.value = '';
          }}
        />
      </span>

      <span className="min-w-0 flex-1">
        {children}
        {hasPhoto ? (
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="mt-1 text-[13px] underline underline-offset-2"
            style={{ color: 'var(--ink-3)' }}
          >
            사진 지우기
          </button>
        ) : null}
        {error ? (
          <span role="alert" className="mt-1 block text-[13px]" style={{ color: 'var(--alert)' }}>
            {error}
          </span>
        ) : null}
      </span>
    </div>
  );
}
