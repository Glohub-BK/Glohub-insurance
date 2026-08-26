import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../src/app/manifest';

/**
 * PWA 설정은 눈으로 확인하기 어렵다(설치해봐야 안다). 규칙만 테스트로 고정한다.
 */
describe('웹 매니페스트', () => {
  const m = manifest();

  it('설치 이름과 시작 경로가 있다', () => {
    expect(m.short_name).toBe('놓칠뻔');
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
  });

  it('테마색은 브랜드 플럼이다', () => {
    expect(m.theme_color).toBe('#a32a5e');
  });

  it('마스커블 아이콘이 192·512 둘 다 있다 — 안드로이드가 아이콘을 잘라낸다', () => {
    const maskable = (m.icons ?? []).filter((i) => i.purpose === 'maskable');
    expect(maskable.map((i) => i.sizes).sort()).toEqual(['192x192', '512x512']);
  });
});

describe('서비스 워커', () => {
  const sw = readFileSync('public/sw.js', 'utf8');

  it('API 응답은 캐시하지 않는다 — 캐시된 응답이 재생되면 인증 흐름이 깨진다', () => {
    expect(sw).toContain("url.pathname.startsWith('/api/')");
  });

  it('화면 이동은 네트워크 우선이다 — 오래된 보장내역을 최신처럼 보여주면 안 된다', () => {
    expect(sw).toMatch(/request\.mode === 'navigate'[\s\S]*fetch\(request\)\.catch/);
  });

  it('캐시 이름에 버전이 들어간다 — 갱신 시 예전 캐시를 지울 수 있어야 한다', () => {
    expect(sw).toMatch(/nochilppeon-shell-\$\{VERSION\}/);
  });
});
