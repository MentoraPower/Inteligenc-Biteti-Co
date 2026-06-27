-- Permitir mesmo telefone em contas diferentes (isolamento de contas)
-- Primeiro remover a constraint antiga de unicidade em phone
ALTER TABLE whatsapp_chats DROP CONSTRAINT IF EXISTS whatsapp_chats_phone_key;

-- Criar nova constraint de unicidade composta (phone + session_id)
-- Isso permite que o mesmo telefone tenha chats separados para cada conta (session_id)
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_chats_phone_session_id_unique 
ON whatsapp_chats (phone, COALESCE(session_id, ''));

-- Adicionar comentário explicativo
COMMENT ON INDEX whatsapp_chats_phone_session_id_unique IS 'Permite que o mesmo telefone tenha chats separados para diferentes contas WhatsApp (session_id)';