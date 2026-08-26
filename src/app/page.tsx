import Link from 'next/link';
import { computeTotals, CORE_CATEGORIES } from '@/lib/repo/dashboard';
import { getHouseholdView } from '@/lib/repo/view-data';
import { CATEGORY_LABELS } from '@/lib/domain/coverage-category';
import { Avatar, Card, Disclaimer, Pill, SectionTitle } from './_components/ui';
import { ConnectCard, MaskedAmount, PreviewNotice } from './_components/connect';
import { DataSourceNotice } from './_components/data-source';
import { DataErrorCard } from './_components/data-error';
import { HomeHero } from './_components/home-hero';
import { Beoni } from './_components/brand';

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
  const { mode, dataEnvironment, members, matrix, policies, coverages } = await getHouseholdView();
  if (mode === 'error') return <DataErrorCard />;
  const preview = mode === 'preview';
  const totals = computeTotals(members, matrix, policies);
  const now = new Date();

  // 담보 개수는 "계약 N건"보다 실제 보장 크기를 잘 보여준다.
  // 내보험다보여는 만기·해지된 옛 계약까지 돌려주므로, 구성원 행에는 유지 중인
  // 계약과 그 담보만 센다. 전체 이력은 위 보험료 카드가 이미 보여주고 있다.
  const activePolicies = policies.filter((p) => p.status === '유지');
  const activeByMember = new Map<string, number>();
  for (const p of activePolicies) {
    activeByMember.set(p.member_name, (activeByMember.get(p.member_name) ?? 0) + 1);
  }
  const activePolicyMember = new Map(activePolicies.map((p) => [p.id, p.member_name]));
  const coverageCountByMember = new Map<string, number>();
  for (const c of coverages) {
    const name = activePolicyMember.get(c.policy_id);
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
      {/* 입력창을 맨 위에 둔다. 연결 전에도 그대로 써볼 수 있다. */}
      <HomeHero />

      {preview ? <PreviewNotice>아래는 예시 가구입니다. 연결하면 내 보험으로 바뀝니다</PreviewNotice> : null}
      <DataSourceNotice environment={dataEnvironment} />

      {preview ? (
        <MaskedAmount label="우리집 월 보험료" />
      ) : (
        <Card>
          <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
            우리집 월 보험료
          </span>
          <div className="tnum my-0.5 text-[34px] leading-[1.1] font-bold tracking-[-0.03em]">
            {totals.monthlyPremium.toLocaleString('ko-KR')}
            <span className="ml-1 text-[19px] font-semibold tracking-normal">원</span>
          </div>
          {/* 알약은 내용 길이에 따라 폭이 제각각이라 숫자 비교가 안 된다.
              같은 규격의 타일 3칸으로 고정한다 — 시선이 숫자만 오간다. */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: '전체 계약', value: policies.length, accent: false },
              { label: '유지 중', value: totals.activePolicyCount, accent: true },
              { label: '만기·해지', value: policies.length - totals.activePolicyCount, accent: false },
            ].map((t) => (
              <div
                key={t.label}
                className="rounded-[12px] px-2 py-2.5"
                style={{
                  background: t.accent ? 'var(--brand-soft)' : 'var(--sub)',
                  border: `1px solid ${t.accent ? 'var(--brand-line)' : 'var(--line)'}`,
                }}
              >
                <span
                  className="tnum block text-[19px] leading-tight font-bold"
                  style={{ color: t.accent ? 'var(--brand-ink)' : 'var(--ink)' }}
                >
                  {t.value}
                </span>
                <span className="block text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {topGap ? (
        <Link
          href="/coverage"
          className="card card-tap flex items-start gap-3"
          style={{ background: 'var(--alert-soft)', borderColor: 'var(--alert-line)' }}
        >
          {/* 경고 포즈 뻐니. 아이콘보다 눈에 걸리고, 문장을 사람이 하는 말처럼 만든다. */}
          <span className="flex-none">
            <Beoni pose="alert" height={44} />
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
        {preview ? '예시 가구' : '우리 가족'}
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
                  유지 {activeByMember.get(m.display_name) ?? 0}건 · 담보{' '}
                  {coverageCountByMember.get(m.display_name) ?? 0}개
                </span>
              </span>
              {preview ? <Pill>예시</Pill> : <Pill tone={failed ? 'bad' : f.tone}>{failed ? '조회 실패' : f.text}</Pill>}
            </div>
          );
        })}
      </Card>

      {preview ? (
        <ConnectCard />
      ) : (
        <p className="note">조회는 가끔, 데이터는 항상. 새 보험에 가입했을 때만 다시 동기화하면 됩니다.</p>
      )}

      {/* 광고·제휴 배너 자리. 진단 결과와 시각적으로 분리되도록 항상 이 아래에 둔다. */}

      <Disclaimer />
    </>
  );
}
