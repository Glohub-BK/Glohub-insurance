import Link from 'next/link';
import { CORE_CATEGORIES, getCoverageMatrix, getCoverages, getMembers, getPolicies } from '@/lib/repo/dashboard';
import { getCurrentHousehold } from '@/lib/repo/household';
import { CATEGORY_LABELS } from '@/lib/domain/coverage-category';
import { Avatar, Card, Icon, ICONS, Pill, SectionTitle } from '../_components/ui';
import { EmptyHousehold } from '../_components/empty';

export const dynamic = 'force-dynamic';

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

export default async function FamilyPage() {
  const household = await getCurrentHousehold();
  if (!household) return <EmptyHousehold />;

  const [members, matrix, policies, coverages] = await Promise.all([
    getMembers(household.id),
    getCoverageMatrix(household.id),
    getPolicies(household.id),
    getCoverages(household.id),
  ]);
  const now = new Date();

  const policyMember = new Map(policies.map((p) => [p.id, p.member_name]));
  const coverageCount = new Map<string, number>();
  for (const c of coverages) {
    const name = policyMember.get(c.policy_id);
    if (!name) continue;
    coverageCount.set(name, (coverageCount.get(name) ?? 0) + 1);
  }

  // 구성원별 핵심 담보 공백 목록
  const gapsByMember = new Map<string, string[]>();
  for (const cell of matrix) {
    if (!CORE_CATEGORIES.includes(cell.category)) continue;
    if (Number(cell.coverage_count) > 0) continue;
    const list = gapsByMember.get(cell.member_id) ?? [];
    list.push(CATEGORY_LABELS[cell.category]);
    gapsByMember.set(cell.member_id, list);
  }

  const totalCoverages = coverages.length;

  return (
    <>
      <SectionTitle meta={`${members.length}명 · 담보 ${totalCoverages}개`}>우리 가족</SectionTitle>

      {members.map((m) => {
        const days = daysAgo(m.last_synced_at, now);
        const stale = days === null || days > 180;
        const gaps = gapsByMember.get(m.member_id) ?? [];
        return (
          <Card key={m.member_id} tone={stale ? 'warn' : undefined} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                name={m.display_name}
                variant={m.relation === '본인' ? 'brand' : stale ? 'ghost' : 'muted'}
              />
              <span className="min-w-0 flex-1">
                <b className="text-[16px]">{m.display_name}</b>
                <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
                  {' '}
                  · {m.relation}
                  {m.is_minor ? ' · 미성년' : ''}
                </span>
                <br />
                <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
                  계약 {Number(m.last_policy_count ?? 0)}건 · 담보 {coverageCount.get(m.display_name) ?? 0}개
                </span>
              </span>
              <Pill tone={m.last_run_status === 'failed' ? 'bad' : stale ? 'warn' : 'ok'}>
                {m.last_run_status === 'failed'
                  ? '조회 실패'
                  : days === null
                    ? '동기화 안 됨'
                    : days === 0
                      ? '오늘'
                      : `${days}일 전`}
              </Pill>
            </div>

            <div
              className="flex items-center justify-between gap-2 border-t pt-2.5"
              style={{ borderColor: 'var(--line)' }}
            >
              <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
                핵심 담보 공백
              </span>
              {gaps.length === 0 ? (
                <Pill tone="ok">없음</Pill>
              ) : (
                <Pill tone="bad">
                  {gaps.slice(0, 2).join(' · ')}
                  {gaps.length > 2 ? ` 외 ${gaps.length - 2}` : ''}
                </Pill>
              )}
            </div>

            {stale ? (
              <>
                <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                  마지막 조회가 반년을 넘었습니다. 그 사이 새로 가입한 보험이 있다면 반영되지
                  않습니다.
                </p>
                <button type="button" className="btn btn-soft" disabled>
                  다시 동기화
                  <span className="text-[14px] font-medium">(인증 화면 준비 중)</span>
                </button>
              </>
            ) : null}
          </Card>
        );
      })}

      <Link href="/family/add" className="card card-tap flex items-center gap-3" style={{ borderStyle: 'dashed' }}>
        <span className="avatar avatar-ghost">
          <Icon path={ICONS.plus} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="text-[16px]">가족 추가</b>
          <br />
          <span className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
            부모님이 들어둔 내 보험, 조부모님의 손자녀보험도 함께 봅니다
          </span>
        </span>
        <span className="flex-none" style={{ color: 'var(--ink-3)' }}>
          <Icon path={ICONS.chevron} size={19} />
        </span>
      </Link>

      <p className="note">
        가족 계약은 대신 조회할 수 없습니다. 각자 인증하면 결과만 우리집 화면에 합쳐집니다.{' '}
        <b className="font-semibold" style={{ color: 'var(--ink-2)' }}>
          조회는 가끔, 데이터는 항상
        </b>{' '}
        — 새 보험에 가입했을 때만 다시 동기화하세요.
      </p>
    </>
  );
}
