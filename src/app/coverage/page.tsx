import { CORE_CATEGORIES } from '@/lib/repo/dashboard';
import { getHouseholdView } from '@/lib/repo/view-data';
import { CATEGORY_LABELS } from '@/lib/domain/coverage-category';
import { Card, Disclaimer, Pill, SectionTitle, Won, shortWon } from '../_components/ui';
import { ConnectCard, PreviewNotice } from '../_components/connect';
import { DataSourceNotice } from '../_components/data-source';
import { DataErrorCard } from '../_components/data-error';

export const dynamic = 'force-dynamic';

/**
 * 계약 유형은 내보험다보여의 공식 구분을 그대로 따른다.
 * CODEF 응답 자체가 이 5종(resFlatRate/resActualLoss/resCar/resProperty/resSavings)으로
 * 갈라져 내려오고, 굿리치 등 기존 보험 앱도 같은 축으로 보여준다.
 * 우리가 임의 분류를 만들면 사용자가 다른 앱과 대조할 수 없게 된다.
 */
const KIND_ORDER = ['actual_loss', 'flat_rate', 'car', 'property', 'savings', 'unknown'] as const;

const KIND_LABEL: Record<string, string> = {
  flat_rate: '정액형 (생명·장기)',
  actual_loss: '실손의료비',
  car: '자동차',
  property: '화재·재물',
  savings: '저축성',
  unknown: '미분류',
};

function statusTone(status: string) {
  if (status === '유지') return 'ok' as const;
  if (status === '만기') return 'grey' as const;
  if (status === '미상') return 'warn' as const;
  return 'bad' as const;
}

export default async function CoveragePage() {
  const { mode, dataEnvironment, members, matrix, policies, coverages } = await getHouseholdView();
  if (mode === 'error') return <DataErrorCard />;
  const preview = mode === 'preview';

  const categories = Array.from(
    new Map(
      matrix.map((c) => [c.category, { code: c.category, label: c.category_label, sort: c.sort_order }]),
    ).values(),
  ).sort((a, b) => a.sort - b.sort);

  const byKey = new Map(matrix.map((c) => [`${c.member_id}::${c.category}`, c]));

  const covByPolicy = new Map<string, typeof coverages>();
  for (const c of coverages) {
    const list = covByPolicy.get(c.policy_id) ?? [];
    list.push(c);
    covByPolicy.set(c.policy_id, list);
  }

  // 유지 계약은 내보험다보여 유형별로 묶고, 유형 안에서는 보험료 큰 순으로 놓는다.
  const activePolicies = policies.filter((p) => p.status === '유지');
  const inactivePolicies = policies.filter((p) => p.status !== '유지');
  const activeByKind = new Map<string, typeof policies>();
  for (const p of activePolicies) {
    const kind = KIND_ORDER.includes(p.contract_kind as (typeof KIND_ORDER)[number])
      ? p.contract_kind
      : 'unknown';
    const list = activeByKind.get(kind) ?? [];
    list.push(p);
    activeByKind.set(kind, list);
  }
  for (const list of activeByKind.values()) {
    list.sort((a, b) => Number(b.premium ?? 0) - Number(a.premium ?? 0));
  }

  function renderPolicy(p: (typeof policies)[number]) {
    const cov = covByPolicy.get(p.id) ?? [];
    const cats = Array.from(new Set(cov.map((c) => c.category)));
    return (
      <Card key={p.id} className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <b className="block text-[16px] leading-snug">{p.product_name}</b>
            <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
              {p.insurer_name} · {p.member_name}
            </span>
          </span>
          <span className="flex-none text-right">
            <Won value={p.premium === null ? null : Number(p.premium)} className="text-[16px] font-bold" />
            {p.payment_cycle ? (
              <span className="block text-[14px]" style={{ color: 'var(--ink-3)' }}>
                {p.payment_cycle}
              </span>
            ) : null}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Pill tone={statusTone(p.status)}>{p.status}</Pill>
          {cats.slice(0, 3).map((c) => (
            <Pill key={c}>{CATEGORY_LABELS[c]}</Pill>
          ))}
          {cats.length > 3 ? <Pill>+{cats.length - 3}</Pill> : null}
        </div>

        <div
          className="flex items-center justify-between gap-2 border-t pt-2.5 text-[14px]"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}
        >
          <span className="tnum">
            {p.start_date ?? '?'} ~ {p.end_date ?? '종신'}
          </span>
          {Number(p.terms_doc_count) > 0 ? (
            <Pill tone="ok">약관 {p.terms_doc_count}건</Pill>
          ) : (
            <Pill tone="warn">약관 미수집</Pill>
          )}
        </div>
      </Card>
    );
  }

  return (
    <>
      <DataSourceNotice environment={dataEnvironment} />
      <SectionTitle meta="유지 중 계약 기준">보장 맵</SectionTitle>

      {preview ? <PreviewNotice>연결하면 우리 가족의 실제 격자로 바뀝니다</PreviewNotice> : null}

      <Card className="!px-3 !py-3.5">
        <div className="scroll-x">
          <table className="w-full border-collapse text-[14px]">
            <caption className="sr-only">
              구성원별 담보 카테고리 보유 현황. 빈 칸은 해당 담보가 없다는 뜻입니다.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="pb-2 text-left text-[13px] font-semibold"
                  style={{ color: 'var(--ink-3)' }}
                >
                  담보
                </th>
                {members.map((m) => (
                  <th
                    key={m.member_id}
                    scope="col"
                    className="pb-2 text-center text-[13px] font-semibold whitespace-nowrap"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {m.display_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const isCore = CORE_CATEGORIES.includes(cat.code);
                return (
                  <tr key={cat.code} style={{ borderTop: '1px solid var(--line)' }}>
                    <th
                      scope="row"
                      className="py-2 pr-2 text-left text-[14px] font-semibold whitespace-nowrap"
                    >
                      {cat.label}
                    </th>
                    {members.map((m) => {
                      const cell = byKey.get(`${m.member_id}::${cat.code}`);
                      const count = Number(cell?.coverage_count ?? 0);
                      const amount = Number(cell?.total_amount ?? 0);
                      const gap = isCore && count === 0;

                      return (
                        <td key={m.member_id} className="px-1 py-1.5 text-center">
                          {count > 0 ? (
                            <span
                              className="block rounded-[8px] px-1 py-1.5 text-[14px] font-bold"
                              style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)' }}
                            >
                              {shortWon(amount) || '있음'}
                            </span>
                          ) : gap ? (
                            <span
                              className="block rounded-[8px] px-1 py-1.5 text-[14px] font-bold"
                              style={{ background: 'var(--alert-soft)', color: 'var(--alert)' }}
                            >
                              공백
                            </span>
                          ) : (
                            <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <SectionTitle meta={`유지 ${activePolicies.length}건 · 만기·해지 ${inactivePolicies.length}건`}>
        계약 목록
      </SectionTitle>

      {policies.length === 0 ? (
        <Card>
          <p className="text-center text-[15px]" style={{ color: 'var(--ink-3)' }}>
            아직 수집된 계약이 없습니다.
          </p>
        </Card>
      ) : (
        <>
          {/* 유지 계약을 내보험다보여 유형 순서로 묶는다. 유형 안에서는 보험료 큰 순. */}
          {KIND_ORDER.filter((k) => (activeByKind.get(k)?.length ?? 0) > 0).map((kind) => (
            <section key={kind} className="flex flex-col gap-[14px]">
              <h3 className="mt-1 flex items-baseline gap-2 text-[16px] font-bold">
                {KIND_LABEL[kind]}
                <span className="text-[14px] font-medium" style={{ color: 'var(--ink-3)' }}>
                  {activeByKind.get(kind)!.length}건
                </span>
              </h3>
              {activeByKind.get(kind)!.map((p) => renderPolicy(p))}
            </section>
          ))}

          {/* 만기·해지 이력은 접어둔다. 지금의 보장이 아니라 과거 기록이다. */}
          {inactivePolicies.length > 0 ? (
            <details className="group">
              <summary
                className="card card-tap flex cursor-pointer items-center justify-between gap-3 text-[15px] font-semibold"
                style={{ color: 'var(--ink-2)' }}
              >
                만기·해지된 계약 {inactivePolicies.length}건 보기
                <span
                  className="text-[13px] font-medium group-open:hidden"
                  style={{ color: 'var(--ink-3)' }}
                >
                  펼치기
                </span>
              </summary>
              <div className="mt-[14px] flex flex-col gap-[14px]">
                {inactivePolicies.map((p) => renderPolicy(p))}
              </div>
            </details>
          ) : null}
        </>
      )}

      {preview ? <ConnectCard /> : null}

      <Disclaimer extra="금액은 약관상 가입금액입니다." />
    </>
  );
}
