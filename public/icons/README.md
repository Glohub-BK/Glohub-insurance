# 앱 아이콘 (자동 생성)

`node design/ci/render-icons.mjs` 로 만든다. 직접 편집하지 않는다.

- `icon-192.png` 192px ← `design/ci/app-icon.svg`
- `icon-512.png` 512px ← `design/ci/app-icon.svg`
- `apple-touch-icon.png` 180px ← `design/ci/app-icon.svg`
- `maskable-192.png` 192px ← `design/ci/app-icon-maskable.svg`
- `maskable-512.png` 512px ← `design/ci/app-icon-maskable.svg`

마스커블은 안드로이드가 잘라내는 가장자리 20% 를 고려해 방울을 안전영역 안에 넣은 버전이다.
