-- Reset the name for contacts incorrectly saved as "Suporte Biteti Academy"
-- The name will be updated correctly when the client sends their next message

UPDATE whatsapp_chats 
SET name = NULL, updated_at = now()
WHERE name = 'Suporte Biteti Academy';