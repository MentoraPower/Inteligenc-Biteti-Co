-- Add preheader column to scheduled_emails table
ALTER TABLE public.scheduled_emails 
ADD COLUMN IF NOT EXISTS preheader TEXT;

-- Add preheader column to sent_emails table for tracking
ALTER TABLE public.sent_emails 
ADD COLUMN IF NOT EXISTS preheader TEXT;