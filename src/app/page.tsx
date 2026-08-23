import Link from 'next/link';
import {
  computeTotals,
  getCoverageMatrix,
  getCoverages,
  getMembers,
  getPolicies,
  CORE_CATEGORIES,
} from '@/lib/repo/dashboard';
import { getCurrentHousehold } from '@/lib/repo/household';
import { CATEGORY_LABELS } from '@/lib/domain/coverage-category';
import { Avatar, Card, Disclaimer, Icon, ICONS, Pill, SectionTitle } from './_components/ui';
import { HomeHero } from './_components/home-hero';
import { EmptyHousehold } from './_components/empty';

export const dynamic = 'force-dynamic';

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

function freshness(days: number | null) {
  if (days === null) return { tone: 'bad' as const, text: '동기화 안 됨' };
  if (days === 0) return { tone: 'ok' as const, text: '오늘' };
  if (days <= 30) return { tone: 'ok' as const, text: `${days}일 전` };
  if (days <= 180) return { tone: 'warn' as const, text: `${days}일 전` };
  return { tone: 'bad' as const, text: `${days}일 전` };
}

export default async function HomePage() {
  const household = await getCurrentHousehold();
  if (!household) return <EmptyHousehold />;

  const [members, matrix, policies, coverages] = await Promise.all([
    getMembers(household.id),
    getCoverageMatrix(household.id),
    getPolicies(household.id),
    getCoverages(household.id),
  ]);
  const totals = computeTotals(members, matrix, policies);
  const now = new Date();

  // 담보 개수는 "계약 3건"보다 실제 보장 크기를 잘 보여준다.
  const coverageCountByMember = new Map<string, number>();
  const policyMember = new Map(policies.map((p) => [p.id, p.member_name]));
  for (const c of coverages) {
    const name = policyMember.get(c.policy_id);
    if (!name) continue;
    coverageCountByMember.set(name, (coverageCountByMember.get(name) ?? 0) + 1);
  }

  // 핵심 담보 공백 중 먼저 알려야 할 한 건. 배상책임이 가장 급하다.
  const gaps = matrix
    .filter((c) => CORE_CATEGORIES.includes(c.category) && Number(c.coverage_count) === 0)
    .sort((a, b) => CORE_CATEGORIES.indexOf(a.category) - CORE_CATEGORIES.indexOf(b.category));
  const topGap = gaps.find((g) => g.category === 'liability') ?? gaps[0];

  return (
    <>
      <HomeHero />

      <Card>
        <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
          우리집 월 보험료
        </span>
        <div className="tnum my-0.5 text-[34px] leading-[1.1] font-bold tracking-[-0.03em]">
          {totals.monthlyPremium.toLocaleString('ko-KR')}
          <span className="ml-1 text-[19px] font-semibold tracking-normal">원</span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Pill>계약 {policies.length}건</Pill>
          <Pill tone="ok">유지 {totals.activePolicyCount}</Pill>
          {policies.length - totals.activePolicyCount > 0 ? (
            <Pill>만기·해지 {policies.length - totals.activePolicyCount}</Pill>
          ) : null}
        </div>
      </Card>

      {topGap ? (
        <Link href="/coverage" className="card card-tap flex items-start gap-3" style={{ background: 'var(--alert-soft)', borderColor: 'var(--alert-line)' }}>
          <span className="flex-none pt-0.5" style={{ color: 'var(--alert)' }}>
            <Icon path={ICONS.alert} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[16px]" style={{ color: 'var(--alert)' }}>
              {topGap.display_name}에게 {CATEGORY_LABELS[topGap.category]} 담보가 없어요
            </b>
            <span className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {topGap.category === 'liability'
                ? '아이가 남의 물건을 망가뜨렸을 때 쓰는 담보입니다. 부모 계약의 가족일상생활배상책임으로 자녀까지 보장되는지 확인해보세요.'
                : '핵심 담보 중 하나입니다. 보장 탭에서 전체 공백을 확인해보세요.'}
            </span>
            <span className="mt-2 block text-[15px] font-semibold" style={{ color: 'var(--alert)' }}>
              보장 맵에서 공백 {totals.gapCount}칸 보기 →
            </span>
          </span>
        </Link>
      ) : null}

      <SectionTitle
        meta={
          <Link href="/family" className="text-[14px] font-semibold" style={{ color: 'var(--brand-ink)' }}>
            전체 보기
          </Link>
        }
      >
        우리 가족
      </SectionTitle>

      <Card className="!p-0">
        {members.map((m, i) => {
          const f = freshness(daysAgo(m.last_synced_at, now));
          const failed = m.last_run_status === 'failed';
          return (
            <div
              key={m.member_id}
              className="flex items-center gap-3 px-4 py-3.5"
              style={i === 0 ? undefined : { borderTop: '1px solid var(--line)' }}
            >
              <Avatar name={m.display_name} variant={m.relation === '본인' ? 'brand' : 'muted'} />
              <span className="min-w-0 flex-1">
                <b className="text-[16px]">{m.display_name}</b>
                <br />
                <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
                  계약 {Number(m.last_policy_count ?? 0)}건 · 담보{' '}
                  {coverageCountByMember.get(m.display_name) ?? 0}개
                </span>
              </span>
              <Pill tone={failed ? 'bad' : f.tone}>{failed ? '조회 실패' : f.text}</Pill>
            </div>
          );
        })}
      </Card>

      <p className="note">
        조회는 가끔, 데이터는 항상. 새 보험에 가입했을 때만 다시 동기화하면 됩니다.
      </p>

      <Disclaimer />
    </>
  );
}
