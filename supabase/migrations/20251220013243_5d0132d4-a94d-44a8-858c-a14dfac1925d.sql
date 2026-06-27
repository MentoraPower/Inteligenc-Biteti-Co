-- Create table for origin settings
CREATE TABLE public.origin_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_id uuid NOT NULL UNIQUE,
    agenda_mode boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.origin_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view origin_settings"
ON public.origin_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert origin_settings"
ON public.origin_settings
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update origin_settings"
ON public.origin_settings
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete origin_settings"
ON public.origin_settings
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_origin_settings_updated_at
BEFORE UPDATE ON public.origin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();