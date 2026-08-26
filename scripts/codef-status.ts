/**
 * 지금 어느 환경으로 조회하고 있고, 오늘 몇 건 썼는지 출력한다.
 *
 * 데모 키는 하루 100건이고 한 달이면 끝난다. "몇 건 남았지?"를 눈으로 확인할
 * 방법이 없으면 모르는 사이에 소진된다.
 *
 *   npm run codef:status
 */
import './load-env';
import { countTodayRuns, dailyLimit, isLive, isLiveAllowed } from '../src/lib/connect/live-guard';
import { currentEnvironment } from '../src/lib/connect/service';
import { closePool } from '../src/lib/db';

const LABEL: Record<string, string> = {
  sandbox: '샌드박스 (고정 응답 · 무료 · 무제한)',
  demo: '데모 (실데이터 · 1개월 · 하루 100건)',
  api: '정식 (실데이터 · 호출당 과금)',
};

async function main() {
  const env = currentEnvironment();
  const live = isLive(env);

  console.log(`환경        ${env} — ${LABEL[env] ?? '알 수 없음'}`);
  console.log(`실데이터    ${live ? '예' : '아니오'}`);

  if (!live) {
    console.log('\n샌드박스에서는 몇 번을 눌러도 실제 계약을 건드리지 않습니다.');
    return;
  }

  console.log(`잠금        ${isLiveAllowed() ? '열림 (CODEF_ALLOW_LIVE=true)' : '잠김 — 조회가 거부됩니다'}`);

  try {
    const used = await countTodayRuns(env);
    const limit = dailyLimit();
    console.log(`오늘 사용   ${used} / ${limit}건 (남은 ${Math.max(0, limit - used)}건)`);
  } catch (error) {
    // 스택을 통째로 쏟으면 정작 읽어야 할 앞의 세 줄이 묻힌다. 한 줄로 줄인다.
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`오늘 사용   DB 에 연결하지 못해 셀 수 없습니다 — ${reason}`);
    console.log('            DATABASE_URL 을 확인하세요. 조회 자체는 막히지 않습니다.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
