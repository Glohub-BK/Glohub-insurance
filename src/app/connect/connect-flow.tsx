'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, Icon, ICONS, Pill } from '../_components/ui';
import { Beoni } from '../_components/brand';

/**
 * 내보험다보여 연결.
 *
 * 이 앱은 이 화면을 첫 화면으로 쓰지 않는다. 홈·보장·AI 청구를 먼저 만져보고
 * "내 걸로도 해볼래"가 됐을 때 들어온다.
 *
 * 입력 검증 규칙은 대상기관 규칙 그대로다 — 여기서 막지 않으면 CF-12827 이 떨어지는데
 * 사용자는 왜 실패했는지 알 수 없다.
 *
 * 비밀번호는 이 컴포넌트의 state 에만 있다. 2차 요청에도 대상기관이 비밀번호를 다시
 * 요구하므로 값을 들고 있어야 하는데, 서버 세션이나 저장소에 두지 않는다.
 * 흐름이 끝나면 state 를 비워 메모리에서도 지운다.
 */

const ID_RULE = /^[A-Za-z0-9]{6,12}$/;
const PW_SPECIAL = /[!@#$%^&*?_~]/;

export function validateLoginId(value: string): string | null {
  if (value.length === 0) return null;
  if (!/^[A-Za-z0-9]*$/.test(value)) return '특수문자와 공백은 쓸 수 없습니다';
  if (value.length < 6 || value.length > 12) return '6자 이상 12자 이하여야 합니다';
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length === 0) return null;
  if (value.length < 9 || value.length > 20) return '9자 이상 20자 이하여야 합니다';
  const kinds =
    Number(/[A-Za-z]/.test(value)) + Number(/[0-9]/.test(value)) + Number(PW_SPECIAL.test(value));
  if (kinds < 3) return '영문·숫자·특수문자(!@#$%^&*?_~)를 모두 포함해야 합니다';
  return null;
}

type Step = 'form' | 'waiting' | 'done';

type TwoWayInfo = {
  jobIndex: number;
  threadIndex: number;
  jti: string;
  twoWayTimestamp: number;
};

type Outcome =
  | { status: 'two_way'; twoWayInfo: TwoWayInfo; extraMessage: string | null }
  | {
      status: 'done';
      policyCount: number;
      activeCount: number;
      summary: { coverageCount: number };
      environment: 'sandbox' | 'demo' | 'api';
    }
  | { status: 'failed'; failure: { code: string; message: string; fixable: boolean } };

async function post(path: string, body: unknown): Promise<Outcome> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // 502 도 본문에 실패 사유가 들어 있다. 상태코드만 보고 버리면 사용자는 이유를 못 본다.
  return (await res.json()) as Outcome;
}

export function ConnectFlow({
  environment,
  liveAllowed,
}: {
  /** 지금 실행 중인 서버가 보는 값. 화면에 그대로 띄운다. */
  environment: 'sandbox' | 'demo' | 'api';
  liveAllowed: boolean;
}) {
  const [step, setStep] = useState<Step>('form');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ id: false, pw: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twoWay, setTwoWay] = useState<TwoWayInfo | null>(null);
  const [result, setResult] = useState<{
    policyCount: number;
    activeCount: number;
    coverageCount: number;
    environment: 'sandbox' | 'demo' | 'api';
  } | null>(null);

  function apply(outcome: Outcome) {
    if (outcome.status === 'two_way') {
      setTwoWay(outcome.twoWayInfo);
      setStep('waiting');
      return;
    }
    if (outcome.status === 'done') {
      setResult({
        policyCount: outcome.policyCount,
        activeCount: outcome.activeCount ?? 0,
        coverageCount: outcome.summary?.coverageCount ?? 0,
        environment: outcome.environment,
      });
      // 흐름이 끝났다. 비밀번호를 메모리에서도 지운다.
      setPassword('');
      setStep('done');
      return;
    }
    setError(`${outcome.failure.message} (${outcome.failure.code})`);
    if (outcome.failure.fixable) setStep('form');
  }

  async function submit(kind: 'start' | 'continue') {
    setBusy(true);
    setError(null);
    try {
      const body = { loginId, password, memberName: '본인' };
      const outcome =
        kind === 'start'
          ? await post('/api/connect/start', body)
          : await post('/api/connect/continue', { ...body, twoWayInfo: twoWay });
      apply(outcome);
    } catch {
      setError('연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  const idError = touched.id ? validateLoginId(loginId) : null;
  const pwError = touched.pw ? validatePassword(password) : null;
  const ready =
    ID_RULE.test(loginId) && validatePassword(password) === null && password.length > 0;

  if (step === 'waiting') {
    return (
      <>
        <div>
          <h1 className="mt-1 mb-1 text-[22px] leading-[1.35] font-bold tracking-[-0.02em]">
            휴대폰에서 인증을 완료해주세요
          </h1>
          <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            인증 요청을 보냈습니다. 승인하면 자동으로 다음 단계로 넘어갑니다.
          </p>
        </div>

        <Card className="flex flex-col items-center gap-3 !py-8 text-center">
          {/* 기다리는 화면이라 뻐니가 대신 기다려준다. */}
          <Beoni pose="phone" height={96} className="nc-bob" />
          <span>
            <b className="text-[18px]">인증 대기 중</b>
            <br />
            <span className="tnum text-[15px]" style={{ color: 'var(--ink-3)' }}>
              남은 시간 02:41
            </span>
          </span>
        </Card>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <p className="note">
          휴대폰에서 인증을 마친 뒤 아래를 눌러주세요. 인증 전에 누르면 대상기관이 대기 중으로
          답합니다.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void submit('continue')}
        >
          {busy ? '확인하는 중…' : '인증을 마쳤어요'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setStep('form')}>
          취소
        </button>
      </>
    );
  }

  if (step === 'done') {
    return (
      <>
        <Card tone="brand" className="flex flex-col items-center gap-3 !py-8 text-center">
          <Beoni pose="cheer" height={104} />
          <span>
            <b className="text-[18px]" style={{ color: 'var(--brand-ink)' }}>
              연결 준비가 끝났습니다
            </b>
            <br />
            <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
              유지 {result?.activeCount ?? 0}건 · 만기·해지{' '}
              {(result?.policyCount ?? 0) - (result?.activeCount ?? 0)}건 · 담보{' '}
              {result?.coverageCount ?? 0}개를 가져왔습니다
            </span>
          </span>
        </Card>

        {/* 샌드박스는 그럴듯한 가짜를 돌려준다. 여기서 밝히지 않으면 자기 보험으로 읽는다. */}
        {result?.environment === 'sandbox' ? (
          <Card tone="warn" className="flex items-start gap-3">
            <span className="flex-none pt-0.5" style={{ color: 'var(--warn)' }}>
              <Icon path={ICONS.alert} size={21} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[16px]" style={{ color: 'var(--warn)' }}>
                샌드박스 데이터입니다
              </b>
              <span className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                지금 가져온 계약은 CODEF 가 테스트용으로 내려주는 고정 응답이며 실제 가입 내역이
                아닙니다. 휴대폰 인증을 거치지 않은 것도 그 때문입니다. 실데이터를 받으려면{' '}
                <code>CODEF_ENV=demo</code> 로 바꾸고 개발 서버를 다시 시작하세요.
              </span>
            </span>
          </Card>
        ) : null}

        <p className="note">
          한국신용정보원은 만기·해지된 옛 계약까지 전체 이력을 돌려줍니다. 진단과 보장 맵은{' '}
          <b className="font-semibold" style={{ color: 'var(--ink-2)' }}>
            유지 중인 계약만
          </b>{' '}
          사용합니다.
        </p>

        <p className="note">
          입력하신 비밀번호는 이 화면을 벗어나며 사라졌습니다. 저장하지 않습니다.
        </p>

        <Link href="/" className="btn btn-primary">
          홈으로
        </Link>
      </>
    );
  }

  return (
    <>
      <EnvironmentChip environment={environment} liveAllowed={liveAllowed} />

      <div>
        <h1 className="mt-1 mb-1 text-[22px] leading-[1.35] font-bold tracking-[-0.02em]">
          한국신용정보원 계정으로 연결합니다
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
          한국신용정보원이 모아둔 내 보험 계약을 그대로 가져옵니다. 내보험다보여에서 쓰는
          계정과 같습니다.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div>
          <label htmlFor="login-id" className="mb-1.5 block text-[14px]" style={{ color: 'var(--ink-3)' }}>
            아이디
          </label>
          <input
            id="login-id"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, id: true }))}
            autoComplete="username"
            inputMode="text"
            placeholder="6~12자 영문·숫자"
            aria-invalid={idError !== null}
            aria-describedby={idError ? 'login-id-error' : undefined}
            className="w-full min-h-[50px] rounded-[12px] border px-3 text-[16px] outline-none"
            style={{
              borderColor: idError ? 'var(--alert)' : 'var(--line-2)',
              background: 'var(--white)',
              color: 'var(--ink)',
              boxShadow: 'var(--e1)',
            }}
          />
          {idError ? (
            <p id="login-id-error" className="mt-1.5 text-[14px]" style={{ color: 'var(--alert)' }}>
              {idError}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="login-pw" className="mb-1.5 block text-[14px]" style={{ color: 'var(--ink-3)' }}>
            비밀번호
          </label>
          <input
            id="login-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, pw: true }))}
            autoComplete="current-password"
            placeholder="9~20자, 영문·숫자·특수문자 포함"
            aria-invalid={pwError !== null}
            aria-describedby={pwError ? 'login-pw-error' : undefined}
            className="w-full min-h-[50px] rounded-[12px] border px-3 text-[16px] outline-none"
            style={{
              borderColor: pwError ? 'var(--alert)' : 'var(--line-2)',
              background: 'var(--white)',
              color: 'var(--ink)',
              boxShadow: 'var(--e1)',
            }}
          />
          {pwError ? (
            <p id="login-pw-error" className="mt-1.5 text-[14px]" style={{ color: 'var(--alert)' }}>
              {pwError}
            </p>
          ) : null}
        </div>
      </Card>

      <Card flat>
        <b className="text-[16px]">비밀번호는 저장하지 않습니다</b>
        <ul className="mt-2.5 flex flex-col gap-2">
          {[
            '기기에서 곧바로 암호화되어 전송됩니다',
            '주민등록번호도 인증 통과에만 쓰고 보관하지 않습니다',
            '우리가 저장하는 건 계약·담보 내용뿐입니다',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[15px]">
              <span className="mt-0.5 flex-none" style={{ color: 'var(--brand-ink)' }}>
                <Icon path={ICONS.check} size={19} />
              </span>
              <span style={{ color: 'var(--ink-2)' }}>{t}</span>
            </li>
          ))}
        </ul>
      </Card>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <button
        type="button"
        className="btn btn-primary"
        disabled={!ready || busy}
        onClick={() => void submit('start')}
      >
        {busy ? '조회하는 중…' : '본인인증 시작'}
      </button>

      <Card tone="warn" className="flex items-start gap-3">
        <span className="flex-none pt-0.5" style={{ color: 'var(--warn)' }}>
          <Icon path={ICONS.alert} size={21} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[16px]" style={{ color: 'var(--warn)' }}>
            한국신용정보원 계정이 없다면
          </b>
          <span className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            한국신용정보원(내보험다보여)에서 먼저 가입해야 합니다. 앱 안에서 바로 가입하는
            흐름은 다음 단계에서 붙습니다.
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Pill>아이디 6~12자</Pill>
            <Pill>비밀번호 9~20자</Pill>
            <Pill>본인인증 1년마다 갱신</Pill>
          </span>
        </span>
      </Card>

      <Link href="/" className="btn btn-ghost">
        나중에 하기
      </Link>
    </>
  );
}

/** 실패 사유는 숨기지 않는다. 무엇을 고쳐야 할지 알아야 다시 시도할 수 있다. */
function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[12px] px-3 py-2.5 text-[15px]"
      style={{ background: 'var(--alert-soft)', color: 'var(--alert)' }}
    >
      {children}
    </p>
  );
}

/**
 * 지금 어느 환경으로 조회하는지 누르기 전에 밝힌다.
 *
 * 샌드박스는 휴대폰 인증 없이 곧바로 성공하고 그럴듯한 계약을 돌려준다.
 * 그 사실을 결과 화면에서야 알면 이미 가짜를 자기 보험으로 읽은 뒤다.
 */
function EnvironmentChip({
  environment,
  liveAllowed,
}: {
  environment: 'sandbox' | 'demo' | 'api';
  liveAllowed: boolean;
}) {
  if (environment === 'sandbox') {
    return (
      <div
        className="flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-[14px]"
        style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
        role="status"
      >
        <span className="flex-none pt-px">
          <Icon path={ICONS.alert} size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="font-semibold">샌드박스 환경입니다.</b>{' '}
          <span style={{ color: 'var(--ink-2)' }}>
            휴대폰 인증 없이 통과하고 테스트용 가짜 계약이 들어옵니다.
            {liveAllowed
              ? ' 실데이터 잠금은 열려 있으니, CODEF_ENV 만 demo 로 바꾸고 개발 서버를 다시 시작하세요.'
              : ' 실데이터를 받으려면 CODEF_ENV=demo 와 CODEF_ALLOW_LIVE=true 로 바꾸고 개발 서버를 다시 시작하세요.'}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-[14px]"
      style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}
      role="status"
    >
      <span className="flex-none">
        <Icon path={ICONS.check} size={17} />
      </span>
      <span className="font-semibold">{environment === 'demo' ? '데모' : '정식'} 환경</span>
      {/* 추가 인증은 대상기관이 요구할 때만 뜬다. "필요합니다" 라고 단정하면
          인증 없이 끝났을 때 가짜로 오해한다 — 실제로 그런 오해가 있었다. */}
      <span style={{ color: 'var(--ink-2)' }}>
        실제 계약을 조회합니다. 기관이 요구하면 휴대폰 인증 단계가 진행됩니다.
      </span>
    </div>
  );
}
