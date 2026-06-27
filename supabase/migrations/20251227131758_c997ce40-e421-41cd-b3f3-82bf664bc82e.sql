-- Add assigned_to column to leads table for team member assignment
ALTER TABLE public.leads 
ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;