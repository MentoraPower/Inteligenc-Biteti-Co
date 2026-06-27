-- Add session_id column to quick_messages for per-account isolation
ALTER TABLE quick_messages ADD COLUMN IF NOT EXISTS session_id text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_quick_messages_session_id ON quick_messages(session_id);