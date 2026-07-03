-- Email templates created in the visual editor and reused across campaigns.
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text,
  body_html text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS et_all ON email_templates;
CREATE POLICY et_all ON email_templates FOR ALL TO public USING (true) WITH CHECK (true);
