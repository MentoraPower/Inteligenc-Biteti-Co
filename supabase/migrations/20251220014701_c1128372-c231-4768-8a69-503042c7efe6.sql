-- Add type column to crm_sub_origins (tarefas or calendario)
ALTER TABLE public.crm_sub_origins
ADD COLUMN tipo text NOT NULL DEFAULT 'tarefas' CHECK (tipo IN ('tarefas', 'calendario'));