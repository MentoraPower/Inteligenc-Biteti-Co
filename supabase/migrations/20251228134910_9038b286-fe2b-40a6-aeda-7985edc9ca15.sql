-- Add processing lock column to prevent concurrent processing
ALTER TABLE public.dispatch_jobs 
ADD COLUMN IF NOT EXISTS processing_lock_until timestamp with time zone DEFAULT NULL;