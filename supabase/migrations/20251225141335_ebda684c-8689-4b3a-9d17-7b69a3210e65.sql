-- Add auto_tag column to crm_webhooks table for automatic tag creation when lead is created
ALTER TABLE public.crm_webhooks 
ADD COLUMN IF NOT EXISTS auto_tag_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_tag_color text DEFAULT '#6366f1';