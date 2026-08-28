import { CORE_CATEGORIES } from '@/lib/repo/dashboard';
import { getHouseholdView } from '@/lib/repo/view-data';
import { CATEGORY_LABELS } from '@/lib/domain/coverage-category';
import { Card, Disclaimer, SectionTitle, shortWon } from '../_components/ui';
import { isSaneTotal } from '@/lib/domain/coverage-basis';
import { ConnectCard, PreviewNotice } from '../_components/connect';
import { DataSourceNotice } from '../_components/data-source';
import { DataErrorCard } from '../_components/data-error';
import { PolicyList, type PolicyGroupData } from './policy-list';

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

  // 클라이언트 토글에 넘길 직렬화 데이터. 유형 순서는 내보험다보여를 따르고,
  // 만기·해지는 마지막 탭으로 — 과거 기록이지 지금의 보장이 아니다.
  const toCard = (p: (typeof policies)[number]) => ({
    id: p.id,
    productName: p.product_name,
    insurerName: p.insurer_name,
    memberName: p.member_name,
    premium: p.premium === null ? null : Number(p.premium),
    paymentCycle: p.payment_cycle,
    status: p.status,
    start: p.start_date,
    end: p.end_date,
    termsCount: Number(p.terms_doc_count),
    cats: Array.from(new Set((covByPolicy.get(p.id) ?? []).map((c) => CATEGORY_LABELS[c.category]))),
  });

  const groups: PolicyGroupData[] = [
    ...KIND_ORDER.map((kind) => ({
      key: kind,
      label: KIND_LABEL[kind],
      policies: (activeByKind.get(kind) ?? []).map(toCard),
    })),
    { key: 'inactive', label: '만기·해지', policies: inactivePolicies.map(toCard) },
  ];

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
                              {isSaneTotal(amount) ? shortWon(amount) : `${count}개`}
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

      {/* 유형 칩 토글 — 한 번에 한 유형만 펼친다. 세로로 전부 나열하면
          계약 열 건에 화면이 한없이 길어진다. */}
      <PolicyList groups={groups} />

      {preview ? <ConnectCard /> : null}

      <Disclaimer extra="금액은 약관상 가입금액입니다." />
    </>
  );
}
