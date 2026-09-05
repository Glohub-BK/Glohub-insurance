import type { CoverageRow, MatrixCell, PolicyRow } from '../repo/dashboard';
import { CATEGORY_LABELS, CATEGORY_SORT, COVERAGE_CATEGORIES } from './coverage-category';

/**
 * 계약을 실제 보장 대상(피보험자)에게 귀속시킨다.
 *
 * 신정원 조회는 **조회한 사람이 계약자 또는 피보험자인 계약**을 돌려준다. 그래서
 * 아빠가 조회하면 아빠가 계약자이고 피보험자가 아내·자녀인 계약이 함께 내려온다 —
 * 실사례: 계약자 본인 조회에 피보험자 '박은진'(배우자) 계약이 포함돼 있었다.
 *
 * 이 계약들을 조회자 이름 밑에 쌓으면 보장 맵이 거짓말을 한다: 아빠 칸은 부풀고
 * 아내·자녀 칸은 "보장 공백"으로 나온다. 보장은 피보험자의 것이다.
 *
 * 귀속 규칙:
 *   - 계약의 피보험자명이 가족 구성원 이름과 일치하면(공백 무시) 그 구성원에게.
 *   - 일치하는 구성원이 없거나 피보험자명이 비었으면 조회자에게 (원래 동작).
 *   - 마스킹된 이름(김*진)은 매칭하지 않는다 — 어설픈 추정 귀속이 오귀속보다 나쁘다.
 *
 * 그래서 미성년 자녀는 로그인이 필요 없다: 계약자가 될 수 없고 신정원 계정도
 * 사실상 못 만든다. 이름만 구성원으로 등록하면 부모 계약이 자동으로 귀속된다.
 * 배우자는 다르다 — 배우자 스스로 계약자인 보험은 본인 인증으로만 가져올 수 있다.
 */

function squashName(name: string | null | undefined): string {
  return (name ?? '').replace(/\s/g, '');
}

function isMasked(name: string): boolean {
  return name.includes('*');
}

/** 이 계약이 누구 것인지 — 구성원 표시 이름을 돌려준다. */
export function attributedNameOf(
  policy: { member_name: string; insured_name: string | null },
  memberNames: string[],
): string {
  const insured = squashName(policy.insured_name);
  if (insured.length === 0 || isMasked(insured)) return policy.member_name;
  const hit = memberNames.find((n) => squashName(n) === insured);
  return hit ?? policy.member_name;
}

/**
 * 계약의 피보험자 중 아직 가족 구성원이 아닌 이름들.
 *
 * 화면이 "피보험자 '박은진' 계약이 2건 있어요 — 가족으로 추가할까요?" 를 만들 근거다.
 * 유지 계약만 본다. 마스킹된 이름은 추가를 권할 수 없으므로 제외한다.
 */
export function unmatchedInsuredNames(
  policies: Pick<PolicyRow, 'status' | 'member_name' | 'insured_name'>[],
  memberNames: string[],
): { name: string; count: number }[] {
  const known = new Set(memberNames.map(squashName));
  const counts = new Map<string, { name: string; count: number }>();
  for (const p of policies) {
    if (p.status !== '유지') continue;
    const raw = (p.insured_name ?? '').trim();
    const key = squashName(raw);
    if (key.length === 0 || isMasked(key) || known.has(key)) continue;
    // 조회자 본인 이름과 같은 표기 변형도 구성원으로 이미 있는 셈이다.
    if (key === squashName(p.member_name)) continue;
    const found = counts.get(key);
    if (found) found.count += 1;
    else counts.set(key, { name: raw, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

const EXCLUDED_COVERAGE_STATUSES = ['해지', '소멸', '실효'];

/**
 * 피보험자 귀속 기준의 보장 맵.
 *
 * SQL 뷰(coverage_matrix)는 계약을 조회자(member_id)에게 귀속시킨다. 여기서는
 * 같은 격자를 피보험자명 매칭으로 다시 짠다 — 뷰와 같은 모양(문자열 숫자 포함)을
 * 유지해 화면 코드를 바꾸지 않는다. 구성원 × 전체 카테고리를 모두 채우고,
 * 0인 칸이 곧 보장 공백이다.
 */
export function buildAttributedMatrix(
  members: { member_id: string; display_name: string }[],
  policies: Pick<PolicyRow, 'id' | 'status' | 'member_name' | 'insured_name'>[],
  coverages: Pick<CoverageRow, 'policy_id' | 'category' | 'amount' | 'coverage_status' | 'confidence'>[],
): MatrixCell[] {
  const names = members.map((m) => m.display_name);
  const ownerOf = new Map<string, string>(); // policy_id → 구성원 이름
  for (const p of policies) {
    if (p.status !== '유지') continue;
    ownerOf.set(p.id, attributedNameOf(p, names));
  }

  type Acc = { policyIds: Set<string>; count: number; total: number; review: number };
  const acc = new Map<string, Acc>(); // `${이름}::${category}`
  for (const c of coverages) {
    const owner = ownerOf.get(c.policy_id);
    if (!owner) continue; // 유지 계약이 아니다
    if (EXCLUDED_COVERAGE_STATUSES.includes(c.coverage_status)) continue;
    const key = `${owner}::${c.category}`;
    const cell = acc.get(key) ?? { policyIds: new Set(), count: 0, total: 0, review: 0 };
    cell.policyIds.add(c.policy_id);
    cell.count += 1;
    cell.total += c.amount === null ? 0 : Number(c.amount);
    if (c.confidence !== null && Number(c.confidence) < 0.85) cell.review += 1;
    acc.set(key, cell);
  }

  return members.flatMap((m) =>
    COVERAGE_CATEGORIES.map((category) => {
      const cell = acc.get(`${m.display_name}::${category}`);
      return {
        member_id: m.member_id,
        display_name: m.display_name,
        category,
        category_label: CATEGORY_LABELS[category],
        sort_order: CATEGORY_SORT[category],
        policy_count: String(cell?.policyIds.size ?? 0),
        coverage_count: String(cell?.count ?? 0),
        total_amount: String(cell?.total ?? 0),
        needs_review_count: String(cell?.review ?? 0),
      };
    }),
  );
}

/** 가족 추가 입력 검증. API 라우트가 부르지만 네트워크를 모르는 순수 함수다. */
export type NewMemberInput = {
  displayName: string;
  relation: '배우자' | '자녀' | '부모' | '기타';
  isMinor: boolean;
};

const RELATIONS = ['배우자', '자녀', '부모', '기타'] as const;

export function parseNewMemberInput(
  body: unknown,
): { ok: true; value: NewMemberInput } | { ok: false; message: string } {
  const b = body as { name?: unknown; relation?: unknown; isMinor?: unknown; guardianConsent?: unknown } | null;
  const name = typeof b?.name === 'string' ? b.name.trim() : '';
  if (name.length < 1 || name.length > 20) {
    return { ok: false, message: '이름은 1~20자로 입력해주세요.' };
  }
  const relation = RELATIONS.find((r) => r === b?.relation);
  if (!relation) return { ok: false, message: '관계를 선택해주세요.' };
  const isMinor = b?.isMinor === true;
  if (isMinor && relation !== '자녀') return { ok: false, message: '미성년 등록은 자녀만 가능합니다.' };
  // 미성년자는 법정대리인 동의가 전제다. 동의 시각은 서버가 기록한다.
  if (isMinor && b?.guardianConsent !== true) {
    return { ok: false, message: '미성년 자녀는 법정대리인 동의가 필요합니다.' };
  }
  return { ok: true, value: { displayName: name, relation, isMinor } };
}
