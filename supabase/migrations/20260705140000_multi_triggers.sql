-- Multiple entry triggers per automation: enrollment matches ANY trigger in
-- flow_steps->'triggers' (array), keeping backward-compat with the old single
-- flow_steps->'trigger' object and the trigger_pipeline_id column.
create or replace function public.enroll_lead_in_automations()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare inserted int;
begin
  if new.pipeline_id is not null and (tg_op = 'INSERT' or new.pipeline_id is distinct from old.pipeline_id) then
    with ins as (
      insert into public.automation_runs (automation_id, lead_id, step_index, status, next_run_at)
      select a.id, new.id, 0, 'active', now()
      from public.email_automations a
      where a.is_active = true and (
        a.trigger_pipeline_id = new.pipeline_id
        or exists (
          select 1 from jsonb_array_elements(coalesce(a.flow_steps->'triggers','[]'::jsonb)) tg
          where tg->>'pipelineId' = new.pipeline_id::text
        )
      )
      returning 1
    )
    select count(*) into inserted from ins;
    if inserted > 0 then perform public.invoke_process_automations(); end if;
  end if;
  return new;
end $fn$;

create or replace function public.enroll_lead_on_tag()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare inserted int; v_lead uuid; v_tag text; v_type text;
begin
  if tg_op = 'INSERT' then v_lead := new.lead_id; v_tag := new.name; v_type := 'tag_added';
  else v_lead := old.lead_id; v_tag := old.name; v_type := 'tag_removed';
  end if;
  with ins as (
    insert into public.automation_runs (automation_id, lead_id, step_index, status, next_run_at)
    select a.id, v_lead, 0, 'active', now()
    from public.email_automations a
    where a.is_active = true and (
      (a.flow_steps->'trigger'->>'type' = v_type and a.flow_steps->'trigger'->>'tagName' = v_tag)
      or exists (
        select 1 from jsonb_array_elements(coalesce(a.flow_steps->'triggers','[]'::jsonb)) tg
        where tg->>'type' = v_type and tg->>'tagName' = v_tag
      )
    )
    returning 1
  )
  select count(*) into inserted from ins;
  if inserted > 0 then perform public.invoke_process_automations(); end if;
  return coalesce(new, old);
end $fn$;
