import type { Metadata } from 'next';
import { AddFlow } from './add-flow';

export const metadata: Metadata = { title: '가족 추가' };

/**
 * 가족 화면의 "피보험자 「○○○」 계약이 있어요 — 추가" 카드가 이름을 미리 채워
 * 들어온다. 이름이 계약의 피보험자명과 정확히 같아야 자동 귀속이 되므로,
 * 사용자가 다시 타이핑하다 표기가 어긋나는 일을 막는다.
 */
export default async function AddFamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  return <AddFlow initialName={(name ?? '').slice(0, 20)} />;
}
