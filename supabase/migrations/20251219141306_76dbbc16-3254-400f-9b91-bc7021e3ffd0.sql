-- Create table for calendar appointments/agendamentos
CREATE TABLE public.calendar_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  email TEXT,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  closer_name TEXT,
  sdr_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.calendar_appointments ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view all appointments" 
ON public.calendar_appointments 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create appointments" 
ON public.calendar_appointments 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update appointments" 
ON public.calendar_appointments 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete appointments" 
ON public.calendar_appointments 
FOR DELETE 
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_calendar_appointments_updated_at
BEFORE UPDATE ON public.calendar_appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();