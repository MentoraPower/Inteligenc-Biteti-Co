-- Add permission columns for creating origins and sub-origins
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS can_create_origins boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_create_sub_origins boolean NOT NULL DEFAULT false;