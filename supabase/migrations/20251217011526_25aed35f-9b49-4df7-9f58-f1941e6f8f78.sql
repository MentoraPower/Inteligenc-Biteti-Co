-- Update existing chats with last message status from their most recent message
WITH latest_messages AS (
  SELECT DISTINCT ON (chat_id) 
    chat_id, 
    from_me, 
    status
  FROM whatsapp_messages 
  ORDER BY chat_id, created_at DESC
)
UPDATE whatsapp_chats 
SET 
  last_message_from_me = lm.from_me,
  last_message_status = lm.status
FROM latest_messages lm
WHERE whatsapp_chats.id = lm.chat_id;