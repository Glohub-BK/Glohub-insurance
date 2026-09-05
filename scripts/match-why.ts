/**
 * 사고 문장 하나를 넣고, 내 실데이터의 담보들이 어떤 판정을 받았는지 본다.
 *
 *   npm run match:why -- "아이가 물건 파손을 했어요"
 *
 * "일배책이 있는데 왜 담보 없음이냐" 를 코드 열지 않고 답하는 도구다.
 * 판정 로직은 화면과 같은 explainMatch 를 그대로 쓴다 — 별도 구현이 아니라서
 * 여기 결과와 화면 결과가 어긋날 수 없다.
 */
import './load-env';
import { closePool } from '../src/lib/db';
import { getCurrentHousehold } from '../src/lib/repo/household';
import { getCoverageCandidates } from '../src/lib/repo/dashboard';
import { explainMatch, type CoverageFate } from '../src/lib/domain/incident-match';

const FATE_LABEL: Record<CoverageFate, string> = {
  direct: '✅ 직접 해당',
  related: '📎 참고 목록',
  'cause-mismatch': '📎 참고 (원인 상충)',
  'excluded-name': '🚫 제외 (이름)',
  'excluded-kind': '🚫 제외 (계약 종류)',
  'excluded-context': '🚫 제외 (교통 전용 담보 — 차·운전 정황 없음)',
  'excluded-status': '🚫 제외 (상태)',
  'out-of-category': '· 대상 아님 (카테고리)',
};

async function main() {
  const text = process.argv.slice(2).join(' ').trim();
  if (!text) {
    console.log('사용법: npm run match:why -- "아이가 물건 파손을 했어요"');
    return;
  }

  const household = await getCurrentHousehold();
  if (!household) {
    console.log('가구가 없습니다. 먼저 연결(조회)을 한 번 실행하세요.');
    return;
  }

  const rows = await getCoverageCandidates(household.id);
  const candidates = rows.map((r) => ({
    ...r,
    amount: r.amount === null ? null : Number(r.amount),
  }));

  const ex = explainMatch(text, candidates);
  if (!ex.ruleId) {
    console.log(`규칙이 문장을 잡지 못했습니다: "${text}"`);
    console.log('키워드가 하나도 매치되지 않은 경우입니다. incident-match.ts 의 keywords 를 확인하세요.');
    return;
  }

  console.log(`문장: "${text}"`);
  console.log(`규칙: ${ex.ruleId}\n`);

  // 직접 해당 → 참고 → 제외 → 대상 아님 순으로, 카테고리 밖은 개수만 요약한다.
  const orderOf: Record<CoverageFate, number> = {
    direct: 0,
    related: 1,
    'cause-mismatch': 2,
    'excluded-name': 3,
    'excluded-kind': 4,
    'excluded-context': 5,
    'excluded-status': 6,
    'out-of-category': 7,
  };
  const inPlay = ex.rows
    .filter((r) => r.fate !== 'out-of-category')
    .sort((a, b) => orderOf[a.fate] - orderOf[b.fate]);
  const outCount = ex.rows.length - inPlay.length;

  for (const r of inPlay) {
    const c = r.candidate;
    console.log(`${FATE_LABEL[r.fate]}  ${c.name}`);
    console.log(
      `    ${c.memberName} · ${c.insurerName} · ${c.productName} · kind=${c.contractKind ?? '-'} · ${c.category}`,
    );
    console.log(`    → ${r.detail}\n`);
  }
  if (outCount > 0) console.log(`(카테고리가 달라 대상이 아닌 담보 ${outCount}건은 생략)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
