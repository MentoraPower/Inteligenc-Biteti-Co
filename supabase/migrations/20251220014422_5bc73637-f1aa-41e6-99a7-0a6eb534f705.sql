-- Add sub_origin_id to calendar_appointments
ALTER TABLE public.calendar_appointments
ADD COLUMN sub_origin_id uuid REFERENCES public.crm_sub_origins(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_calendar_appointments_sub_origin_id ON public.calendar_appointments(sub_origin_id);