/**
 * 키가 살아 있는지만 확인한다.
 *
 *   npm run codef:ping
 *
 * OAuth 토큰 발급만 해본다. 계약 조회가 아니므로 **하루 100건 한도를 쓰지 않고**,
 * 내보험다보여 계정도 필요 없다. "연결이 안 되는데 키 문제인지 계정 문제인지"를
 * 가르는 첫 단계다.
 */
import './load-env';
import { CodefClient, configFromEnv } from '../src/lib/codef/client';
import { currentEnvironment } from '../src/lib/connect/service';

async function main() {
  const env = currentEnvironment();
  console.log(`환경        ${env}`);

  let config;
  try {
    config = configFromEnv();
  } catch (error) {
    console.log('키          없음 — .env.local 을 확인하세요');
    console.log(`            ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`키 출처     ${config.source}`);
  console.log(`클라이언트  ${config.clientId.slice(0, 8)}… (뒤는 가림)`);
  if (config.source === 'CODEF_CLIENT_ID') {
    console.log(`            ⚠ 환경 전용 변수가 없어 공용 값을 씁니다.`);
    console.log(`              CODEF 콘솔은 환경마다 키를 따로 발급합니다 — ${env} 키가 맞는지 확인하세요.`);
  }

  try {
    const token = await new CodefClient(config).getAccessToken();
    console.log(`토큰        발급 성공 (${token.length}자)`);
    console.log('\n키는 정상입니다. 그래도 조회가 실패한다면 대상기관(내보험다보여) 계정 쪽 문제입니다.');
  } catch (error) {
    console.log('토큰        발급 실패');
    console.log(`            ${error instanceof Error ? error.message : error}`);
    console.log(`\n${env} 환경의 키가 맞는지 확인하세요. CODEF 콘솔은 샌드박스·데모·정식 키를 따로 발급합니다.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
