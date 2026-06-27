-- Fix Disparo conversation deletion by cascading dependent records

BEGIN;

-- When a conversation is deleted, its jobs must be deleted (not SET NULL) to avoid violating dispatch_jobs_source_check
ALTER TABLE public.dispatch_jobs
  DROP CONSTRAINT IF EXISTS dispatch_jobs_conversation_id_fkey;

ALTER TABLE public.dispatch_jobs
  ADD CONSTRAINT dispatch_jobs_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES public.dispatch_conversations(id)
  ON DELETE CASCADE;

-- When a job is deleted, its sent_emails must be deleted too
ALTER TABLE public.sent_emails
  DROP CONSTRAINT IF EXISTS sent_emails_dispatch_job_id_fkey;

ALTER TABLE public.sent_emails
  ADD CONSTRAINT sent_emails_dispatch_job_id_fkey
  FOREIGN KEY (dispatch_job_id)
  REFERENCES public.dispatch_jobs(id)
  ON DELETE CASCADE;

-- When a sent_email is deleted, its tracking events must be deleted too
ALTER TABLE public.email_tracking_events
  DROP CONSTRAINT IF EXISTS email_tracking_events_sent_email_id_fkey;

ALTER TABLE public.email_tracking_events
  ADD CONSTRAINT email_tracking_events_sent_email_id_fkey
  FOREIGN KEY (sent_email_id)
  REFERENCES public.sent_emails(id)
  ON DELETE CASCADE;

COMMIT;