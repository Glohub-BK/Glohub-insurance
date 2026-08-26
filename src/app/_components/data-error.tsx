import { Beoni } from './brand';
import { Card } from './ui';

/**
 * DB 에 닿지 못했을 때의 화면.
 *
 * 예시 데이터로 대체하지 않는다. 실데이터를 연결한 사람에게 말없이 예시 가구를
 * 보여주면 오류가 아니라 "내 데이터가 사라졌다" 로 읽힌다.
 *
 * 일반 사용자에게는 "일시적인 문제, 잠시 후 다시" 까지만 말한다.
 * DATABASE_URL·Supabase 같은 단어는 개발자의 언어다 — 사용자가 고칠 수 있는 것이
 * 아니면 화면에 올리지 않는다. 개발 모드에서만 점검 순서를 덧붙인다.
 */
export function DataErrorCard() {
  const dev = process.env.NODE_ENV === 'development';

  return (
    <>
      <Card className="flex flex-col items-center gap-3 !py-8 text-center">
        <Beoni pose="sorry" height={96} />
        <span>
          <b className="text-[18px]">잠시 연결이 원활하지 않아요</b>
          <br />
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            보험 데이터는 안전하게 보관되어 있습니다.
            <br />
            잠시 후 다시 열어주세요.
          </span>
        </span>
      </Card>

      {/* 전체 새로고침이 필요하므로 Link 가 아니라 a 를 쓴다. 서버 컴포넌트를 다시 그려야 한다. */}
      <a href="" className="btn btn-primary">
        다시 시도
      </a>

      {dev ? (
        <Card flat>
          <b className="text-[15px]" style={{ color: 'var(--ink-3)' }}>
            개발자 안내 — 이 목록은 개발 모드에서만 보입니다
          </b>
          <ol className="mt-2.5 flex flex-col gap-2 text-[14px]" style={{ color: 'var(--ink-2)' }}>
            {[
              '.env.local 의 DATABASE_URL 확인',
              'env 변경 후에는 개발 서버 재시작',
              'Supabase 프로젝트 일시정지 여부 확인',
              '터미널의 [view-data] DB 조회 실패 로그에 원인이 있음',
            ].map((t, i) => (
              <li key={t} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 grid size-[20px] flex-none place-items-center rounded-[6px] text-[12px] font-bold text-white"
                  style={{ background: 'var(--ink-3)' }}
                >
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </>
  );
}
