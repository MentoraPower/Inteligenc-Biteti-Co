-- Schedule the process-scheduled-emails function to run every minute
SELECT cron.schedule(
  'process-scheduled-emails-every-minute',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/process-scheduled-emails',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZGZ3a2Noc3VtZ2R2Y3JvYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTkyOTUsImV4cCI6MjA4MDg3NTI5NX0.bbPtEz54fczTpjsxCaLW_VMHNm1tTutMJr_gpM6GE_M"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);