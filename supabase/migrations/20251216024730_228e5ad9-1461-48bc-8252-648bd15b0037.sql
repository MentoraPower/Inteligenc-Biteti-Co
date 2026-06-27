-- Add photo_url column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS photo_url text;