"""뻐니 마스코트 SVG 생성기.

한 벌의 몸체에 표정만 갈아끼운다. 손으로 3개를 각각 쓰면 눈 위치가 미세하게
어긋나고, 그 어긋남이 마스코트를 싸구려로 보이게 한다.
"""
from pathlib import Path

DEFS = """  <defs>
    <linearGradient id="b-body" x1="24%" y1="6%" x2="76%" y2="100%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".55" stop-color="#fdeef4"/>
      <stop offset="1" stop-color="#f4d7e3"/>
    </linearGradient>
    <linearGradient id="b-drop" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0" stop-color="#c8517f"/>
      <stop offset=".5" stop-color="#a32a5e"/>
      <stop offset="1" stop-color="#6f1740"/>
    </linearGradient>
    <radialGradient id="b-spec" cx="34%" cy="26%" r="36%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="b-cheek" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#f08bb0" stop-opacity=".55"/>
      <stop offset="1" stop-color="#f08bb0" stop-opacity="0"/>
    </radialGradient>
    <filter id="b-shadow" x="-40%" y="-30%" width="180%" height="180%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#3c0c24" flood-opacity=".26"/>
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#3c0c24" flood-opacity=".18"/>
    </filter>
    <filter id="b-soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
    <clipPath id="b-clip">
      <path d="M110 26C110 26 176 96 176 140A66 66 0 0 1 44 140C44 96 110 26 110 26Z"/>
    </clipPath>
  </defs>"""

ARMS_DEFAULT = """  <!-- 팔: 몸 뒤에서 나온다. 순서가 바뀌면 붙인 것처럼 보인다. -->
  <g stroke="#d59fb7" stroke-width="9" stroke-linecap="round" fill="none">
    <path d="M56 168C44 176 40 184 42 190"/>
    <path d="M164 168C176 176 180 184 178 190"/>
  </g>"""

# 허리에 손: 자신감. 팔이 몸 쪽으로 꺾여 들어와야 '포즈'로 읽힌다.
ARMS_HIPS = """  <g stroke="#d59fb7" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M54 158C36 164 30 176 44 186"/>
    <path d="M166 158C184 164 190 176 176 186"/>
  </g>"""

# 손 흔들기 — 오른팔만 위로. 양팔을 다 들면 만세(cheer)와 구분되지 않는다.
ARMS_WAVE = """  <g stroke="#d59fb7" stroke-width="9" stroke-linecap="round" fill="none">
    <path d="M56 168C44 176 40 184 42 190"/>
    <path d="M164 160C180 148 186 134 184 122"/>
  </g>"""

# 만세 — 양팔을 벌려 올린다.
ARMS_UP = """  <g stroke="#d59fb7" stroke-width="9" stroke-linecap="round" fill="none">
    <path d="M56 160C40 148 34 134 36 122"/>
    <path d="M164 160C180 148 186 134 184 122"/>
  </g>"""

# 물건 들기 — 오른팔을 앞으로 뻗는다. 소품은 오른손 끝(186,148) 근처.
# 왼쪽은 비워둔다. 그 자리는 식은땀 방울의 자리다.
ARMS_HOLD = """  <g stroke="#d59fb7" stroke-width="9" stroke-linecap="round" fill="none">
    <path d="M56 168C44 176 40 184 42 190"/>
    <path d="M162 162C176 160 184 154 186 148"/>
  </g>"""

# 턱 괴기 — 오른팔을 얼굴 쪽으로 접는다.
ARMS_CHIN = """  <g stroke="#d59fb7" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M56 168C44 176 40 184 42 190"/>
    <path d="M170 170C184 158 172 144 152 150"/>
  </g>"""

ARMS = {
    "default": None,  # 아래에서 ARMS_DEFAULT 로 채운다
    "hips": None,
    "wave": None,
    "up": None,
    "hold": None,
    "chin": None,
}

BODY = """  <ellipse cx="110" cy="212" rx="54" ry="9" fill="#3c0c24" opacity=".13"/>
{arms}

  <g filter="url(#b-shadow)">
    <path d="M110 26C110 26 176 96 176 140A66 66 0 0 1 44 140C44 96 110 26 110 26Z" fill="url(#b-body)"/>
    <g clip-path="url(#b-clip)">
      <ellipse cx="80" cy="74" rx="34" ry="26" fill="url(#b-spec)" filter="url(#b-soft)"/>
      <ellipse cx="130" cy="188" rx="80" ry="46" fill="#e9bccf" opacity=".5"/>
    </g>
    <path d="M110 26C110 26 176 96 176 140A66 66 0 0 1 44 140C44 96 110 26 110 26Z" fill="none" stroke="#a32a5e" stroke-opacity=".35" stroke-width="2.5"/>
  </g>

  <ellipse cx="72" cy="152" rx="13" ry="8" fill="url(#b-cheek)"/>
  <ellipse cx="148" cy="152" rx="13" ry="8" fill="url(#b-cheek)"/>"""

SWEAT = """  <!-- 식은땀: 이 캐릭터의 정체다. 항상 왼쪽 관자놀이에서 하나만 흐른다. -->
  <g transform="translate(38 96) scale(.42)">
    <path d="M40 0C40 0 76 42 76 66A36 36 0 0 1 4 66C4 42 40 0 40 0Z" fill="url(#b-drop)"/>
    <ellipse cx="27" cy="52" rx="10" ry="8" fill="#ffffff" opacity=".55"/>
  </g>"""

ARMS.update(
    default=ARMS_DEFAULT, hips=ARMS_HIPS, wave=ARMS_WAVE, up=ARMS_UP, hold=ARMS_HOLD, chin=ARMS_CHIN
)

# ── 얼굴 부품 ──────────────────────────────────────────────────
# 눈·눈썹·입을 조합으로 쓴다. 포즈마다 새로 그리면 얼굴이 조금씩 달라지고,
# 그 미세한 차이가 "같은 캐릭터"라는 느낌을 깨뜨린다.
EYES_DOT = """  <ellipse cx="88" cy="130" rx="11" ry="12" fill="#3c0c24"/>
  <ellipse cx="132" cy="130" rx="11" ry="12" fill="#3c0c24"/>
  <circle cx="92" cy="125" r="4.2" fill="#ffffff"/>
  <circle cx="136" cy="125" r="4.2" fill="#ffffff"/>"""

EYES_HAPPY = """  <path d="M74 132q14-14 28 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M118 132q14-14 28 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>"""

EYES_CLOSED = """  <path d="M76 130q12 12 24 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M120 130q12 12 24 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>"""

# 위를 보는 눈 — 동공을 위로 올린다. 생각하는 표정의 핵심이다.
EYES_UP = """  <ellipse cx="88" cy="130" rx="11" ry="12" fill="#3c0c24"/>
  <ellipse cx="132" cy="130" rx="11" ry="12" fill="#3c0c24"/>
  <circle cx="90" cy="122" r="4.2" fill="#ffffff"/>
  <circle cx="134" cy="122" r="4.2" fill="#ffffff"/>"""

BROW_WORRY = """  <path d="M72 110q14-8 28-2" stroke="#3c0c24" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M148 110q-14-8-28-2" stroke="#3c0c24" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" fill="none"/>"""

BROW_RAISE = """  <path d="M70 106q16-12 32-4" stroke="#3c0c24" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M150 106q-16-12-32-4" stroke="#3c0c24" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" fill="none"/>"""

MOUTH_SMILE = """  <path d="M92 158q18 16 36 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>"""
MOUTH_SMALL = """  <ellipse cx="110" cy="158" rx="7" ry="8" fill="#3c0c24"/>"""
MOUTH_OPEN = """  <path d="M88 154q22 26 44 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M88 154q22 6 44 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>"""
# 아쉬움 — 살짝 내려간 입. 우는 얼굴은 만들지 않는다(브랜드 규칙).
MOUTH_SORRY = """  <path d="M94 164q16-12 32 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>"""

FACES = {
    "relief": {
        "label": "휴… (기본)",
        "svg": """  <!-- 눈: 안도. 아래로 살짝 감은 곡선 -->
  <path d="M76 128q12 12 24 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M120 128q12 12 24 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M72 108q14-7 28-2" stroke="#3c0c24" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M148 108q-14-7-28-2" stroke="#3c0c24" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" fill="none"/>
  <ellipse cx="110" cy="152" rx="9" ry="11" fill="#3c0c24"/>""",
    },
    "alert": {
        "label": "어? (놓칠 뻔한 순간)",
        "svg": """  <ellipse cx="88" cy="130" rx="12" ry="14" fill="#3c0c24"/>
  <ellipse cx="132" cy="130" rx="12" ry="14" fill="#3c0c24"/>
  <circle cx="84" cy="125" r="4" fill="#ffffff"/>
  <circle cx="128" cy="125" r="4" fill="#ffffff"/>
  <path d="M72 104q16-10 30-3" stroke="#3c0c24" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M148 104q-16-10-30-3" stroke="#3c0c24" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" fill="none"/>
  <ellipse cx="110" cy="158" rx="11" ry="13" fill="#3c0c24"/>""",
    },
    "confident": {
        "label": "맡겨줘 (첫 화면)",
        "arms": "hips",
        "svg": """  <!-- 눈: 위로 살짝 치켜뜬 자신감. 흰 점을 크게 넣어 또렷하게 만든다. -->
  <ellipse cx="88" cy="128" rx="11" ry="12" fill="#3c0c24"/>
  <ellipse cx="132" cy="128" rx="11" ry="12" fill="#3c0c24"/>
  <circle cx="92" cy="123" r="4.2" fill="#ffffff"/>
  <circle cx="136" cy="123" r="4.2" fill="#ffffff"/>
  <path d="M70 106q16-12 32-4" stroke="#3c0c24" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M150 106q-16-12-32-4" stroke="#3c0c24" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M90 156q20 18 40 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>
  <!-- 반짝임: 자신감의 신호. 땀방울 반대편에 둬서 둘이 겹치지 않는다. -->
  <path d="M182 78l4 11 11 4-11 4-4 11-4-11-11-4 11-4z" fill="#a32a5e" opacity=".85"/>""",
    },

    # ── 감정·행동 10종 (2026-08-23 추가) ─────────────────────────
    "greet": {
        "label": "안녕하세요 (첫 방문·온보딩)",
        "arms": "wave",
        "svg": EYES_HAPPY + "\n" + MOUTH_SMILE,
        "prop": """  <g stroke="#e3b3c8" stroke-width="5" stroke-linecap="round" fill="none">
    <path d="M196 116q7-3 11-9"/>
    <path d="M190 104q8-1 14-6"/>
  </g>""",
    },
    "thinking": {
        "label": "살펴보는 중 (진단)",
        "arms": "chin",
        "svg": EYES_UP + "\n" + BROW_RAISE + "\n" + MOUTH_SMALL,
        "prop": """  <text x="28" y="70" font-family="Pretendard, sans-serif" font-size="42" font-weight="800" fill="#a32a5e" opacity=".9">?</text>""",
    },
    "search": {
        "label": "뒤지는 중 (조회)",
        "arms": "hold",
        "svg": EYES_DOT + "\n" + BROW_RAISE + "\n" + MOUTH_SMALL,
        "prop": """  <!-- 돋보기: 손끝(34,148)에서 시작한다. 손과 떨어지면 떠 있는 소품이 된다. -->
  <g transform="translate(158 112)">
    <circle cx="26" cy="26" r="19" fill="#ffffff" fill-opacity=".85" stroke="#a32a5e" stroke-width="6"/>
    <path d="M12 40L-1 53" stroke="#7e1e48" stroke-width="7" stroke-linecap="round"/>
    <path d="M18 18a12 12 0 0 1 9-4" stroke="#ffffff" stroke-width="4" stroke-linecap="round" fill="none"/>
  </g>""",
    },
    "phone": {
        "label": "인증 기다리는 중 (2-way)",
        "arms": "hold",
        "svg": EYES_DOT + "\n" + BROW_WORRY + "\n" + MOUTH_SMALL,
        "prop": """  <g transform="translate(166 114)">
    <rect x="0" y="0" width="34" height="52" rx="8" fill="#7e1e48"/>
    <rect x="4" y="7" width="26" height="38" rx="4" fill="#fdeef4"/>
    <circle cx="17" cy="49" r="2.4" fill="#fdeef4"/>
    <path d="M10 26h14M10 33h9" stroke="#c8517f" stroke-width="3" stroke-linecap="round"/>
  </g>""",
    },
    "sync": {
        "label": "동기화 중",
        "arms": "default",
        "svg": EYES_CLOSED + "\n" + MOUTH_SMILE,
        "prop": """  <!-- 회전 화살표. 머리 위에 둬서 '진행 중'을 몸짓 없이 알린다. -->
  <g transform="translate(150 44)">
    <path d="M30 8a17 17 0 1 0 15 9" stroke="#a32a5e" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M46 2l1 16-16-2z" fill="#a32a5e"/>
  </g>""",
    },
    "doc": {
        "label": "서류 안내 (청구 준비)",
        "arms": "hold",
        "svg": EYES_HAPPY + "\n" + MOUTH_SMILE,
        "prop": """  <g transform="translate(160 110)">
    <rect x="0" y="0" width="40" height="52" rx="6" fill="#ffffff" stroke="#a32a5e" stroke-width="5"/>
    <path d="M10 16h20M10 26h20M10 36h12" stroke="#c8517f" stroke-width="4" stroke-linecap="round"/>
  </g>""",
    },
    "clock": {
        "label": "기한 임박 (소멸시효 3년)",
        "arms": "hold",
        "svg": EYES_DOT + "\n" + BROW_WORRY + "\n" + MOUTH_SMALL,
        "prop": """  <g transform="translate(156 112)">
    <circle cx="26" cy="26" r="22" fill="#ffffff" stroke="#b03a16" stroke-width="6"/>
    <path d="M26 12v15l10 7" stroke="#b03a16" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>""",
    },
    "shield": {
        "label": "안전 안내 (개인정보)",
        "arms": "hold",
        "svg": EYES_HAPPY + "\n" + MOUTH_SMILE,
        "prop": """  <g transform="translate(160 110)">
    <path d="M24 0l22 9v18c0 13-9 23-22 27C11 50 2 40 2 27V9z" fill="url(#b-drop)"/>
    <path d="M14 26l7 7 13-14" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>""",
    },
    "sorry": {
        "label": "못 찾았어요 (담보 없음)",
        "arms": "default",
        "svg": EYES_CLOSED + "\n" + BROW_WORRY + "\n" + MOUTH_SORRY,
        "prop": "",
    },
    "cheer": {
        "label": "축하 (연결·청구 완료)",
        "arms": "up",
        "svg": EYES_HAPPY + "\n" + MOUTH_OPEN,
        "prop": """  <!-- 색종이. 축하는 표정만으로 부족하다. -->
  <g opacity=".9">
    <rect x="30" y="34" width="9" height="9" rx="2" fill="#a32a5e" transform="rotate(-20 34 38)"/>
    <rect x="176" y="46" width="9" height="9" rx="2" fill="#c8517f" transform="rotate(24 180 50)"/>
    <rect x="96" y="16" width="9" height="9" rx="2" fill="#e08bb0" transform="rotate(12 100 20)"/>
    <circle cx="60" cy="20" r="4.5" fill="#c8517f"/>
    <circle cx="158" cy="22" r="4" fill="#a32a5e"/>
  </g>""",
    },
    "found": {
        "label": "찾았다 (진단 완료)",
        "svg": """  <path d="M74 124q14-14 28 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M118 124q14-14 28 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M88 156q22 20 44 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M88 156q22 6 44 0" stroke="#3c0c24" stroke-width="7" stroke-linecap="round" fill="none"/>""",
    },
}

out = Path(__file__).parent
for key, face in FACES.items():
    if key == "found":
        # 땀이 날아간다. 튄 자국까지 있어야 '방금 해결됐다'로 읽힌다.
        sweat = SWEAT.replace('translate(38 96) scale(.42)', 'translate(26 62) scale(.34) rotate(-24 40 66)')
        sweat += '\n  <path d="M52 92q-8 8-12 18" stroke="#c98fa9" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>'
    else:
        sweat = SWEAT
    variant = face.get("arms", "default")
    # 올리거나 뻗은 팔은 몸 앞에 그린다. 뒤에 두면 몸통에 가려 아예 보이지 않는다.
    front = variant in {"wave", "up", "hold", "chin"}
    body = BODY.replace("{arms}", "" if front else ARMS[variant])
    if front:
        body += "\n" + ARMS[variant]
    prop = face.get("prop", "")
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 224" width="220" height="224" role="img" aria-label="놓칠뻔 마스코트 뻐니 — {face['label']}">
{DEFS}
{body}
{sweat}
{face['svg']}
{prop}
</svg>
"""
    (out / f"mascot-{key}.svg").write_text(svg, encoding="utf-8")
print("wrote", ", ".join(f"mascot-{k}.svg" for k in FACES))
