import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 로고 글자를 어두운 잉크로만 찍으면 다크 모드 헤더에서 로고가 통째로 사라진다.
 * 한 번 겪은 뒤에는 파일 자체가 테마를 따라가게 고쳤으니, 그 장치가 빠지지 않게 잠근다.
 */
const THEMED = ['logo-horizontal', 'logo-stacked'];

describe('로고 자산의 다크 모드', () => {
  for (const name of THEMED) {
    for (const dir of ['design/ci', 'public/brand']) {
      it(`${dir}/${name}.svg 가 스스로 테마를 바꾼다`, () => {
        const svg = readFileSync(`${dir}/${name}.svg`, 'utf8');
        expect(svg).toContain('prefers-color-scheme: dark');
        expect(svg).toContain('.ink { fill: #f0e7ec; }');
        // 미디어 쿼리가 붙을 대상이 실제로 있어야 의미가 있다.
        expect(svg).toContain('class="ink"');
      });
    }
  }

  it('public/brand 사본이 design/ci 원본과 같다 — 빌드 후 복사를 잊지 않게', () => {
    for (const name of THEMED) {
      expect(readFileSync(`public/brand/${name}.svg`, 'utf8')).toBe(
        readFileSync(`design/ci/${name}.svg`, 'utf8'),
      );
    }
  });
});

describe('AI 결과 플래그십', () => {
  const CSS = readFileSync('src/app/globals.css', 'utf8');

  it('전용 토큰이 라이트·다크 양쪽에 정의돼 있다', () => {
    for (const token of ['--flag-border', '--flag-num', '--flag-quote']) {
      // 라이트(:root)와 다크(prefers-color-scheme) 두 번씩 나와야 한다.
      const count = CSS.split(token).length - 1;
      // 정의 2회 + 사용 1회 이상
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('플래그십 장치가 다른 화면으로 새지 않는다 — /ai 에서만 쓴다', () => {
    const ai = readFileSync('src/app/ai/claim-search.tsx', 'utf8');
    expect(ai).toContain('aihero');
    expect(ai).toContain('glowcard');
    for (const file of ['src/app/page.tsx', 'src/app/coverage/page.tsx', 'src/app/profile/page.tsx']) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toContain('aihero');
      expect(src).not.toContain('glowcard');
    }
  });

  it('한도 합계에 "실제로 받는 금액이 아니다" 를 반드시 붙인다 — 손해사정업 경계', () => {
    const ai = readFileSync('src/app/ai/claim-search.tsx', 'utf8');
    expect(ai).toContain('약관상 한도 합계');
    expect(ai).toContain('실제로 받는 금액이 아닙니다');
  });
});
