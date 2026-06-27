-- Update email settings to use emilly@biteti.com.br
UPDATE email_settings 
SET from_email = 'emilly@biteti.com.br', 
    from_name = 'Emilly Biteti',
    updated_at = now()
WHERE id = 'f3480c5e-8618-46af-953b-2293e121e05e';