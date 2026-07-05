-- Fix timer timing: round the wake time UP to the next full minute so the pg_cron
-- job fires at or after next_run_at (it fires at the start of a minute; the old
-- floor version could fire before the due time and leave the run stuck).
create or replace function public.schedule_wake(wake_at timestamptz)
returns void language plpgsql security definer set search_path = public as $fn$
declare t timestamptz; jobname text; cronexpr text;
begin
  t := date_trunc('minute', wake_at);
  if t < wake_at then t := t + interval '1 minute'; end if;
  if t <= now() then t := date_trunc('minute', now()) + interval '1 minute'; end if;
  jobname := 'wake_' || to_char(t at time zone 'UTC', 'YYYYMMDDHH24MI');
  cronexpr := to_char(t at time zone 'UTC', 'MI HH24 DD MM') || ' *';
  perform cron.schedule(jobname, cronexpr,
    'select public.invoke_process_automations(); select cron.unschedule(' || quote_literal(jobname) || ');');
exception when others then null;
end $fn$;
