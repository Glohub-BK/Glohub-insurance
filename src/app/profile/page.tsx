import Link from 'next/link';
import type { ReactNode } from 'react';
import { computeTotals } from '@/lib/repo/dashboard';
import { avatarSrc } from '@/lib/repo/avatar';
import { getHouseholdView } from '@/lib/repo/view-data';
import { Avatar, Card, Icon, ICONS, Pill } from '../_components/ui';
import { ConnectCard, PreviewNotice } from '../_components/connect';
import { DataErrorCard } from '../_components/data-error';
import { Beoni } from '../_components/brand';
import { AvatarUpload } from './avatar-upload';

export const dynamic = 'force-dynamic';

/**
 * 내 정보.
 *
 * 국내 보험 앱의 「내 정보」는 대체로 같은 골격이다 — 프로필 헤더, 아이콘 몇 개, 묶음
 * 리스트, 비교 배너, 정책 푸터. 익숙한 순서를 굳이 바꾸지 않는다. 대신 리스트에 담는
 * 내용은 다르다. 상품 추천이나 설계사 연결은 넣지 않는다. 이 앱은 가입시키는 앱이
 * 아니라 이미 가진 걸 못 쓰고 넘어가지 않게 하는 앱이다.
 */

/** 리스트 한 줄. 아직 만들지 않은 화면은 링크 없이 「준비 중」으로 둔다. */
function Row({
  title,
  sub,
  href,
  right,
  badge,
  first = false,
}: {
  title: string;
  sub?: ReactNode;
  href?: string;
  right?: ReactNode;
  badge?: ReactNode;
  first?: boolean;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <b className="text-[15px] font-semibold">{title}</b>
          {badge}
        </span>
        {sub ? (
          <span className="mt-0.5 block text-[14px]" style={{ color: 'var(--ink-3)' }}>
            {sub}
          </span>
        ) : null}
      </span>
      {right ?? (
        <span className="flex-none" style={{ color: 'var(--ink-3)' }}>
          <Icon path={ICONS.chevron} size={18} />
        </span>
      )}
    </>
  );

  const cls = `flex items-center gap-3 px-4 py-3.5${first ? '' : ' border-t'}`;
  const style = first ? undefined : { borderColor: 'var(--line)' };

  return href ? (
    <Link href={href} className={cls} style={style}>
      {inner}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-3.5 pb-1 text-[14px] font-semibold" style={{ color: 'var(--ink-3)' }}>
      {children}
    </div>
  );
}

const SOON = <Pill tone="warn">준비 중</Pill>;

/**
 * 보험 앱에서 사람들이 실제로 막히는 다섯 가지.
 * 전부 「어떤 상품을 들까」가 아니라 「이미 든 보험을 왜 못 쓰고 있나」쪽이다.
 */
const TOP5: { q: string; a: string }[] = [
  { q: '지금 청구할 수 있는 게 남았나?', a: '소멸시효 3년 · 진료 내역과 대조' },
  { q: '왜 깎였지 / 왜 거절됐지?', a: '면책·감액 조항을 약관 원문으로' },
  { q: '두 개 들었는데 두 배 받나?', a: '실손 비례보상 vs 정액 중복 지급' },
  { q: '보험료 언제 또 오르지?', a: '갱신 주기와 다음 갱신일' },
  { q: '청구하면 불이익 있나?', a: '갱신 거절·할증 조건' },
];

const PRIVACY: ReactNode[] = [
  <>
    <b className="font-semibold">주민등록번호를 저장하지 않습니다.</b> 인증 통과에만 쓰고 즉시
    버립니다.
  </>,
  <>
    <b className="font-semibold">비밀번호는 기기에서 암호화</b>되어 전송되며 남지 않습니다.
  </>,
  <>
    <b className="font-semibold">프로필 사진은 기기에서 잘라 줄인 뒤</b> 올라가며, 가족
    구성원에게만 보입니다. 보험 심사나 요율에는 쓰이지 않습니다.
  </>,
  <>
    보관하는 건 <b className="font-semibold">계약·담보 내용</b>과 표시용 이름뿐입니다.
  </>,
];

const NOTIFY = [
  { label: '만기·갱신 알림', on: true },
  { label: '청구 기한 임박 (소멸시효 3년)', on: true },
  { label: '보장 공백 발견', on: false },
];

const QUICK = [
  { label: '알림', icon: ICONS.bell },
  { label: '가족', icon: ICONS.family, href: '/family' },
  { label: '문의', icon: ICONS.chat },
  { label: '설정', icon: ICONS.gear },
] as const;

export default async function ProfilePage() {
  // 연결 전에도 「내 정보를 어떻게 다루는지」를 먼저 읽을 수 있어야 한다.
  // 여기서 로그인을 요구하면 개인정보 처리 방침을 확인하고 나서 연결할 방법이 없다.
  const { mode, household, members, matrix, policies } = await getHouseholdView();
  if (mode === 'error') return <DataErrorCard />;
  const preview = mode === 'preview';

  const me = members.find((m) => m.relation === '본인') ?? members[0];
  const totals = computeTotals(members, matrix, policies);
  const lastSync = me?.last_synced_at ? new Date(me.last_synced_at) : null;

  // 본인인증은 최초 1회, 이후 1년마다 갱신해야 한다. 만료일을 미리 보여준다.
  const authExpiry = lastSync
    ? new Date(Date.UTC(lastSync.getUTCFullYear() + 1, lastSync.getUTCMonth(), lastSync.getUTCDate()))
    : null;

  // 예시 가구에는 사진을 붙이지 않는다. 남의 얼굴을 내 프로필처럼 보여줄 수 없다.
  const photo = preview ? null : avatarSrc(me?.member_id ?? '', me?.avatar_updated_at ?? null);
  const nameForAvatar = me?.display_name ?? '나';

  const avatar = <Avatar name={nameForAvatar} size={56} src={photo} />;
  const identity = (
    <>
      <span className="flex items-center gap-1.5">
        <b className="text-[18px]">{me?.display_name ?? '본인'}</b>
        <Pill tone={preview ? 'grey' : 'ok'}>{preview ? '예시' : '관리자'}</Pill>
      </span>
      <span className="block text-[14px]" style={{ color: 'var(--ink-3)' }}>
        {household.name} · 구성원 {members.length}명
      </span>
    </>
  );

  return (
    <>
      {preview ? <PreviewNotice>연결하면 내 계정 정보로 바뀝니다</PreviewNotice> : null}

      <Card>
        {preview || !me ? (
          <div className="flex items-center gap-3.5">
            {avatar}
            <span className="min-w-0 flex-1">{identity}</span>
          </div>
        ) : (
          <AvatarUpload memberId={me.member_id} hasPhoto={photo !== null} avatar={avatar}>
            {identity}
          </AvatarUpload>
        )}
      </Card>

      {/* 자주 쓰는 네 가지. 굿리치의 아이콘 행 자리를 우리 기능으로 채운다. */}
      <Card className="!px-2 !py-3">
        <div className="grid grid-cols-4 gap-1">
          {QUICK.map((q) => {
            const body = (
              <>
                <span
                  className="grid h-[42px] w-[42px] place-items-center rounded-[14px]"
                  style={{
                    background: 'var(--brand-soft)',
                    border: '1px solid var(--brand-line)',
                    color: 'var(--brand-ink)',
                  }}
                >
                  <Icon path={q.icon} size={21} />
                </span>
                <span className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                  {q.label}
                </span>
              </>
            );
            return 'href' in q && q.href ? (
              <Link key={q.label} href={q.href} className="flex flex-col items-center gap-1.5 py-1">
                {body}
              </Link>
            ) : (
              <span key={q.label} className="flex flex-col items-center gap-1.5 py-1">
                {body}
              </span>
            );
          })}
        </div>
      </Card>

      <Card className="!p-0">
        <Row
          first
          title="내 보험"
          href="/coverage"
          sub={
            preview
              ? '연결하면 내 계약으로 바뀝니다'
              : `유지 ${totals.activePolicyCount}건 · 월 ${totals.monthlyPremium.toLocaleString('ko-KR')}원`
          }
        />
        <Row title="보장 분석" href="/coverage" sub="겹치는 담보 · 빈 담보" />
        <Row title="담보 여력" badge={SOON} sub="한도에서 얼마나 남았는지" />
        <Row title="보험금 받은 내역" badge={SOON} sub="언제 · 어디서 · 얼마" />
        <Row title="약관 보관함" href="/terms" sub="원본 내려받기 · 조항 읽어오기" />
        <Row title="청구 기한 알림" href="/ai" sub="보험금 청구권 소멸시효 3년" />
      </Card>

      {/* 또래 비교. 로그인 유도 장치이자 「나만 이상한가」에 답하는 자리다. */}
      <Card tone="brand" className="flex items-center gap-3">
        <Beoni pose="found" height={44} />
        <span className="min-w-0 flex-1">
          <b className="text-[16px]" style={{ color: 'var(--brand-ink)' }}>
            내 보험 vs 또래 보험
          </b>
          <br />
          <span className="text-[14px]" style={{ color: 'var(--ink-2)' }}>
            같은 또래 가구는 얼마를 내고 있을까
          </span>
        </span>
        {SOON}
      </Card>

      {/* 굿리치에는 없는 자리. 상품이 아니라 청구를 막는 질문들만 다룬다. */}
      <Card className="!p-0">
        <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1">
          <Beoni pose="thinking" height={34} />
          <b className="text-[16px]">궁금한 것부터</b>
          <span className="ml-auto">
            <Pill tone="ok">우리만</Pill>
          </span>
        </div>
        {TOP5.map((item, i) => (
          <Row key={item.q} title={`${i + 1}. ${item.q}`} sub={item.a} right={SOON} />
        ))}
        <p className="note px-4 pt-1 pb-3.5">
          각 답은 <b className="font-semibold">내 약관 조항 번호</b>와 함께 나옵니다. 조항을 찾지
          못하면 답하지 않습니다.
        </p>
      </Card>

      <Card className="!p-0">
        <GroupTitle>연결된 계정</GroupTitle>
        <Row
          title="한국신용정보원"
          sub={`보험신용정보 · ${lastSync ? `${lastSync.toLocaleDateString('ko-KR')} 조회` : '조회 이력 없음'}`}
          right={
            <Pill tone={!preview && lastSync ? 'ok' : 'warn'}>
              {!preview && lastSync ? '연결됨' : '미연결'}
            </Pill>
          }
        />
        <Row
          title="본인인증"
          sub={
            authExpiry
              ? `${authExpiry.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 갱신 필요`
              : '인증 전'
          }
          right={<Pill tone={authExpiry ? 'grey' : 'warn'}>{authExpiry ? '유효' : '필요'}</Pill>}
        />
      </Card>

      <Card>
        <span className="flex items-center gap-2">
          <Beoni pose="shield" height={40} />
          <b className="text-[16px]">내 정보는 이렇게 다룹니다</b>
        </span>
        <ul className="mt-3 flex flex-col gap-2.5">
          {PRIVACY.map((node, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
              <span className="mt-1 flex-none" style={{ color: 'var(--brand-ink)' }}>
                <Icon path={ICONS.check} size={19} />
              </span>
              <span>{node}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="!p-0">
        <GroupTitle>알림</GroupTitle>
        {NOTIFY.map((n) => (
          <Row
            key={n.label}
            title={n.label}
            right={<Pill tone={n.on ? 'ok' : 'grey'}>{n.on ? '켜짐' : '꺼짐'}</Pill>}
          />
        ))}
      </Card>

      <Card className="!p-0">
        <GroupTitle>약관 및 정책</GroupTitle>
        <Row title="회사 소개" sub="글로허브" right={SOON} />
        <Row title="알아두실 사항" sub="놓칠뻔은 보험금 산정·청구 대행을 하지 않습니다" right={SOON} />
        <Row title="내 데이터 내려받기" right={<span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>JSON</span>} />
        <Row
          title="계정과 모든 데이터 삭제"
          right={
            <span className="text-[14px]" style={{ color: 'var(--alert)' }}>
              되돌릴 수 없음
            </span>
          }
        />
      </Card>

      {preview ? <ConnectCard cta="한국신용정보원 계정으로 연결하기" /> : null}

      <p className="note">
        놓칠뻔은 가입한 보험의 약관 내용을 정리해 보여주는 정보 제공 도구입니다. 보험금 산정이나
        청구 대행을 하지 않습니다.
      </p>
    </>
  );
}
