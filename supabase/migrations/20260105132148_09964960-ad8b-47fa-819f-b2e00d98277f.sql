-- Delete all "Nova conversa" entries (duplicate/empty conversations)
DELETE FROM dispatch_conversations WHERE title = 'Nova conversa';