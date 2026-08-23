'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, Icon, ICONS, Pill } from '../../_components/ui';

type Relation = '배우자' | '자녀(성인)' | '자녀(미성년)' | '부모님';

const RELATIONS: Array<{ value: Relation; note: string; needsGuardian: boolean }> = [
  { value: '배우자', note: '본인 인증만', needsGuardian: false },
  { value: '자녀(성인)', note: '본인 인증만', needsGuardian: false },
  { value: '자녀(미성년)', note: '법정대리인 동의', needsGuardian: true },
  { value: '부모님', note: '본인 인증만', needsGuardian: false },
];

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
 * 관계를 먼저 묻는 이유는 관계에 따라 절차가 달라지기 때문이다 — 미성년 자녀만
 * 법정대리인 동의가 추가된다. 이 화면에서는 주민등록번호를 받지 않는다.
 */
export function AddFlow() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [relation, setRelation] = useState<Relation>('배우자');
  const [name, setName] = useState('');
  const [method, setMethod] = useState<Method>('link');

  const selected = RELATIONS.find((r) => r.value === relation)!;
  const displayName = name.trim() || relation;

  if (step === 1) {
    return (
      <>
        <Steps current={1} />
        <div>
          <h1 className="mt-1.5 mb-1 text-[22px] leading-[1.35] font-bold tracking-[-0.02em]">
            누구를 추가하나요?
          </h1>
          <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            관계에 따라 필요한 동의 절차가 달라집니다.
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
            주민등록번호는 인증 화면에서 본인이 직접 입력하고, 저장하지 않습니다. 우리가 보관하는
            건 <b className="font-semibold">표시할 이름과 관계</b>뿐입니다.
          </p>
        </Card>

        <Card>
          <label htmlFor="member-name" className="mb-1.5 block text-[14px]" style={{ color: 'var(--ink-3)' }}>
            화면에 표시할 이름
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
    return (
      <>
        <Steps current={2} />
        <div>
          <h1 className="mt-1.5 mb-1 text-[22px] leading-[1.35] font-bold tracking-[-0.02em]">
            어떻게 인증할까요?
          </h1>
          <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            가족 계약은 대신 조회할 수 없습니다.{' '}
            <b className="font-semibold" style={{ color: 'var(--ink)' }}>
              {displayName}님이 직접 인증
            </b>
            해야 합니다.
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

        {selected.needsGuardian ? (
          <Card tone="warn">
            <div className="flex items-start gap-3">
              <span className="flex-none pt-0.5" style={{ color: 'var(--warn)' }}>
                <Icon path={ICONS.alert} size={21} />
              </span>
              <span className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                <b className="block font-semibold" style={{ color: 'var(--warn)' }}>
                  미성년 자녀는 한 단계 더
                </b>
                법정대리인 동의 화면을 먼저 통과해야 합니다. 동의 시각이 기록으로 남습니다.
              </span>
            </div>
          </Card>
        ) : null}

        <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
          {method === 'link' ? '초대 링크 보내기' : '이 기기에서 인증 시작'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
          이전
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
            {method === 'link' ? '초대를 보냈습니다' : '인증 화면을 준비했습니다'}
          </b>
          <br />
          <span className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            {displayName}님이 인증을 마치면 자동으로 합류합니다
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
            상태
          </span>
          <Pill tone="warn">인증 대기</Pill>
        </div>
      </Card>

      <p className="note">
        초대 링크에는 개인정보가 담기지 않습니다. 링크를 받은 사람이{' '}
        <b className="font-semibold" style={{ color: 'var(--ink-2)' }}>
          자기 인증을 통과해야만
        </b>{' '}
        우리집에 합류합니다.
      </p>

      <Link href="/family" className="btn btn-primary">
        가족 목록으로
      </Link>
      <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
        한 명 더 추가
      </button>
    </>
  );
}
