import { Beoni, type BeoniPose } from './brand';

/**
 * 화면 전환 로딩.
 *
 * 뻐니가 좌우로 오가며 두 포즈를 번갈아 보여준다. 스피너 대신 캐릭터가 움직여야
 * "멈춘 화면"이 아니라 "일하는 중"으로 읽힌다. 이 앱의 대기는 대부분 보험사
 * 조회라 실제로 길다 — 문장으로 무엇을 하는 중인지도 함께 말한다.
 */
const COUNTERPART: Partial<Record<BeoniPose, BeoniPose>> = {
  search: 'thinking',
  thinking: 'search',
  sync: 'relief',
  relief: 'sync',
  shield: 'relief',
  phone: 'relief',
};

export function LoadingScreen({
  message,
  pose = 'relief',
}: {
  message: string;
  pose?: BeoniPose;
}) {
  const alt = COUNTERPART[pose] ?? 'relief';

  return (
    <div className="nc-in flex flex-1 flex-col items-center justify-center gap-4 py-16">
      <div className="nc-sway">
        <div className="nc-swap">
          <Beoni pose={pose} height={104} />
          <Beoni pose={alt} height={104} />
        </div>
      </div>
      <p className="nc-bubble max-w-[16rem] text-center text-[15px]" style={{ color: 'var(--ink-2)' }}>
        {/* "로딩 중" 은 기계의 말이다. 기다리는 사람을 안심시키는 문장으로 바꾼다. */}
        <b className="font-semibold" style={{ color: 'var(--ink)' }}>
          잠깐이면 돼요
        </b>
        <br />
        {message}
        <span aria-hidden="true">
          <span className="nc-dot">.</span>
          <span className="nc-dot">.</span>
          <span className="nc-dot">.</span>
        </span>
      </p>
    </div>
  );
}
