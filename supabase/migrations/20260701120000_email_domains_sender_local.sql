-- Separate the email local part (before @) from the sender display name.
-- sender_name now holds the person/brand display name; sender_local holds the
-- email username shown as sender_local@domain.
ALTER TABLE email_domains
ADD COLUMN IF NOT EXISTS sender_local TEXT;
