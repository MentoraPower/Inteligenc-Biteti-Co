-- Clean up invalid photo_url values in whatsapp_groups
UPDATE whatsapp_groups 
SET photo_url = NULL 
WHERE photo_url IN ('changed', 'removed') 
   OR (photo_url IS NOT NULL AND photo_url NOT LIKE 'http%');

-- Clean up invalid photo_url values in whatsapp_chats for groups
UPDATE whatsapp_chats 
SET photo_url = NULL 
WHERE phone LIKE '%@g.us' 
  AND (photo_url IN ('changed', 'removed') 
       OR (photo_url IS NOT NULL AND photo_url NOT LIKE 'http%'));