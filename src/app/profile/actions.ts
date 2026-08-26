'use server';

import { revalidatePath } from 'next/cache';
import {
  AVATAR_SIZE,
  MAX_BYTES,
  deleteAvatar,
  saveAvatar,
  validateAvatar,
} from '@/lib/repo/avatar';
import { getCurrentHousehold } from '@/lib/repo/household';
import { getMembers } from '@/lib/repo/dashboard';

export type AvatarResult = { ok: boolean; message?: string };

/**
 * 서버 액션은 화면을 거치지 않고도 호출된다. 폼이 보이는지와 무관하게 여기서 다시 확인한다.
 * 지금은 가구가 하나뿐이라 "그 가구의 구성원인가" 가 권한 검사의 전부다. 로그인이 붙으면
 * 세션의 가구와 대조하는 줄이 여기 한 곳에 추가된다.
 */
async function assertMemberOfCurrentHousehold(memberId: string): Promise<boolean> {
  const household = await getCurrentHousehold();
  if (!household) return false;
  const members = await getMembers(household.id);
  return members.some((m) => m.member_id === memberId);
}

export async function uploadAvatar(formData: FormData): Promise<AvatarResult> {
  const memberId = String(formData.get('memberId') ?? '');
  const file = formData.get('photo');

  if (!/^[0-9a-f-]{36}$/i.test(memberId)) {
    return { ok: false, message: '누구의 사진인지 알 수 없어요. 화면을 새로 열어주세요.' };
  }
  if (!(file instanceof File)) {
    return { ok: false, message: '사진을 골라주세요.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: '사진 용량이 너무 커요. 다시 골라주세요.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateAvatar(file.type, bytes);
  if (!check.ok) return { ok: false, message: check.message };

  try {
    if (!(await assertMemberOfCurrentHousehold(memberId))) {
      return { ok: false, message: '이 구성원의 사진은 바꿀 수 없어요.' };
    }
    await saveAvatar(memberId, check.mime, bytes, AVATAR_SIZE);
  } catch (error) {
    console.error('[avatar] 저장 실패', error);
    return { ok: false, message: '사진을 저장하지 못했어요. 잠시 후 다시 시도해주세요.' };
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function resetAvatar(formData: FormData): Promise<AvatarResult> {
  const memberId = String(formData.get('memberId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) {
    return { ok: false, message: '누구의 사진인지 알 수 없어요. 화면을 새로 열어주세요.' };
  }

  try {
    if (!(await assertMemberOfCurrentHousehold(memberId))) {
      return { ok: false, message: '이 구성원의 사진은 바꿀 수 없어요.' };
    }
    await deleteAvatar(memberId);
  } catch (error) {
    console.error('[avatar] 삭제 실패', error);
    return { ok: false, message: '사진을 지우지 못했어요. 잠시 후 다시 시도해주세요.' };
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}
