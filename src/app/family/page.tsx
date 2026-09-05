import Link from 'next/link';
import { CORE_CATEGORIES } from '@/lib/repo/dashboard';
import { getHouseholdView } from '@/lib/repo/view-data';
import { CATEGORY_LABELS } from '@/lib/domain/coverage-category';
import { attributedNameOf, unmatchedInsuredNames } from '@/lib/domain/family-attribution';
import { Avatar, Card, Icon, ICONS, Pill, SectionTitle } from '../_components/ui';
import { ConnectCard, PreviewNotice } from '../_components/connect';
import { DataSourceNotice } from '../_components/data-source';
import { DataErrorCard } from '../_components/data-error';
import { Beoni } from '../_components/brand';

export const dynamic = 'force-dynamic';

/**
 * 가족 화면 — 구성원은 두 종류다.
 *
 *   1. 인증 구성원: 본인 인증으로 자기 계약을 직접 가져온 사람 (본인·배우자·부모).
 *      동기화 상태를 보여주고, 오래되면 다시 조회를 권한다.
 *   2. 등록 구성원: 인증 없이 이름·관계만 등록된 사람 (주로 미성년 자녀).
 *      가족 계약의 피보험자명 매칭으로 보장이 자동 귀속된다. 미성년자는 계약자가
 *      될 수 없으므로 로그인 자체가 의미가 없다 — 부모 계약에 이미 들어 있다.
 *
 * 계약 수·담보 수는 조회자가 아니라 **피보험자 귀속** 기준이다. 계약자 본인 조회에
 * 피보험자=배우자·자녀 계약이 딸려 오기 때문이다 (family-attribution.ts).
 */

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

export default async function FamilyPage() {
  const { mode, dataEnvironment, members, matrix, policies } = await getHouseholdView();
  if (mode === 'error') return <DataErrorCard />;
  const preview = mode === 'preview';
  const now = new Date();

  // 유지 중인 계약만, 피보험자 귀속 이름으로 센다.
  const memberNames = members.map((m) => m.display_name);
  const activePolicies = policies.filter((p) => p.status === '유지');
  const activeByMember = new Map<string, number>();
  const ownerOfPolicy = new Map<string, string>();
  for (const p of activePolicies) {
    const owner = attributedNameOf(p, memberNames);
    ownerOfPolicy.set(p.id, owner);
    activeByMember.set(owner, (activeByMember.get(owner) ?? 0) + 1);
  }

  // 담보 수는 귀속된 보장 맵에서 읽는다 — 계약 수와 같은 기준을 쓴다.
  const coverageCount = new Map<string, number>();
  for (const cell of matrix) {
    coverageCount.set(
      cell.display_name,
      (coverageCount.get(cell.display_name) ?? 0) + Number(cell.coverage_count),
    );
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

  const totalActiveCoverages = [...coverageCount.values()].reduce((a, b) => a + b, 0);

  // 계약의 피보험자 중 아직 가족에 없는 이름 — 추가를 권한다 (실사례: 배우자 명의 계약).
  const missing = preview ? [] : unmatchedInsuredNames(policies, memberNames);

  return (
    <>
      <SectionTitle meta={`${members.length}명 · 유지 담보 ${totalActiveCoverages}개`}>
        {preview ? '예시 가구' : '우리 가족'}
      </SectionTitle>

      {preview ? <PreviewNotice>연결하면 우리 가족이 여기에 들어옵니다</PreviewNotice> : null}
      <DataSourceNotice environment={dataEnvironment} />

      {missing.map((u) => (
        <Card key={u.name} tone="warn" className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <b className="text-[15px]">
              피보험자 「{u.name}」 계약 {u.count}건이 있어요
            </b>
            <span className="block text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              가족으로 추가하면 이 계약들이 그분 몫으로 정리됩니다.
            </span>
          </span>
          <Link
            href={`/family/add?name=${encodeURIComponent(u.name)}`}
            className="btn btn-soft flex-none !min-h-[40px] !px-3"
          >
            추가
          </Link>
        </Card>
      ))}

      {members.map((m) => {
        const authed = m.last_run_id !== null || m.relation === '본인';
        const days = daysAgo(m.last_synced_at, now);
        const stale = authed && (days === null || days > 180);
        const gaps = gapsByMember.get(m.member_id) ?? [];
        const active = activeByMember.get(m.display_name) ?? 0;
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
                  유지 {active}건 · 담보 {coverageCount.get(m.display_name) ?? 0}개
                </span>
              </span>
              {authed ? (
                <Pill tone={m.last_run_status === 'failed' ? 'bad' : stale ? 'warn' : 'ok'}>
                  {m.last_run_status === 'failed'
                    ? '조회 실패'
                    : days === null
                      ? '동기화 안 됨'
                      : days === 0
                        ? '오늘'
                        : `${days}일 전`}
                </Pill>
              ) : (
                <Pill tone={active > 0 ? 'ok' : 'warn'}>
                  {active > 0 ? '가족 계약으로 보장' : '연결된 계약 없음'}
                </Pill>
              )}
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

            {!authed ? (
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                {m.is_minor
                  ? '인증 없이 등록된 구성원입니다. 가족 계약에서 피보험자가 이 이름인 계약이 자동으로 연결됩니다.'
                  : active > 0
                    ? '가족 계약의 피보험자로 연결되어 있습니다. 본인이 직접 가입한 보험까지 보려면 본인 인증이 필요합니다.'
                    : '아직 연결된 계약이 없습니다. 계약의 피보험자명과 이름이 같아야 자동으로 연결됩니다.'}
              </p>
            ) : null}

            {stale ? (
              <>
                <div className="flex items-start gap-2.5">
                  <span className="flex-none">
                    <Beoni pose="clock" height={40} />
                  </span>
                  <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    마지막 조회가 반년을 넘었습니다. 그 사이 새로 가입한 보험이 있다면 반영되지
                    않습니다.
                  </p>
                </div>
                {/* 연결 화면이 생겼으니 여기서 바로 보낸다. 안내만 하고 길이 없으면 막다른 길이다. */}
                <Link href="/connect" className="btn btn-soft">
                  다시 동기화
                </Link>
              </>
            ) : null}
          </Card>
        );
      })}

      {preview ? <ConnectCard cta="내 보험부터 연결하기" /> : null}

      <Link href="/family/add" className="card card-tap flex items-center gap-3" style={{ borderStyle: 'dashed' }}>
        <span className="avatar avatar-ghost">
          <Icon path={ICONS.plus} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="text-[16px]">가족 추가</b>
          <br />
          <span className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
            미성년 자녀는 이름만 등록하면 부모 계약에서 자동으로 연결됩니다
          </span>
        </span>
        <span className="flex-none" style={{ color: 'var(--ink-3)' }}>
          <Icon path={ICONS.chevron} size={19} />
        </span>
      </Link>

      <p className="note">
        성인 가족의 <b className="font-semibold" style={{ color: 'var(--ink-2)' }}>본인 명의 계약</b>은
        대신 조회할 수 없습니다 — 각자 인증하면 결과만 우리집 화면에 합쳐집니다. 미성년 자녀는
        계약자가 될 수 없으므로 인증이 필요 없습니다.
      </p>
    </>
  );
}
