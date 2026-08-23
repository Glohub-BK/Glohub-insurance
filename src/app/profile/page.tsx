import { getMembers } from '@/lib/repo/dashboard';
import { getCurrentHousehold } from '@/lib/repo/household';
import { Avatar, Card, Icon, ICONS, Pill } from '../_components/ui';
import { EmptyHousehold } from '../_components/empty';

export const dynamic = 'force-dynamic';

/**
 * 보험 앱의 프로필은 설정 모음이 아니라 "내 정보를 어떻게 다루는지" 보여주는 자리다.
 * 약관에 묻어두지 않고 화면에 띄운다.
 */
export default async function ProfilePage() {
  const household = await getCurrentHousehold();
  if (!household) return <EmptyHousehold />;

  const members = await getMembers(household.id);
  const me = members.find((m) => m.relation === '본인') ?? members[0];
  const lastSync = me?.last_synced_at ? new Date(me.last_synced_at) : null;

  // 본인인증은 최초 1회, 이후 1년마다 갱신해야 한다. 만료일을 미리 보여준다.
  const authExpiry = lastSync
    ? new Date(Date.UTC(lastSync.getUTCFullYear() + 1, lastSync.getUTCMonth(), lastSync.getUTCDate()))
    : null;

  const PRIVACY = [
    <>
      <b className="font-semibold">주민등록번호를 저장하지 않습니다.</b> 인증 통과에만 쓰고 즉시
      버립니다.
    </>,
    <>
      <b className="font-semibold">비밀번호는 기기에서 암호화</b>되어 전송되며 남지 않습니다.
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

  return (
    <>
      <Card className="flex items-center gap-3.5">
        <Avatar name={me?.display_name ?? '나'} size={56} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <b className="text-[18px]">{me?.display_name ?? '본인'}</b>
            <Pill tone="ok">관리자</Pill>
          </span>
          <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
            {household.name} · 구성원 {members.length}명
          </span>
        </span>
      </Card>

      <Card className="!p-0">
        <div className="px-4 pt-3.5 pb-2 text-[14px] font-semibold" style={{ color: 'var(--ink-3)' }}>
          연결된 계정
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: 'var(--line)' }}>
          <span className="min-w-0 flex-1">
            <b className="text-[16px]">내보험다보여</b>
            <br />
            <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
              신용정보원 ·{' '}
              {lastSync ? `${lastSync.toLocaleDateString('ko-KR')} 조회` : '조회 이력 없음'}
            </span>
          </span>
          <Pill tone={lastSync ? 'ok' : 'warn'}>{lastSync ? '연결됨' : '미연결'}</Pill>
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: 'var(--line)' }}>
          <span className="min-w-0 flex-1">
            <b className="text-[16px]">본인인증</b>
            <br />
            <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
              {authExpiry
                ? `${authExpiry.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 갱신 필요`
                : '인증 전'}
            </span>
          </span>
          <Pill tone={authExpiry ? 'grey' : 'warn'}>{authExpiry ? '유효' : '필요'}</Pill>
        </div>
      </Card>

      <Card>
        <b className="text-[16px]">내 정보는 이렇게 다룹니다</b>
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
        <div className="px-4 pt-3.5 pb-2 text-[14px] font-semibold" style={{ color: 'var(--ink-3)' }}>
          알림
        </div>
        {NOTIFY.map((n, i) => (
          <div
            key={n.label}
            className="flex items-center justify-between gap-3 border-t px-4 py-3"
            style={{ borderColor: 'var(--line)' }}
          >
            <span className="text-[15px]">{n.label}</span>
            <Pill tone={n.on ? 'ok' : 'grey'}>{n.on ? '켜짐' : '꺼짐'}</Pill>
            <span className="sr-only">{i}</span>
          </div>
        ))}
      </Card>

      <Card className="!p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[15px]">내 데이터 내려받기</span>
          <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
            JSON
          </span>
        </div>
        <div
          className="flex items-center justify-between gap-3 border-t px-4 py-3.5"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="text-[15px] font-semibold" style={{ color: 'var(--alert)' }}>
            계정과 모든 데이터 삭제
          </span>
          <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
            되돌릴 수 없음
          </span>
        </div>
      </Card>

      <p className="note">
        보장맵은 가입한 보험의 약관 내용을 정리해 보여주는 정보 제공 도구입니다. 보험금 산정이나
        청구 대행을 하지 않습니다.
      </p>
    </>
  );
}
