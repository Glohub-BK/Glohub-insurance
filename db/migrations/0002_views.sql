-- 대시보드가 바로 읽는 뷰. 화면 쿼리를 단순하게 유지한다.

-- 구성원별 마지막 동기화 상태
create view member_sync_status as
select
  m.id                as member_id,
  m.household_id,
  m.display_name,
  m.relation,
  s.id                as last_run_id,
  s.status            as last_run_status,
  s.requested_at      as last_synced_at,
  s.policy_count      as last_policy_count
from member m
left join lateral (
  select * from sync_run r
  where r.member_id = m.id
  order by r.requested_at desc
  limit 1
) s on true;

-- 보장 맵: 구성원 × 담보 카테고리 격자. 빈 칸이 보장 공백이다.
create view coverage_matrix as
select
  m.household_id,
  m.id                        as member_id,
  m.display_name,
  cc.code                     as category,
  cc.label                    as category_label,
  cc.sort_order,
  -- 그 카테고리에 실제로 담보가 걸린 계약만 센다. 0이면 보장 공백이다.
  count(distinct c.policy_id)                       as policy_count,
  count(c.id)                                       as coverage_count,
  coalesce(sum(c.amount), 0)                        as total_amount,
  count(*) filter (where c.id is not null and c.confidence < 0.85) as needs_review_count
from member m
cross join coverage_category cc
left join policy   p on p.member_id = m.id and p.status = '유지'
left join coverage c on c.policy_id = p.id and c.category = cc.code
                    and c.coverage_status not in ('해지','소멸','실효')
group by m.household_id, m.id, m.display_name, cc.code, cc.label, cc.sort_order;

-- 계약 요약 + 담보 개수
create view policy_summary as
select
  p.*,
  m.display_name              as member_name,
  m.household_id,
  (select count(*) from coverage c where c.policy_id = p.id) as coverage_count,
  (select count(*) from document d where d.policy_id = p.id and d.kind = '약관') as terms_doc_count
from policy p
join member m on m.id = p.member_id;
