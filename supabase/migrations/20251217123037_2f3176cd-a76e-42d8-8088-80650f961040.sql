-- Atualizar configurações de email para usar o novo domínio
UPDATE email_settings 
SET 
  from_email = 'contato@mentorabeautyacademy.com.br',
  from_name = 'Mentora Beauty Academy',
  updated_at = now()
WHERE id = 'f3480c5e-8618-46af-953b-2293e121e05e';