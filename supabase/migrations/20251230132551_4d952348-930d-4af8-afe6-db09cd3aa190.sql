-- Enable REPLICA IDENTITY FULL for complete row data in realtime events
ALTER TABLE dispatch_conversations REPLICA IDENTITY FULL;

-- Add table to realtime publication for INSERT/UPDATE/DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_conversations;