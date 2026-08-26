import type { Metadata } from 'next';
import { currentEnvironment } from '@/lib/connect/service';
import { isLiveAllowed } from '@/lib/connect/live-guard';
import { ConnectFlow } from './connect-flow';

// 실행 중인 서버가 실제로 보는 값을 읽어야 하므로 매 요청마다 확인한다.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '내 보험 연결',
  description: '한국신용정보원 계정으로 우리집 보험 계약을 가져옵니다.',
};

export default function ConnectPage() {
  /**
   * 어떤 환경으로 조회할지 누르기 **전에** 보여준다.
   *
   * .env.local 을 바꿔도 실행 중인 dev 서버는 시작할 때 읽은 값을 계속 쓴다.
   * 셸에 CODEF_ENV 가 설정돼 있으면 .env.local 보다 그쪽이 이긴다.
   * 그래서 "설정은 demo 인데 앱은 sandbox" 가 생기고, 가짜 계약을 받고도 모른다.
   */
  return <ConnectFlow environment={currentEnvironment()} liveAllowed={isLiveAllowed()} />;
}
