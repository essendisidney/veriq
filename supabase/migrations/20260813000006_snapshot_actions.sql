-- Snapshot packs include open management actions (no evidence contents).

create or replace function public.veriq_api_snapshot(p_token_hash text, p_company text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_kind text;
  v_org public.organizations%rowtype;
  v_score public.scores%rowtype;
  v_scan public.scans%rowtype;
  v_findings jsonb;
  v_actions jsonb;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select a.organization_id, coalesce(a.metadata ->> 'kind', 'full')
    into v_org_id, v_kind
  from public.assets a
  where a.metadata ->> 'keyHash' = p_token_hash
    and a.type in ('api_key', 'share_link')
  limit 1;

  if v_org_id is null then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select * into v_org
  from public.organizations o
  where o.id = v_org_id;

  if not found then
    return jsonb_build_object('error', 'forbidden');
  end if;

  if p_company is not null and length(trim(p_company)) > 0 then
    if v_org.id::text <> p_company and v_org.slug <> p_company then
      return jsonb_build_object('error', 'forbidden');
    end if;
  end if;

  select * into v_score
  from public.scores s
  where s.organization_id = v_org.id
  order by s.created_at desc
  limit 1;

  select * into v_scan
  from public.scans s
  where s.organization_id = v_org.id
    and s.status = 'completed'
  order by s.created_at desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'title', r.title,
        'description', r.description,
        'severity', r.severity,
        'category', r.category,
        'confidence', r.confidence,
        'status', r.status,
        'why_it_matters', r.why_it_matters,
        'recommendation', r.recommendation,
        'owner_role', r.owner_role,
        'fingerprint', r.fingerprint
      )
    ),
    '[]'::jsonb
  )
  into v_findings
  from (
    select *
    from public.risks r
    where r.organization_id = v_org.id
      and r.status = 'open'
    order by
      case r.severity
        when 'critical' then 0
        when 'high' then 1
        when 'medium' then 2
        when 'low' then 3
        else 4
      end,
      r.created_at desc
    limit 20
  ) r;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'owner_role', a.owner_role,
        'priority', a.priority,
        'deadline', a.deadline,
        'status', a.status
      )
    ),
    '[]'::jsonb
  )
  into v_actions
  from (
    select *
    from public.actions a
    where a.organization_id = v_org.id
      and a.status in ('open', 'in_progress')
    order by
      case a.priority
        when 'critical' then 0
        when 'high' then 1
        when 'medium' then 2
        else 3
      end,
      a.deadline asc nulls last
    limit 12
  ) a;

  return jsonb_build_object(
    'pack', v_kind,
    'company', jsonb_build_object(
      'id', v_org.id,
      'slug', v_org.slug,
      'name', v_org.name,
      'country', v_org.country,
      'industry', v_org.industry
    ),
    'scanned_at', v_scan.completed_at,
    'score', v_score.overall,
    'cybersecurity', v_score.cybersecurity,
    'regulatory', v_score.regulatory,
    'technology', v_score.technology,
    'operational', v_score.operational,
    'vendor', v_score.vendor,
    'financial', v_score.financial,
    'data', v_score.data,
    'ai', v_score.ai,
    'reputation', v_score.reputation,
    'findings', coalesce(v_findings, '[]'::jsonb),
    'actions', coalesce(v_actions, '[]'::jsonb),
    'summary', coalesce(v_scan.summary, '{}'::jsonb),
    'disclaimer', 'VERIQ is intelligence, not a legal, audit, valuation or credit opinion. Final decisions remain with authorised professionals.'
  );
end;
$$;
