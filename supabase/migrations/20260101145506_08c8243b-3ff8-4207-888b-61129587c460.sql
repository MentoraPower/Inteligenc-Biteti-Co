-- Mover todas as origens existentes para o workspace Scale Ask
UPDATE public.crm_origins 
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL OR workspace_id != '00000000-0000-0000-0000-000000000001';

-- Mover conversas de disparo existentes para Scale Ask
UPDATE public.dispatch_conversations 
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;

-- Mover dashboards existentes para Scale Ask
UPDATE public.dashboards 
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;

-- Mover calendar_appointments existentes para Scale Ask
UPDATE public.calendar_appointments 
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;

-- Mover dispatch_jobs existentes para Scale Ask
UPDATE public.dispatch_jobs 
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;

-- Mover quick_messages existentes para Scale Ask
UPDATE public.quick_messages 
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;

-- Mover email_automations existentes para Scale Ask
UPDATE public.email_automations 
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;

-- Mover email_templates existentes para Scale Ask
UPDATE public.email_templates 
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;