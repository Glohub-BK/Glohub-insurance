import Image from 'next/image';

/**
 * CI 자산 래퍼.
 *
 * SVG 는 public/brand/ 에 파일로 두고 next/image 로 부른다. 컴포넌트로 인라인하면
 * 한 화면에 여러 개 올릴 때 그라디언트 id 가 충돌해 마지막 것만 살아남는다
 * (가이드 페이지를 만들며 실제로 겪었다). 파일로 부르면 각자 자기 문서에서 렌더된다.
 *
 * width/height 는 반드시 원본 viewBox 비율과 같아야 한다. 한쪽만 바꾸면 next/image 가
 * 비율 경고를 낸다. 그래서 크기는 높이 하나로만 받고 폭은 비율로 계산한다.
 *
 * 원본과 재생성 스크립트: design/ci/
 */

const RATIO = {
  mascot: 220 / 224,
  mark: 200 / 224,
  logo: 276 / 130,
} as const;

export type BeoniPose =
  | 'confident'
  | 'relief'
  | 'alert'
  | 'found'
  | 'greet'
  | 'thinking'
  | 'search'
  | 'phone'
  | 'sync'
  | 'doc'
  | 'clock'
  | 'shield'
  | 'sorry'
  | 'cheer';

/**
 * 포즈마다 쓰는 자리가 정해져 있다. 아무 데나 쓰면 표정이 의미를 잃는다.
 * 새 화면에 뻐니를 넣을 때는 여기서 먼저 자리를 고르고, 없으면 포즈를 만들지 말고
 * 가장 가까운 것을 쓴다 — 표정이 늘어날수록 캐릭터가 흐려진다.
 */
export const BEONI_POSE: Record<BeoniPose, string> = {
  confident: '첫 화면 · 스플래시',
  relief: '기본 로딩 · 빈 화면',
  alert: '보장 공백 · 주의',
  found: '진단 성공',
  greet: '첫 방문 · 온보딩 인사',
  thinking: '진단 중 · 판단 근거 안내',
  search: '조회 중 · 검색 결과 없음',
  phone: '휴대폰 인증 대기(2-way)',
  sync: '동기화 중 · 갱신 안내',
  doc: '청구 서류 안내',
  clock: '만기 · 청구 기한 임박(소멸시효 3년)',
  shield: '개인정보 · 보안 안내',
  sorry: '해당 담보 없음 · 조회 실패',
  cheer: '연결 완료 · 청구 완료',
};

export function Beoni({
  pose = 'relief',
  height = 104,
  className,
  priority = false,
}: {
  pose?: BeoniPose;
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={`/brand/mascot-${pose}.svg`}
      alt="뻐니"
      width={Math.round(height * RATIO.mascot)}
      height={height}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}

export function LogoHorizontal({ height = 40, className }: { height?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo-horizontal.svg"
      alt="놓칠뻔"
      width={Math.round(height * RATIO.logo)}
      height={height}
      className={className}
      priority
      unoptimized
    />
  );
}

export function Mark({ height = 30, className }: { height?: number; className?: string }) {
  return (
    <Image
      src="/brand/mark.svg"
      alt=""
      aria-hidden="true"
      width={Math.round(height * RATIO.mark)}
      height={height}
      className={className}
      unoptimized
    />
  );
}
