-- Add conversation_id column to dispatch_jobs to link dispatches to conversations
ALTER TABLE public.dispatch_jobs 
ADD COLUMN conversation_id uuid REFERENCES public.dispatch_conversations(id) ON DELETE SET NULL;