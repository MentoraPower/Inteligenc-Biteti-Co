-- Delete the test group "Grupo teste"
DELETE FROM whatsapp_groups WHERE id = '9839eb3c-56e2-474c-a3b4-62e3ab3271fb';

-- Also delete from whatsapp_chats if it exists there
DELETE FROM whatsapp_chats WHERE phone = '120363422343323394@g.us';