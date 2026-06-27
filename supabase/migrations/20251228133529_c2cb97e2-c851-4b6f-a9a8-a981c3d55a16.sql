-- Enable pg_cron and pg_net extensions (should already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the continue-dispatch cron job to run every 30 seconds
SELECT cron.schedule(
  'continue-dispatch-every-30s',
  '30 seconds',
  $$
  SELECT
    net.http_post(
      url:='https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/continue-dispatch',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZGZ3a2Noc3VtZ2R2Y3JvYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTkyOTUsImV4cCI6MjA4MDg3NTI5NX0.bbPtEz54fczTpjsxCaLW_VMHNm1tTutMJr_gpM6GE_M'
      ),
      body:='{}'::jsonb
    ) as request_id;
  $$
);