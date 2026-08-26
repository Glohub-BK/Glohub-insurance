import type { Metadata } from 'next';
import { AddFlow } from './add-flow';

export const metadata: Metadata = { title: '가족 추가' };

export default function AddFamilyPage() {
  return <AddFlow />;
}
