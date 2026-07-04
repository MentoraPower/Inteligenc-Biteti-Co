-- Tag-based automation triggers: enroll a lead when a tag is added/removed and it
-- matches an active automation whose flow_steps.trigger is a tag trigger.
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
    where a.is_active = true
      and a.flow_steps->'trigger'->>'type' = v_type
      and a.flow_steps->'trigger'->>'tagName' = v_tag
    on conflict (automation_id, lead_id) do nothing
    returning 1
  )
  select count(*) into inserted from ins;
  if inserted > 0 then perform public.invoke_process_automations(); end if;
  return coalesce(new, old);
end $fn$;

drop trigger if exists trg_enroll_lead_on_tag on public.lead_tags;
create trigger trg_enroll_lead_on_tag
  after insert or delete on public.lead_tags
  for each row execute function public.enroll_lead_on_tag();
