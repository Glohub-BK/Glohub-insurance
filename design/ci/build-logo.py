"""놓칠뻔 CI 조립기.

핵심 아이디어 하나: '뻔' 은 글자가 아니라 식은땀 방울이다.
워드마크에서도 마지막 글자 자리에 방울이 들어앉는다. 그래서 심볼과 워드마크가
같은 형태를 공유하고, 방울만 떼어내도 로고로 읽힌다.
"""
import json
from pathlib import Path

G = json.loads(Path("design/ci/glyphs.json").read_text(encoding="utf-8"))
UPEM = G["upem"]
BOX = {"놓": (46, -192, 1724, 1616), "칠": (58, -182, 1634, 1650), "뻔": (74, -162, 1696, 1644)}

DROP = "M{a}C{a2}"  # placeholder, 아래에서 직접 문자열로 쓴다


def glyph(ch, size, x, y, fill, anchor="center", cls=""):
    """size = em 크기. anchor='center' 면 (x, y) 가 글자 시각 중심,
    'baseline' 이면 x 가 좌측 사이드베어링 기준점, y 가 베이스라인이다."""
    s = size / UPEM
    x0, y0, x1, y1 = BOX[ch]
    if anchor == "center":
        cx = (x0 + x1) / 2 * s
        cy = (-y1 + -y0) / 2 * s
        tx, ty = x - cx, y - cy
    else:
        tx, ty = x, y
    return (
        f'<path d="{G["glyphs"][ch]["d"]}" fill="{fill}"{cls and f" class={chr(34)}{cls}{chr(34)}"} '
        f'transform="translate({tx:.2f} {ty:.2f}) scale({s:.5f})"/>'
    )


def run(text, size, x, y, fill, tracking=-0.03, cls=""):
    """글자를 폰트 어드밴스대로 흘린다. 눈대중으로 x 를 찍으면 자간이 들쭉날쭉해진다."""
    s = size / UPEM
    out, cur = [], x
    for ch in text:
        out.append(glyph(ch, size, cur, y, fill, anchor="baseline", cls=cls))
        cur += G["glyphs"][ch]["adv"] * s + tracking * size
    return "".join(out), cur - tracking * size


DEFS = """  <defs>
    <linearGradient id="d-body" x1="26%" y1="4%" x2="74%" y2="100%">
      <stop offset="0" stop-color="#c8517f"/><stop offset=".52" stop-color="#a32a5e"/><stop offset="1" stop-color="#6f1740"/>
    </linearGradient>
    <radialGradient id="d-spec" cx="34%" cy="26%" r="34%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".78"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="d-rim" cx="62%" cy="86%" r="46%">
      <stop offset="0" stop-color="#ffd7e6" stop-opacity=".5"/><stop offset="1" stop-color="#ffd7e6" stop-opacity="0"/>
    </radialGradient>
    <filter id="d-shadow" x="-45%" y="-25%" width="190%" height="180%">
      <feDropShadow dx="0" dy="9" stdDeviation="9" flood-color="#3c0c24" flood-opacity=".26"/>
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#3c0c24" flood-opacity=".2"/>
    </filter>
    <filter id="d-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
    <clipPath id="d-clip"><path d="M100 12C100 12 172 94 172 144A72 72 0 1 1 28 144C28 94 100 12 100 12Z"/></clipPath>
  </defs>"""

SHAPE = "M100 12C100 12 172 94 172 144A72 72 0 1 1 28 144C28 94 100 12 100 12Z"


def drop(scale=1.0, tx=0.0, ty=0.0, shadow=True, letter=True, letter_fill="#ffffff"):
    """방울 하나. 200x200 좌표계로 그린 뒤 통째로 변환한다."""
    inner = [
        f'<path d="{SHAPE}" fill="url(#d-body)"/>',
        '<g clip-path="url(#d-clip)">',
        '<ellipse cx="118" cy="188" rx="86" ry="52" fill="url(#d-rim)"/>',
        '<ellipse cx="70" cy="66" rx="40" ry="30" fill="url(#d-spec)" filter="url(#d-blur)"/>',
        '<path d="M78 44C64 62 54 80 52 100" stroke="#ffffff" stroke-opacity=".6" stroke-width="9" stroke-linecap="round" fill="none"/>',
        "</g>",
        f'<path d="{SHAPE}" fill="none" stroke="#5c1435" stroke-opacity=".26" stroke-width="2"/>',
    ]
    # 글자는 방울의 시각 중심(둥근 아랫배)에 앉힌다. 도형 중심(y=118)보다 아래다.
    if letter:
        inner.append(glyph("뻔", 96, 100, 146, letter_fill))
    body = "".join(inner)
    g = f'<g filter="url(#d-shadow)">{body}</g>' if shadow else f"<g>{body}</g>"
    return f'<g transform="translate({tx} {ty}) scale({scale})">{g}</g>'


# 글자를 어두운 잉크로만 찍으면 다크 모드 헤더에서 로고가 통째로 사라진다.
# <img> 로 부른 SVG 도 자기 안의 미디어 쿼리는 보므로, 파일이 스스로 테마를 바꾸게 한다.
DARK_STYLE = """  <style>
    @media (prefers-color-scheme: dark) {
      .ink { fill: #f0e7ec; }
      .ground { opacity: .28; }
    }
  </style>"""


def svg(name, w, h, body, label, themed=False):
    style = f"\n{DARK_STYLE}" if themed else ""
    out = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
        f'role="img" aria-label="{label}">\n{DEFS}{style}\n{body}\n</svg>\n'
    )
    Path(f"design/ci/{name}.svg").write_text(out, encoding="utf-8")


# 1) 심볼
svg("mark", 200, 224,
    '  <ellipse cx="100" cy="212" rx="52" ry="8" fill="#3c0c24" opacity=".13"/>\n' + drop(),
    "놓칠뻔 심볼 — 식은땀 방울 안의 뻔")

# 2) 가로 조합 — '놓칠' + 방울(=뻔)
INK = "#2a1119"
# 글자 크기 74, 베이스라인 100. 방울은 글자보다 크게 서서 마지막 음절 자리를 차지한다.
text_h, base = 74, 100
letters, end_x = run("놓칠", text_h, 20, base, INK, cls="ink")
drop_h = 112                      # 글자 상자보다 1.5배. 방울이 로고의 주인공이다.
drop_s = drop_h / 224
drop_x = end_x + 10
drop_y = base + 6 - 218 * drop_s  # 방울 아랫배가 베이스라인보다 살짝 아래로 내려앉는다
w_body = [
    f'  <ellipse class="ground" cx="{drop_x + 100 * drop_s:.1f}" cy="{base + 8:.1f}" rx="{34 * drop_s * 1.6:.1f}" ry="5" fill="#3c0c24" opacity=".12"/>',
    "  " + letters,
    "  " + drop(scale=round(drop_s, 4), tx=round(drop_x, 1), ty=round(drop_y, 1)),
]
svg("logo-horizontal", round(drop_x + 200 * drop_s + 20), 130, "\n".join(w_body), "놓칠뻔 가로형 로고", themed=True)

# 3) 세로 조합
# 세로형은 방울 아래에 이름 세 글자를 다 적는다. 앱 밖(명함·배너)에서 이름을 읽혀야 한다.
st_size = 46
st_w, _ = run("놓칠뻔", st_size, 0, 0, INK)
_, st_end = run("놓칠뻔", st_size, 0, 0, INK)
st_x = (240 - st_end) / 2
line, _ = run("놓칠", st_size, st_x, 216, INK, cls="ink")
last, _ = run("뻔", st_size, st_x + (G["glyphs"]["놓"]["adv"] + G["glyphs"]["칠"]["adv"]) * st_size / UPEM - 0.06 * st_size, 216, "#a32a5e")
s_body = [
    '  <ellipse class="ground" cx="120" cy="158" rx="42" ry="6" fill="#3c0c24" opacity=".12"/>',
    "  " + drop(scale=0.7, tx=50, ty=6),
    "  " + line,
    "  " + last,
]
svg("logo-stacked", 240, 244, "\n".join(s_body), "놓칠뻔 세로형 로고", themed=True)

# 4) 앱 아이콘 — 딥 플럼 바탕에 흰 방울. 홈 화면에서 실루엣만으로 구분되게 한다.
icon = f"""  <defs>
    <linearGradient id="i-bg" x1="18%" y1="0%" x2="82%" y2="100%">
      <stop offset="0" stop-color="#b93a70"/><stop offset="1" stop-color="#6b1740"/>
    </linearGradient>
    <linearGradient id="i-drop" x1="28%" y1="6%" x2="72%" y2="100%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffdcea"/>
    </linearGradient>
    <filter id="i-sh" x="-40%" y="-30%" width="180%" height="180%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#3c0c24" flood-opacity=".45"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="116" fill="url(#i-bg)"/>
  <ellipse cx="256" cy="150" rx="230" ry="150" fill="#ffffff" opacity=".08"/>
  <g filter="url(#i-sh)" transform="translate(88 62) scale(1.68)">
    <path d="{SHAPE}" fill="url(#i-drop)"/>
    {glyph("뻔", 96, 100, 146, "#8c1f4e")}
  </g>"""
svg("app-icon", 512, 512, icon, "놓칠뻔 앱 아이콘")

# 4-b) 마스커블 — 안드로이드는 아이콘을 원·둥근사각 등으로 잘라낸다.
# 가장자리 20% 는 잘려나간다고 보고 방울을 안전영역(가운데 80%) 안에 넣는다.
icon_mask = icon.replace('rx="116"', 'rx="0"').replace(
    'transform="translate(88 62) scale(1.68)"', 'transform="translate(128 108) scale(1.28)"'
)
svg("app-icon-maskable", 512, 512, icon_mask, "놓칠뻔 앱 아이콘 (마스커블)")

# 5) 단색 — 인쇄·워터마크·1색 실크 인쇄용
mono = f"""  <path d="{SHAPE}" fill="#2a1119" transform="translate(0 6)"/>
  <g transform="translate(0 6)">{glyph("뻔", 96, 100, 146, "#ffffff")}</g>"""
svg("mark-mono", 200, 224, mono, "놓칠뻔 심볼 단색")

print("built: mark, logo-horizontal, logo-stacked, app-icon, mark-mono")
