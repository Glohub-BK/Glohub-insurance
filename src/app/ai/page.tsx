import { getCoverageCandidates } from '@/lib/repo/dashboard';
import { getCurrentHousehold } from '@/lib/repo/household';
import type { CoverageCandidate } from '@/lib/domain/incident-match';
import { ClaimSearch } from './claim-search';
import { EmptyHousehold } from '../_components/empty';

export const dynamic = 'force-dynamic';

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const household = await getCurrentHousehold();
  if (!household) return <EmptyHousehold />;

  const { q } = await searchParams;
  const initialQuery = Array.isArray(q) ? (q[0] ?? '') : (q ?? '');

  const rows = await getCoverageCandidates(household.id);

  // pg 는 numeric 을 문자열로 준다. 클라이언트로 넘기기 전에 숫자로 맞춘다.
  const candidates: CoverageCandidate[] = rows.map((r) => ({
    policyId: r.policyId,
    memberName: r.memberName,
    insurerName: r.insurerName,
    productName: r.productName,
    category: r.category,
    name: r.name,
    amount: r.amount === null ? null : Number(r.amount),
    coverageStatus: r.coverageStatus,
  }));

  // 홈 입력창에서 ?q= 를 달고 들어오면 질의가 바뀔 때마다 새로 마운트시킨다.
  // effect 로 상태를 되받는 것보다 단순하고, 이전 결과가 잠깐 남는 일도 없다.
  return <ClaimSearch key={initialQuery} candidates={candidates} initialQuery={initialQuery} />;
}
