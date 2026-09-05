# 놓칠뻔

> 우리집 보험, 놓치지 않게.

가입한 보험을 한곳에 모아 보고, 사고가 났을 때 **어떤 보험이 그 사고에 적용되는지** 판단해
청구를 놓치지 않게 하는 도구.

> 보험을 추천하거나 비교하는 서비스가 아니다. 보험금을 산정하거나 청구를 대행하지도 않는다.
> 최종 지급 여부와 금액은 보험사 심사로 결정된다.

## 빠른 시작

```bash
npm install
cp .env.example .env.local        # DATABASE_URL 확인
npm run db:up                     # Docker Postgres (localhost:5433)
npm run db:migrate
npm run db:seed                   # 예시 데이터 — 화면 확인용
npm run dev
```

> ⚠ `.env.local` 은 **`package.json` 과 같은 폴더**에 있어야 합니다.
> 상위 폴더에 두면 아무것도 읽히지 않고 `DATABASE_URL 이 설정되지 않았습니다` 가 납니다.

## Supabase 로 옮기기

```bash
npm run db:supabase-sql   # db/supabase-bootstrap.sql 생성
```

생성된 파일을 Supabase 대시보드 → **SQL Editor** 에 통째로 붙여넣고 Run 하면
테이블·뷰·RLS 가 한 번에 올라갑니다. 그다음 `.env.local` 의 `DATABASE_URL` 을
Supabase 연결 문자열로 바꾸면 됩니다.

**SQL 을 대시보드에서 직접 돌렸다면 이력을 먼저 맞춰야 합니다.**

```bash
npm run db:baseline   # 실행하지 않고 "이미 적용됨"으로만 기록
npm run db:migrate    # → 변경 없음 — 이미 최신입니다.
```

`db:baseline` 없이 `db:migrate` 를 돌리면 0001 부터 다시 실행하려다
`relation "household" already exists` 로 죽습니다. 스키마는 있는데 이 스크립트가
그걸 모르기 때문입니다. (`supabase-bootstrap.sql` 로 올렸다면 이력이 함께 기록되므로
baseline 이 필요 없습니다.)

RLS 를 켜면 `member_account` 매핑이 있는 사용자만 데이터를 봅니다. 로그인(S6)을
붙이기 전에는 대시보드(service_role)로만 조회되는 것이 정상입니다.

`http://localhost:3000` 에서 대시보드를 볼 수 있다.

## 구조

```
db/migrations/     순수 SQL 마이그레이션. 로컬 Postgres → Supabase 이전이 그대로 된다
  0001_init.sql          테이블
  0002_views.sql         대시보드용 뷰 (보장 맵, 동기화 상태, 계약 요약)
  0003_rls_supabase.sql  RLS — Supabase 로 옮길 때만 적용 (`npm run db:migrate -- --all`)

src/lib/codef/     CODEF 커넥터
  client.ts        토큰 캐싱, RSA 비밀번호 암호화, 2-way 추가인증 상태 처리
  normalize.ts     응답 → 도메인 모델. 마스킹·잘린 값·종신 같은 실제 데이터 형태를 흡수한다
  types.ts         응답 타입 (개발가이드 2025-11-06 기준)

src/lib/domain/
  coverage-category.ts   담보명 → 보장 카테고리 규칙 분류
  incident-match.ts      사고 서술 → 적용 가능 담보 매칭 (AI 청구 코칭의 규칙 엔진)
src/lib/repo/      DB 저장·조회
src/app/           화면 (모바일 우선, 떠 있는 탭바)
  page.tsx         홈 — 최상단이 배너가 아니라 실제 입력창(HomeHero)
  ai/              AI 청구 코칭 (?q= 로 홈에서 바로 진입)
  coverage/        보장 맵 + 계약 목록
  family/          가족 목록 · family/add 3단계 추가 플로우
  profile/         프로필 — 설정이 아니라 "내 정보를 어떻게 다루는지" 보여주는 화면
  fonts.ts         Pretendard 자체 호스팅
  globals.css      디자인 토큰 (그린 팔레트 + 3단 그림자 입체 스케일)
```

## 데이터 수집 설계

**조회는 가끔, 데이터는 항상.**

내보험다보여는 과도한 호출 시 IP 를 차단한다. CODEF 데모 버전도 1개월·일 100건 제한이 있다.
그래서 이 앱은 **주기적 폴링을 하지 않는다.** 구성원이 직접 동기화를 실행할 때만 한 번 조회하고,
결과를 `sync_run.raw_snapshot` 에 원본째 남긴 뒤 `policy` / `coverage` 로 정규화해 저장한다.
이후 모든 화면은 저장된 스냅샷을 읽는다.

계약은 **upsert** 한다. 이번 응답에 없는 기존 계약을 지우지 않는다 — 대상기관이 일시적으로 일부를
누락하는 경우가 있어서다. `last_seen_run_id` 가 갱신되지 않는 것으로 "이번엔 안 보였다"를 표현한다.

### 계약 동일성

내보험다보여는 회사명과 증권번호를 마스킹해서 내려준다 (`**손해보험`, `201623******`).
자연키를 쓸 수 없으므로 확보 가능한 필드를 이어붙여 해시한 `identity_key` 로 동일성을 판단한다.
`src/lib/codef/normalize.ts` 의 `buildIdentityKey` 참고.

## 환경

| 플랜 | 데이터 | 한도 | 도메인 |
|---|---|---|---|
| 샌드박스 | 고정 더미 응답 | 무제한 | `sandbox.codef.io` |
| 데모버전 | 실제 스크래핑 데이터 | 1개월 · 일 100건 | `development.codef.io` |
| 정식버전 | 실제 데이터 | 무제한 (별도 상담) | `api.codef.io` |

`CODEF_ENV` 는 `sandbox` / `demo` / `api` 셋 중 하나이며 **반드시 명시**해야 한다 —
비워 두면 조회를 거부한다(예전처럼 조용히 샌드박스로 붙지 않는다).
데모버전은 도메인이 `development.codef.io` 라서 `CODEF_ENV=development` 라고 적는 실수가
잦다. 같은 환경이므로 그 표기도 `demo` 로 읽는다.

**개발은 샌드박스로 끝내고, 데모 키는 마지막에 켠다** — 켜는 순간 1개월 시계가 돌기 시작한다.

## 보안

- 주민번호·비밀번호 등 고유식별정보는 **저장하지 않는다.** 인증 통과용으로 전달만 하고 폐기한다.
- 비밀번호는 `encryptPassword` 안에서 즉시 RSA 암호화되며 평문이 함수 밖으로 나가지 않는다.
- `.env.local` 은 커밋하지 않는다.

## 검증

```bash
npm run typecheck
npm run lint
npm test          # 117개
npm run build
```

## 디자인 규칙 — 딥 플럼

- 배경 순백 고정. 플럼 `#A32A5E` 는 면·버튼·아이콘에만, 텍스트는 `#7E1E48`.
- **경고색은 번트오렌지** `#B03A16`. 플럼과 빨강은 색상 거리가 가까워 구분이 안 된다.
- **모든 카드는 3단 그림자로 띄운다.** `--e1`(기본) `--e2`(누를 수 있는 것) `--e3`(떠 있는 것)
  `--e-brand`(브랜드 CTA) `--e-dock`(떠 있는 탭바, 그림자 방향 반전).
  그림자 색은 검정이 아니라 어두운 플럼 `rgba(60,12,36,…)`.
- **탭바는 바닥에 붙지 않는다.** 사방 14px 띄운 반투명 유리(`backdrop-filter: blur(20px) saturate(1.8)`).
  가운데 AI 버튼은 바 밖으로 돌출시키고 헤일로를 둘러 유리판을 뚫고 나온 것처럼 만든다.
- 본문 16px, **최소 14px** — 탭 라벨도 예외 없다.
- 터치 타깃 버튼 52px, 탭바 72px, 칩 38px + 간격 8px.
- 아이콘은 이모지가 아니라 선형 SVG (`ICONS` in `src/app/_components/ui.tsx`).

CSS 특이도 주의: `.tabdock a`(0,1,1)가 `.dock-fab`(0,1,0)을 이긴다. FAB 규칙은 반드시
`.tabdock .dock-fab` 으로 쓴다. 이걸 놓치면 원이 타원이 된다.

## AI 청구 코칭

지금은 **전부 규칙 기반**이다 (`src/lib/domain/incident-match.ts`). 사고 유형 6종을 키워드로
분류하고, 그 유형에 해당하는 카테고리의 담보를 보유 계약에서 찾아 약관 조항과 함께 보여준다.
LLM 은 나중에 규칙이 못 잡은 문장을 넘겨받는 자리에 붙인다 — 규칙을 먼저 태우는 순서를 유지한다.

**금액을 계산하지 않는다.** 약관에 적힌 한도만 옮기고, 청구를 대신 접수하지 않는다.

## 배포 (Vercel)

레포를 Vercel 에 연결하면 `git push` 만으로 배포된다. 별도 배포 명령은 없다.

```
main 브랜치 push  →  Vercel 이 npm run build  →  프로덕션 반영
그 외 브랜치 push →  미리보기 URL 생성
```

### 처음 한 번만

1. **Vercel 에서 GitHub 저장소 Import** — 프레임워크는 Next.js 로 자동 인식된다.
   빌드 명령·출력 폴더는 손대지 않는다.
2. **Environment Variables 등록** (Production / Preview 둘 다). `.env.example` 참고.

   | 키 | 값 |
   |---|---|
   | `DATABASE_URL` | Supabase **Transaction pooler (포트 6543)** |
   | `CODEF_ENV` | `demo` 또는 `api` |
   | `CODEF_DEMO_CLIENT_ID` / `_SECRET` | 데모 키 |
   | `CODEF_PUBLIC_KEY` | 계정 공통 (줄바꿈 없이 한 줄) |
   | `CODEF_ALLOW_LIVE` | `true` |
   | `CODEF_DAILY_LIMIT` | `100` |

   ⚠ **포트 6543(Transaction pooler)** 이어야 한다. 5432(Session pooler)를 쓰면 서버리스
   인스턴스마다 직접 연결이 쌓여 Supabase 연결 상한을 넘긴다. 로컬 스크립트(`npm run db:*`)는
   반대로 5432 를 쓴다.

3. **마이그레이션은 배포와 별개다.** Supabase SQL Editor 에서 `db/migrations/*.sql` 을
   순서대로 실행한 뒤 `npm run db:baseline` 으로 적용 이력을 기록한다.

### 서버리스에서 조심할 것 (이미 코드에 반영됨)

- `pdfjs-dist` 는 `serverExternalPackages` + `outputFileTracingIncludes` 로 함수 번들에
  같이 싣는다. 둘 중 하나만 하면 **배포한 뒤에만** 약관 업로드가 깨진다.
- 약관 업로드 라우트는 `maxDuration = 60`. 기본 10초로는 두꺼운 약관에서 잘린다.
- DB 풀은 서버리스에서 인스턴스당 1 연결(`src/lib/db.ts`).

### 배포 전 점검

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## 남은 작업

- 동기화 UI (2-way 인증 진행 화면) — 현재는 커넥터만 구현
- 약관 PDF 수집·검색 (RAG) → 규칙에 박아둔 인용문을 실제 약관 조항으로 교체
- LLM 폴백 — 규칙이 unknown 을 낸 문장 처리
- 청구 체크리스트 저장 · 실손24 딥링크
