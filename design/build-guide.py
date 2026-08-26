"""CI 가이드 페이지 조립.

SVG 를 한 문서에 여러 개 인라인하면 id 가 충돌한다(그라디언트·클립패스가 서로를
덮어써서 마지막 것만 살아남는다). 파일마다 id 에 접두어를 붙여서 넣는다.
"""
import re
from pathlib import Path

CI = Path("design/ci")


COUNTER = {"n": 0}


def inline(name, cls="", extra=""):
    raw = CI.joinpath(f"{name}.svg").read_text(encoding="utf-8")
    # 같은 파일을 두 번 넣어도 id 가 겹치면 안 된다. 호출 순번으로 접두어를 만든다.
    COUNTER["n"] += 1
    tag = f"s{COUNTER['n']}"
    ids = re.findall(r'id="([^"]+)"', raw)
    for i in ids:
        raw = raw.replace(f'id="{i}"', f'id="{tag}-{i}"').replace(f"url(#{i})", f"url(#{tag}-{i})")
    raw = re.sub(r'\swidth="\d+"\s+height="\d+"', "", raw, count=1)
    raw = raw.replace("<svg ", f'<svg class="{cls}" {extra} ', 1)
    return raw


PAGE = Path("design/ci-guide.html")
html = PAGE.read_text(encoding="utf-8")
html = re.sub(r"<!--SVG:(\w[\w-]*)(?::([\w -]*))?-->", lambda m: inline(m.group(1), m.group(2) or ""), html)
Path("design/ci-guide.built.html").write_text(html, encoding="utf-8")
print("built", len(html), "bytes")
