-- Add unique constraint on user_id for user_permissions table
-- This allows upsert operations to work correctly
ALTER TABLE public.user_permissions 
ADD CONSTRAINT user_permissions_user_id_unique UNIQUE (user_id);