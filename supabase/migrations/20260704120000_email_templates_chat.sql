-- Persist the AI chat history alongside the generated email (body_html) per template.
ALTER TABLE email_templates
ADD COLUMN IF NOT EXISTS chat jsonb NOT NULL DEFAULT '[]'::jsonb;
