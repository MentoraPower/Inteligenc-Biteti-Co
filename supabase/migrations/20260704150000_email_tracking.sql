-- Email tracking for automations: sends + open/click events, and per-step stats.
create table if not exists public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  lead_name text,
  lead_email text,
  subject text,
  body_html text,
  status text default 'sent',
  resend_id text,
  automation_id uuid,
  step_id text,
  sent_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table public.sent_emails enable row level security;
create index if not exists idx_sent_emails_automation on public.sent_emails(automation_id);

create table if not exists public.email_tracking_events (
  id uuid primary key default gen_random_uuid(),
  sent_email_id uuid,
  scheduled_email_id uuid,
  event_type text not null, -- open | click
  url text,
  user_agent text,
  ip_address text,
  created_at timestamptz default now()
);
alter table public.email_tracking_events enable row level security;
create index if not exists idx_ete_sent on public.email_tracking_events(sent_email_id);

-- Per-step aggregates for the flow UI.
create or replace function public.automation_step_stats(p_automation_id uuid)
returns table(step_id text, sent bigint, opened bigint, clicked bigint)
language sql stable security definer set search_path = public as $fn$
  select s.step_id,
    count(*) filter (where s.status = 'sent') as sent,
    count(distinct o.sent_email_id) as opened,
    count(distinct c.sent_email_id) as clicked
  from public.sent_emails s
  left join public.email_tracking_events o on o.sent_email_id = s.id and o.event_type = 'open'
  left join public.email_tracking_events c on c.sent_email_id = s.id and c.event_type = 'click'
  where s.automation_id = p_automation_id
  group by s.step_id;
$fn$;
grant execute on function public.automation_step_stats(uuid) to anon, authenticated;
