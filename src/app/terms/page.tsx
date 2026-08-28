import { getCurrentHousehold } from '@/lib/repo/household';
import { listTermsDocs } from '@/lib/repo/terms-doc';
import { getPolicyTermsStatus } from '@/lib/repo/terms';
import { getHouseholdView } from '@/lib/repo/view-data';
import { disclosureFor, searchTermFor } from '@/lib/domain/insurer-disclosure';
import { Card, Disclaimer, Icon, ICONS, Pill, SectionTitle } from '../_components/ui';
import { DataErrorCard } from '../_components/data-error';
import { PreviewNotice } from '../_components/connect';
import { Beoni } from '../_components/brand';
import { OpenDisclosure, UploadTerms } from './terms-actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: '약관 보관함' };

/**
 * 약관 보관함.
 *
 * 이 앱은 약관을 읽어 근거를 대주는 게 일이지만, 사용자에게 **원본 파일 자체**가
 * 필요한 순간이 따로 있다 — 분쟁 시 제출, 손해사정사에게 전달, 다른 기기에서 열어보기.
 * 그래서 원본을 보관하고 언제든 휴대폰으로 다시 내려받게 한다.
 *
 * 원본은 우리가 대신 긁어오지 않는다. 각 사 공시실은 검색 결과를 세션으로 그리고 PDF
 * 주소도 매번 달라져 오늘 되던 게 다음 달에 조용히 깨진다. 게다가 약관은 보험사의
 * 저작물이라 우리가 사본을 만들어 뿌릴 자리가 아니다. 공식 공시실로 보내되,
 * 상품명을 복사해 주고 링크를 열어 **붙여넣기 한 번**으로 끝나게 한다.
 */
/** 절차 번호 동그라미. 순서가 있는 일은 순서로 보여야 한다. */
function StepNum({ n }: { n: number }) {
  return (
    <span
      className="mt-0.5 grid size-[22px] flex-none place-items-center rounded-full text-[12px] font-bold text-white"
      style={{ background: 'var(--brand-grad)' }}
    >
      {n}
    </span>
  );
}

function bytesLabel(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

export default async function TermsPage() {
  const { mode, policies } = await getHouseholdView();
  if (mode === 'error') return <DataErrorCard />;
  const preview = mode === 'preview';

  const household = preview ? null : await getCurrentHousehold().catch(() => null);
  const docs = household ? await listTermsDocs(household.id).catch(() => []) : [];
  const status = household ? await getPolicyTermsStatus(household.id).catch(() => []) : [];
  const byPolicyStatus = new Map(status.map((s) => [s.policy_id, s]));
  const byPolicy = new Map<string, typeof docs>();
  for (const d of docs) {
    if (!d.policy_id) continue;
    const list = byPolicy.get(d.policy_id) ?? [];
    list.push(d);
    byPolicy.set(d.policy_id, list);
  }

  // 유지 중인 계약만 다룬다. 만기된 계약의 약관을 지금 받아둘 이유는 적다.
  const active = policies.filter((p) => p.status === '유지');
  // "약관이 있다"의 기준은 우리가 파일을 가졌는지가 아니라 **조항을 쓸 수 있는지**다.
  // 같은 상품을 다른 사용자가 이미 올렸다면 우리는 아무것도 하지 않아도 된다.
  const covered = active.filter((p) => (byPolicyStatus.get(p.id)?.clause_count ?? 0) > 0).length;
  const loose = docs.filter((d) => !d.policy_id);

  return (
    <>
      <div>
        <h1 className="mt-1 mb-1.5 text-[22px] leading-snug font-bold tracking-[-0.02em]">
          약관 보관함
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
          약관은 사람마다 다른 게 아니라 <b className="font-semibold">상품마다 하나</b>입니다. 같은 상품에
          가입한 누군가 한 번 올려두면, 나머지는 받을 필요가 없어요. 아래는 그래도 아직 없는 것들입니다.
        </p>
      </div>

      {preview ? <PreviewNotice>연결하면 내 계약 목록으로 바뀝니다</PreviewNotice> : null}

      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: '유지 계약', value: `${active.length}건` },
            { label: '조항 확보', value: `${covered}건`, accent: true },
            { label: '올려야 함', value: `${active.length - covered}건` },
          ].map((t) => (
            <span key={t.label} className="rounded-[12px] px-2 py-2.5" style={{ background: 'var(--sub)' }}>
              <b
                className="tnum block text-[18px] font-extrabold"
                style={{ color: t.accent ? 'var(--brand-ink)' : 'var(--ink)' }}
              >
                {t.value}
              </b>
              <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
                {t.label}
              </span>
            </span>
          ))}
        </div>
      </Card>

      <Card className="flex items-start gap-3" tone="brand">
        <Beoni pose="doc" height={40} />
        <span className="text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          <b className="font-semibold">한 번만 올리면 끝입니다.</b> 같은 상품 가입자 모두가 함께 씁니다.
          공시실에는 판매가 끝난 옛 상품의 약관도 남아 있어요.
        </span>
      </Card>

      <SectionTitle meta={`${active.length}건`}>유지 중인 계약</SectionTitle>

      {active.length === 0 ? (
        <Card flat>
          <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
            유지 중인 계약이 없습니다.
          </p>
        </Card>
      ) : null}

      {active.map((p) => {
        const mine = byPolicy.get(p.id) ?? [];
        const st = byPolicyStatus.get(p.id);
        const clauseCount = st?.clause_count ?? 0;
        const sharedOnly = clauseCount > 0 && mine.length === 0;
        const disclosure = disclosureFor(p.insurer_name);
        const term = searchTermFor(p.product_name);

        return (
          <Card key={p.id} className="flex flex-col gap-3">
            <span>
              <span className="flex items-center gap-1.5">
                <b className="text-[16px] leading-snug">{p.insurer_name}</b>
                {clauseCount > 0 ? (
                  <Pill tone="ok">조항 {clauseCount.toLocaleString('ko-KR')}개</Pill>
                ) : (
                  <Pill tone="warn">약관 필요</Pill>
                )}
              </span>
              <span className="mt-0.5 block text-[14px]" style={{ color: 'var(--ink-3)' }}>
                {p.product_name} · {p.member_name}
              </span>
            </span>

            {/* 상태 1 — 같은 상품을 이미 누군가 올렸다. 사용자가 할 일이 없다. */}
            {sharedOnly ? (
              <span
                className="flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[14px] leading-relaxed"
                style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-line)' }}
              >
                <span className="mt-0.5 flex-none" style={{ color: 'var(--brand-ink)' }}>
                  <Icon path={ICONS.check} size={18} />
                </span>
                <span style={{ color: 'var(--ink-2)' }}>
                  <b className="font-semibold" style={{ color: 'var(--brand-ink)' }}>
                    이 상품 약관은 이미 준비돼 있어요.
                  </b>{' '}
                  받아서 올리지 않아도 진단에 그대로 쓰입니다. 원본 파일이 따로 필요하면 아래에서
                  공시실로 가세요.
                </span>
              </span>
            ) : null}

            {/* 상태 2 — 우리가 올렸다. 원본을 다시 내려받을 수 있다. */}
            {mine.map((d) => (
              <a
                key={d.document_id}
                href={`/api/terms/${d.document_id}`}
                download
                className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5"
                style={{ background: 'var(--sub)', border: '1px solid var(--line)' }}
              >
                <span className="flex-none" style={{ color: 'var(--brand-ink)' }}>
                  <Icon path={ICONS.doc} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{d.file_name}</b>
                  <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
                    조항 {d.clause_count.toLocaleString('ko-KR')}개 · {bytesLabel(d.byte_size)}
                  </span>
                </span>
                <span className="flex-none text-[14px] font-semibold" style={{ color: 'var(--brand-ink)' }}>
                  내려받기
                </span>
              </a>
            ))}

            {/* 상태 3 — 아무도 안 올렸다. 여기서만 사용자에게 부탁하되,
                버튼을 나란히 두지 않고 순서 있는 절차로 보여준다.
                "무작정 넣으라"는 화면은 아무도 못 따라온다. */}
            {clauseCount === 0 ? (
              <ol className="flex flex-col gap-3">
                <li className="flex items-start gap-2.5">
                  <StepNum n={1} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[14px] font-semibold">보험사 공시실에서 약관 PDF 받기</b>
                    <span className="mb-2 block text-[13px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                      버튼을 누르면 상품명이 복사되고 공시실이 열려요. 검색창에 붙여넣고, 여러 버전이
                      보이면 <b className="font-semibold">가입 시기와 가까운 판매시기</b>의 약관을 받으세요.
                    </span>
                    <OpenDisclosure url={disclosure.url} term={term} hint={disclosure.hint} />
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <StepNum n={2} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[14px] font-semibold">받은 PDF를 여기로 올리기</b>
                    <span className="mb-2 block text-[13px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                      휴대폰이면 다운로드 폴더에, PC면 브라우저가 저장한 곳에 있어요.
                    </span>
                    <UploadTerms policyId={p.id} label="약관 올리기" />
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <StepNum n={3} />
                  <span className="min-w-0 flex-1 text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    <b className="font-semibold">끝.</b> 조항을 자동으로 읽어 AI 청구 진단의 근거로 쓰고,
                    같은 상품 가입자들도 다시 받을 필요가 없어져요.
                  </span>
                </li>
              </ol>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <OpenDisclosure url={disclosure.url} term={term} hint={disclosure.hint} />
                <UploadTerms policyId={p.id} label={mine.length > 0 ? '다른 약관 추가' : '약관 올리기'} />
              </div>
            )}
          </Card>
        );
      })}

      {loose.length > 0 ? (
        <>
          <SectionTitle meta={`${loose.length}건`}>계약에 연결되지 않은 약관</SectionTitle>
          <Card className="flex flex-col gap-2">
            {loose.map((d) => (
              <a
                key={d.document_id}
                href={`/api/terms/${d.document_id}`}
                download
                className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5"
                style={{ background: 'var(--sub)', border: '1px solid var(--line)' }}
              >
                <span className="flex-none" style={{ color: 'var(--brand-ink)' }}>
                  <Icon path={ICONS.doc} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{d.file_name}</b>
                  <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
                    조항 {d.clause_count.toLocaleString('ko-KR')}개 · {bytesLabel(d.byte_size)}
                  </span>
                </span>
                <span className="flex-none text-[14px] font-semibold" style={{ color: 'var(--brand-ink)' }}>
                  내려받기
                </span>
              </a>
            ))}
          </Card>
        </>
      ) : null}

      <Card className="!p-0">
        <div className="px-4 pt-3.5 pb-1 text-[14px] font-semibold" style={{ color: 'var(--ink-3)' }}>
          받는 방법
        </div>
        <ol className="flex flex-col gap-2.5 px-4 pt-1 pb-3.5">
          {[
            '「공시실에서 원본 받기」를 누르면 상품명이 복사되고 보험사 공시실이 열립니다.',
            '검색창에 붙여넣고 검색 — 판매가 끝난 상품이면 「판매중지 상품」 탭도 확인하세요.',
            '「약관」 PDF 를 휴대폰에 내려받습니다.',
            '여기로 돌아와 「약관 올리기」로 방금 받은 파일을 고르세요.',
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
              <span
                className="mt-0.5 grid size-[21px] flex-none place-items-center rounded-full text-[13px] font-bold text-white"
                style={{ background: 'var(--brand)' }}
              >
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <p className="note">
        약관 원본의 저작권은 각 보험사에 있습니다. 놓칠뻔은 <b className="font-semibold">조항을 출처와 함께
        인용</b>할 뿐 파일 사본을 배포하지 않습니다 — 올리신 PDF 원본은 우리 가족만 내려받을 수 있고,
        같은 상품에 가입한 다른 분들에게는 공시실 링크만 안내합니다. 스캔한 이미지 PDF 는 글자를 뽑을 수 없어
        조항이 잡히지 않습니다 — 공시실에서 텍스트 PDF 를 받아주세요.
      </p>

      <Disclaimer />
    </>
  );
}
