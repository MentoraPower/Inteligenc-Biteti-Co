-- Execution engine for Mail automations — EVENT-DRIVEN (no polling cron).
-- Enroll a lead when it enters a trigger pipeline, then invoke the processor
-- immediately. Timers schedule a single self-removing wake at the exact time.

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.email_automations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  step_index int not null default 0,
  status text not null default 'active', -- active | done
  last_error text,
  next_run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, lead_id)
);

create index if not exists idx_automation_runs_due
  on public.automation_runs (next_run_at) where status = 'active';

alter table public.automation_runs enable row level security;

-- Fire-and-forget invoke of the process-automations edge function via pg_net.
-- NOTE: embeds the project's public anon key at deploy time (replace <ANON_KEY>).
create or replace function public.invoke_process_automations()
returns void language plpgsql security definer set search_path = public as $fn$
begin
  perform net.http_post(
    url := 'https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/process-automations',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
    body := '{}'::jsonb
  );
end $fn$;

-- Schedule a single wake (pg_cron one-off) at a timer's due time; it invokes the
-- processor and unschedules itself. Same-minute wakes reuse one job name.
create or replace function public.schedule_wake(wake_at timestamptz)
returns void language plpgsql security definer set search_path = public as $fn$
declare t timestamptz := wake_at; jobname text; cronexpr text;
begin
  if t < now() then t := now() + interval '1 minute'; end if;
  jobname := 'wake_' || to_char(t at time zone 'UTC', 'YYYYMMDDHH24MI');
  cronexpr := to_char(t at time zone 'UTC', 'MI HH24 DD MM') || ' *';
  perform cron.schedule(jobname, cronexpr,
    'select public.invoke_process_automations(); select cron.unschedule(' || quote_literal(jobname) || ');');
exception when others then null;
end $fn$;

-- Enroll a lead when it enters (or is created in) a pipeline that is the trigger
-- of an active automation, then invoke the processor right away (event-driven).
create or replace function public.enroll_lead_in_automations()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare inserted int;
begin
  if new.pipeline_id is not null and (tg_op = 'INSERT' or new.pipeline_id is distinct from old.pipeline_id) then
    with ins as (
      insert into public.automation_runs (automation_id, lead_id, step_index, status, next_run_at)
      select a.id, new.id, 0, 'active', now()
      from public.email_automations a
      where a.is_active = true and a.trigger_pipeline_id = new.pipeline_id
      on conflict (automation_id, lead_id) do nothing
      returning 1
    )
    select count(*) into inserted from ins;
    if inserted > 0 then perform public.invoke_process_automations(); end if;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_enroll_lead_automations on public.leads;
create trigger trg_enroll_lead_automations
  after insert or update of pipeline_id on public.leads
  for each row execute function public.enroll_lead_in_automations();
