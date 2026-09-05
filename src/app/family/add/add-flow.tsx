'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, Icon, ICONS, Pill } from '../../_components/ui';

type Relation = '배우자' | '자녀(성인)' | '자녀(미성년)' | '부모님';

const RELATIONS: Array<{ value: Relation; note: string; minor: boolean }> = [
  { value: '배우자', note: '본인 인증으로 합류', minor: false },
  { value: '자녀(성인)', note: '본인 인증으로 합류', minor: false },
  { value: '자녀(미성년)', note: '인증 불필요 · 자동 연결', minor: true },
  { value: '부모님', note: '본인 인증으로 합류', minor: false },
];

/** API 의 관계 코드로 변환한다. 화면 라벨과 DB 제약(배우자·자녀·부모·기타)이 다르다. */
function apiRelation(r: Relation): '배우자' | '자녀' | '부모' {
  if (r === '배우자') return '배우자';
  if (r === '부모님') return '부모';
  return '자녀';
}

type Method = 'link' | 'here';

function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-1.5 pt-1" aria-label={`3단계 중 ${current}단계`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className="block h-[7px] rounded-full transition-all"
          style={{
            width: n === current ? 22 : 7,
            background: n === current ? 'var(--brand)' : 'var(--line-2)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * 가족 추가 3단계.
 *
 * 관계를 먼저 묻는 이유는 관계에 따라 절차가 완전히 달라지기 때문이다.
 *
 *   - 미성년 자녀: 계약자가 될 수 없으므로 로그인·인증이 의미가 없다. 법정대리인
 *     동의만 받고 이름을 등록하면, 부모 계약의 피보험자명 매칭으로 보장이 자동
 *     연결된다. 이 화면에서 끝난다.
 *   - 성인(배우자·자녀·부모): 등록 즉시 가족 계약의 피보험자 몫은 보이지만,
 *     본인이 계약자인 보험은 본인 인증을 거쳐야 합쳐진다.
 *
 * 어느 쪽이든 주민등록번호는 받지 않는다. 저장하는 건 표시 이름과 관계뿐이다.
 */
export function AddFlow({ initialName = '' }: { initialName?: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [relation, setRelation] = useState<Relation>('배우자');
  const [name, setName] = useState(initialName);
  const [method, setMethod] = useState<Method>('link');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = RELATIONS.find((r) => r.value === relation)!;
  const displayName = name.trim() || relation;

  async function register(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/family/member', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          relation: apiRelation(relation),
          isMinor: selected.minor,
          guardianConsent: selected.minor ? consent : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? '등록하지 못했어요. 잠시 후 다시 시도해주세요.');
        return false;
      }
      return true;
    } catch {
      setError('등록하지 못했어요. 연결 상태를 확인해주세요.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (step === 1) {
    return (
      <>
        <Steps current={1} />
        <div>
          <h1 className="mt-1.5 mb-1 text-[22px] leading-[1.35] font-bold tracking-[-0.02em]">
            누구를 추가하나요?
          </h1>
          <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            관계에 따라 필요한 절차가 달라집니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="관계">
          {RELATIONS.map((r) => {
            const on = r.value === relation;
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRelation(r.value)}
                className="rounded-[14px] border px-3 py-3 text-left transition-all"
                style={{
                  background: on ? 'var(--brand-soft)' : 'var(--white)',
                  borderColor: on ? 'var(--brand)' : 'var(--line-2)',
                  boxShadow: on ? 'var(--e2)' : 'var(--e1)',
                }}
              >
                <b className="block text-[15px]" style={{ color: on ? 'var(--brand-ink)' : 'var(--ink)' }}>
                  {r.value}
                </b>
                <span className="text-[14px] leading-snug" style={{ color: 'var(--ink-3)' }}>
                  {r.note}
                </span>
              </button>
            );
          })}
        </div>

        <Card flat>
          <b className="text-[16px]">이름과 관계만 받습니다</b>
          <p className="mt-1 text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            주민등록번호는 받지 않습니다. 우리가 보관하는 건{' '}
            <b className="font-semibold">표시할 이름과 관계</b>뿐이고, 이름은 계약의{' '}
            <b className="font-semibold">피보험자명과 같아야</b> 자동으로 연결됩니다.
          </p>
        </Card>

        <Card>
          <label htmlFor="member-name" className="mb-1.5 block text-[14px]" style={{ color: 'var(--ink-3)' }}>
            이름 (계약의 피보험자명과 동일하게)
          </label>
          <input
            id="member-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={relation}
            maxLength={20}
            className="w-full min-h-[50px] rounded-[12px] border px-3 text-[16px] outline-none"
            style={{ borderColor: 'var(--line-2)', background: 'var(--white)', color: 'var(--ink)', boxShadow: 'var(--e1)' }}
          />
        </Card>

        <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
          다음
        </button>
        <Link href="/family" className="btn btn-ghost">
          취소
        </Link>
      </>
    );
  }

  if (step === 2) {
    // 미성년 자녀: 인증 단계가 없다. 법정대리인 동의 → 등록으로 끝난다.
    if (selected.minor) {
      return (
        <>
          <Steps current={2} />
          <div>
            <h1 className="mt-1.5 mb-1 text-[22px] leading-[1.35] font-bold tracking-[-0.02em]">
              인증 없이 등록합니다
            </h1>
            <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
              미성년 자녀는 보험 계약자가 될 수 없어 본인 인증이 의미가 없습니다. 자녀 보험은
              부모님 계약 조회에 이미 들어 있고,{' '}
              <b className="font-semibold" style={{ color: 'var(--ink)' }}>
                피보험자명이 {displayName}인 계약
              </b>
              이 자동으로 연결됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConsent(!consent)}
            className="card card-tap flex items-start gap-3"
            style={consent ? { borderColor: 'var(--brand)', boxShadow: 'var(--e2)' } : undefined}
            role="checkbox"
            aria-checked={consent}
          >
            <span
              className="grid size-[26px] flex-none place-items-center rounded-[8px] border"
              style={
                consent
                  ? { background: 'var(--brand-grad)', borderColor: 'transparent', color: '#fff' }
                  : { borderColor: 'var(--line-2)', background: 'var(--white)' }
              }
            >
              {consent ? <Icon path={ICONS.check} size={16} /> : null}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <b className="block text-[15px]">법정대리인으로서 동의합니다</b>
              <span className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                내 자녀의 이름을 가족 화면에 등록하고, 내 계약의 피보험자 정보와 연결하는 것에
                동의합니다. 동의 시각이 기록으로 남습니다.
              </span>
            </span>
          </button>

          {error ? (
            <Card tone="warn">
              <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>{error}</p>
            </Card>
          ) : null}

          <button
            type="button"
            className="btn btn-primary"
            disabled={!consent || saving}
            style={!consent || saving ? { opacity: 0.55 } : undefined}
            onClick={async () => {
              if (await register()) setStep(3);
            }}
          >
            {saving ? '등록하는 중…' : `${displayName} 등록하기`}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
            이전
          </button>
        </>
      );
    }

    return (
      <>
        <Steps current={2} />
        <div>
          <h1 className="mt-1.5 mb-1 text-[22px] leading-[1.35] font-bold tracking-[-0.02em]">
            어떻게 인증할까요?
          </h1>
          <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            등록하면 우리 가족 계약에서{' '}
            <b className="font-semibold" style={{ color: 'var(--ink)' }}>
              피보험자가 {displayName}님인 계약
            </b>
            은 바로 보입니다. 다만 {displayName}님이 직접 가입한 보험은{' '}
            <b className="font-semibold" style={{ color: 'var(--ink)' }}>
              본인 인증
            </b>
            을 거쳐야 합쳐집니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMethod('link')}
          className="card card-tap flex items-start gap-3"
          style={method === 'link' ? { borderColor: 'var(--brand)', boxShadow: 'var(--e2)' } : undefined}
        >
          <span
            className="grid size-[42px] flex-none place-items-center rounded-[14px] text-white"
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--e-brand)' }}
          >
            <Icon path={ICONS.link} size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <b className="text-[16px]">초대 링크 보내기</b>
              <Pill tone="ok">추천</Pill>
            </span>
            <span className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              카카오톡·문자로 링크를 보냅니다. 가족이 자기 휴대폰에서 인증하면 우리집에 합류합니다.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMethod('here')}
          className="card card-tap flex items-start gap-3"
          style={method === 'here' ? { borderColor: 'var(--brand)', boxShadow: 'var(--e2)' } : undefined}
        >
          <span
            className="grid size-[42px] flex-none place-items-center rounded-[14px]"
            style={{ background: 'var(--sub)', color: 'var(--ink-2)' }}
          >
            <Icon path={ICONS.phone} size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[16px]">지금 옆에서 함께 인증</b>
            <span className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              가족이 지금 같이 있다면 이 기기에서 바로 인증합니다. 인증이 끝나면 자동으로 내
              계정으로 돌아옵니다.
            </span>
          </span>
        </button>

        {error ? (
          <Card tone="warn">
            <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>{error}</p>
          </Card>
        ) : null}

        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          style={saving ? { opacity: 0.55 } : undefined}
          onClick={async () => {
            if (await register()) setStep(3);
          }}
        >
          {saving ? '등록하는 중…' : method === 'link' ? '등록하고 초대 링크 보내기' : '등록하고 인증 시작'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
          이전
        </button>
      </>
    );
  }

  if (selected.minor) {
    return (
      <>
        <Steps current={3} />
        <Card className="mt-1.5 flex flex-col items-center gap-3 text-center !py-7">
          <span
            className="grid size-[66px] place-items-center rounded-[22px]"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}
          >
            <Icon path={ICONS.check} size={31} />
          </span>
          <span>
            <b className="text-[18px]">{displayName} 등록 완료</b>
            <br />
            <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
              가족 계약에서 피보험자가 {displayName}인 계약이 자동으로 연결됩니다
            </span>
          </span>
        </Card>

        <p className="note">
          가족 화면에서 {displayName}의 계약·담보 수와 핵심 담보 공백을 확인하세요. 연결된 계약이
          없다면 등록한 이름이 계약의 피보험자명과 같은지 확인해주세요.
        </p>

        <Link href="/family" className="btn btn-primary">
          가족 목록에서 확인
        </Link>
        <button type="button" className="btn btn-ghost" onClick={() => { setStep(1); setName(''); setConsent(false); }}>
          한 명 더 추가
        </button>
      </>
    );
  }

  return (
    <>
      <Steps current={3} />
      <Card className="mt-1.5 flex flex-col items-center gap-3 text-center !py-7">
        <span
          className="grid size-[66px] place-items-center rounded-[22px]"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}
        >
          <Icon path={ICONS.send} size={31} />
        </span>
        <span>
          <b className="text-[18px]">
            {method === 'link' ? '등록하고 초대를 보냈습니다' : '등록하고 인증 화면을 준비했습니다'}
          </b>
          <br />
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            피보험자 몫 계약은 바로 보이고, 본인 명의 계약은 인증 후 합쳐집니다
          </span>
        </span>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2 py-2.5">
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            관계
          </span>
          <span className="text-[15px] font-semibold">{relation}</span>
        </div>
        <div
          className="flex items-center justify-between gap-2 border-t py-2.5"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            인증 방법
          </span>
          <Pill tone="ok">{method === 'link' ? '초대 링크' : '이 기기'}</Pill>
        </div>
        {method === 'link' ? (
          <div
            className="flex items-center justify-between gap-2 border-t py-2.5"
            style={{ borderColor: 'var(--line)' }}
          >
            <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
              링크 유효기간
            </span>
            <span className="text-[15px] font-semibold">7일</span>
          </div>
        ) : null}
        <div
          className="flex items-center justify-between gap-2 border-t py-2.5"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            본인 명의 계약
          </span>
          <Pill tone="warn">인증 대기</Pill>
        </div>
      </Card>

      <p className="note">
        초대 링크에는 개인정보가 담기지 않습니다. 링크를 받은 사람이{' '}
        <b className="font-semibold" style={{ color: 'var(--ink-2)' }}>
          자기 인증을 통과해야만
        </b>{' '}
        본인 명의 계약이 우리집에 합쳐집니다.
      </p>

      <Link href="/family" className="btn btn-primary">
        가족 목록으로
      </Link>
      <button type="button" className="btn btn-ghost" onClick={() => { setStep(1); setName(''); }}>
        한 명 더 추가
      </button>
    </>
  );
}
