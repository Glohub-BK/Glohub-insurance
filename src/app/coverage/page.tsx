import {
  CORE_CATEGORIES,
  getCoverageMatrix,
  getCoverages,
  getMembers,
  getPolicies,
} from '@/lib/repo/dashboard';
import { getCurrentHousehold } from '@/lib/repo/household';
import { CATEGORY_LABELS } from '@/lib/domain/coverage-category';
import { Card, Disclaimer, Pill, SectionTitle, Won, shortWon } from '../_components/ui';
import { EmptyHousehold } from '../_components/empty';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  flat_rate: '정액형',
  actual_loss: '실손형',
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
  const household = await getCurrentHousehold();
  if (!household) return <EmptyHousehold />;

  const [members, matrix, policies, coverages] = await Promise.all([
    getMembers(household.id),
    getCoverageMatrix(household.id),
    getPolicies(household.id),
    getCoverages(household.id),
  ]);

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

  return (
    <>
      <SectionTitle meta="유지 중 계약 기준">보장 맵</SectionTitle>

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

      <SectionTitle meta={`${policies.length}건`}>계약 목록</SectionTitle>

      {policies.length === 0 ? (
        <Card>
          <p className="text-center text-[15px]" style={{ color: 'var(--ink-3)' }}>
            아직 수집된 계약이 없습니다.
          </p>
        </Card>
      ) : (
        policies.map((p) => {
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
                <Pill>{KIND_LABEL[p.contract_kind] ?? p.contract_kind}</Pill>
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
        })
      )}

      <Disclaimer extra="금액은 약관상 가입금액입니다." />
    </>
  );
}
