import { getCandidateView } from '@/lib/repo/view-data';
import { getCurrentHousehold } from '@/lib/repo/household';
import { getClauseCitations } from '@/lib/repo/terms';
import { ClaimSearch } from './claim-search';
import { DataErrorCard } from '../_components/data-error';

export const dynamic = 'force-dynamic';

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const initialQuery = Array.isArray(q) ? (q[0] ?? '') : (q ?? '');

  // 연결 전에도 코칭을 그대로 체험할 수 있어야 한다. 로그인 게이트를 앞에 두지 않는다.
  const { mode, candidates } = await getCandidateView();
  if (mode === 'error') return <DataErrorCard />;

  // 내 약관에서 뽑아둔 조항이 있으면 판단 근거로 쓴다. 없거나 DB 가 없으면 빈 객체다 —
  // 근거가 없다고 화면이 죽으면 안 된다.
  const household = await getCurrentHousehold().catch(() => null);
  const citations = household
    ? await getClauseCitations(household.id).catch(() => ({}))
    : {};

  // 질의가 바뀔 때마다 새로 마운트시킨다. effect 로 상태를 되받는 것보다 단순하고,
  // 이전 결과가 잠깐 남는 일도 없다.
  return (
    <ClaimSearch
      key={initialQuery}
      candidates={candidates}
      initialQuery={initialQuery}
      preview={mode === 'preview'}
      citations={citations}
    />
  );
}
