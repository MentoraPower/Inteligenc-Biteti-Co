-- Add payment fields to calendar_appointments
ALTER TABLE public.calendar_appointments 
ADD COLUMN is_paid boolean DEFAULT false,
ADD COLUMN payment_value numeric DEFAULT 0;