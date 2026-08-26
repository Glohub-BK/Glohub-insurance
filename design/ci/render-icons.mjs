/**
 * SVG 원본 → PNG 아이콘 생성.
 *
 * 스토어와 홈 화면 아이콘은 PNG 만 받는다. SVG 를 손으로 내보내면 매번 크기·여백이
 * 달라지므로 스크립트로 고정한다. 실행에는 playwright 가 필요하다:
 *   npx playwright install chromium && node design/ci/render-icons.mjs
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(ROOT, 'public/icons');

const JOBS = [
  { src: 'app-icon.svg', out: 'icon-192.png', size: 192 },
  { src: 'app-icon.svg', out: 'icon-512.png', size: 512 },
  { src: 'app-icon.svg', out: 'apple-touch-icon.png', size: 180 },
  { src: 'app-icon-maskable.svg', out: 'maskable-192.png', size: 192 },
  { src: 'app-icon-maskable.svg', out: 'maskable-512.png', size: 512 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
await mkdir(OUT, { recursive: true });

for (const job of JOBS) {
  const svg = await readFile(resolve(ROOT, 'design/ci', job.src), 'utf8');
  const page = await browser.newPage({ viewport: { width: job.size, height: job.size } });
  // 배경을 투명하게 두면 iOS 가 검게 채운다. 아이콘 자체가 불투명이라 문제없다.
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${job.size}px;height:${job.size}px}</style>${svg}`,
  );
  await page.locator('svg').screenshot({ path: resolve(OUT, job.out), omitBackground: true });
  await page.close();
  console.log('wrote', job.out, `${job.size}px`);
}

await browser.close();

// 사용처를 기록해 둔다. 파일만 남으면 나중에 왜 5개인지 알 수 없다.
await writeFile(
  resolve(OUT, 'README.md'),
  `# 앱 아이콘 (자동 생성)\n\n\`node design/ci/render-icons.mjs\` 로 만든다. 직접 편집하지 않는다.\n\n` +
    JOBS.map((j) => `- \`${j.out}\` ${j.size}px ← \`design/ci/${j.src}\``).join('\n') +
    `\n\n마스커블은 안드로이드가 잘라내는 가장자리 20% 를 고려해 방울을 안전영역 안에 넣은 버전이다.\n`,
  'utf8',
);
console.log('wrote README.md');
void dirname;
