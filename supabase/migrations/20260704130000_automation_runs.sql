-- Execution engine for Mail automations: enroll leads when they enter a
-- trigger pipeline, then process each run (send emails via Resend / wait on timers).

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

-- Enroll a lead when it enters (or is created in) a pipeline that is the trigger
-- of an active automation. No duplicates; not retroactive.
create or replace function public.enroll_lead_in_automations()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.pipeline_id is not null and (tg_op = 'INSERT' or new.pipeline_id is distinct from old.pipeline_id) then
    insert into public.automation_runs (automation_id, lead_id, step_index, status, next_run_at)
    select a.id, new.id, 0, 'active', now()
    from public.email_automations a
    where a.is_active = true and a.trigger_pipeline_id = new.pipeline_id
    on conflict (automation_id, lead_id) do nothing;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_enroll_lead_automations on public.leads;
create trigger trg_enroll_lead_automations
  after insert or update of pipeline_id on public.leads
  for each row execute function public.enroll_lead_in_automations();

-- Cron (every minute) to invoke the process-automations edge function is created
-- separately via cron.schedule (pg_cron + pg_net).
