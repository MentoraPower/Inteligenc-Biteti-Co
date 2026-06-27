-- Add no show field to calendar_appointments
ALTER TABLE public.calendar_appointments 
ADD COLUMN is_noshow boolean DEFAULT false;