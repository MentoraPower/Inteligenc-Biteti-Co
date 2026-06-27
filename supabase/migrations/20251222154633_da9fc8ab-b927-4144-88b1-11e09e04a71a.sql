-- Delete orphan "Grupo teste" that no longer exists on WhatsApp
DELETE FROM whatsapp_group_participants WHERE group_jid = '120363422343323394@g.us';
DELETE FROM whatsapp_groups WHERE group_jid = '120363422343323394@g.us';