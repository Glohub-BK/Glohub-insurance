"""로고에 쓰는 글자를 Pretendard 아웃라인 패스로 뽑는다.

SVG 안에서 font-family 로 지정하면 그 폰트가 없는 환경(타사 뷰어, 인쇄소, 앱스토어
심사 캡처)에서 다른 글자체로 대체된다. CI 는 그런 일이 있으면 안 되므로 패스로 고정한다.
"""
import json, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

FONT = Path("node_modules/pretendard/dist/public/static/Pretendard-ExtraBold.otf")
CHARS = "놓칠뻔"

font = TTFont(FONT)
upem = font["head"].unitsPerEm
cmap = font.getBestCmap()
gs = font.getGlyphSet()
hmtx = font["hmtx"]

out = {"upem": upem, "glyphs": {}}
for ch in CHARS:
    name = cmap[ord(ch)]
    pen = SVGPathPen(gs)
    # y 축을 뒤집어 SVG 좌표계로 옮긴다. 폰트는 위가 +y, SVG 는 아래가 +y.
    gs[name].draw(TransformPen(pen, Transform(1, 0, 0, -1, 0, 0)))
    out["glyphs"][ch] = {"d": pen.getCommands(), "adv": hmtx[name][0]}

Path("design/ci/glyphs.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print("upem", upem, {c: out["glyphs"][c]["adv"] for c in CHARS}, "path len", {c: len(out["glyphs"][c]["d"]) for c in CHARS})
