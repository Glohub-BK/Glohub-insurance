/**
 * 약관 PDF 하나를 읽어 추출·파싱이 어떻게 됐는지 눈으로 본다.
 *
 *   npm run terms:inspect -- 파일경로.pdf
 *
 * "조항이 15개밖에 안 잡힌다" 같은 문제를 서버에 올리지 않고 진단하는 도구다.
 */
import { readFileSync } from 'node:fs';
import { extractPdfText } from '../src/lib/terms/pdf';
import { parseClauses } from '../src/lib/terms/parse';

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.log('사용법: npm run terms:inspect -- 파일경로.pdf');
    return;
  }
  const bytes = new Uint8Array(readFileSync(path));
  console.log(`파일 ${path} · ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB`);

  const text = await extractPdfText(bytes);
  const lines = text.split('\n');
  const headerLines = lines.filter((l) => /^제\s*\d+\s*조/.test(l.trim()));
  console.log(`추출 글자 ${text.length.toLocaleString()} · 줄 ${lines.length.toLocaleString()}`);
  console.log(`줄 맨 앞 「제N조」 패턴: ${headerLines.length}건`);
  // 줄 중간에 숨은 조항 머리 — hasEOL 이 없어 한 줄로 뭉친 경우를 가려낸다.
  const inline = (text.match(/제\s*\d+\s*조\s*[(（]/g) ?? []).length;
  console.log(`본문 어디든 「제N조(」 패턴: ${inline}건`);

  const clauses = parseClauses(text);
  console.log(`파싱된 조항: ${clauses.length}건`);
  for (const c of clauses.slice(0, 10)) {
    console.log(`  ${c.articleLabel} ${c.title ?? ''} — ${c.body.slice(0, 40)}…`);
  }
  if (clauses.length > 10) console.log(`  … 외 ${clauses.length - 10}건`);
  // 줄 길이 분포 — 평균이 수백 자면 hasEOL 이 거의 없다는 뜻이다.
  const avg = lines.reduce((n, l) => n + l.length, 0) / Math.max(1, lines.length);
  console.log(`평균 줄 길이 ${avg.toFixed(0)}자 ${avg > 200 ? '⚠ 줄바꿈이 거의 없음 — 파서가 조항 머리를 놓친다' : ''}`);
}

void main();
