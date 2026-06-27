-- Create table to store Instagram connection tokens
CREATE TABLE public.instagram_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_user_id TEXT NOT NULL,
  instagram_username TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  page_id TEXT,
  page_access_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instagram_connections ENABLE ROW LEVEL SECURITY;

-- Policies - only admins can manage connections
CREATE POLICY "Admins can view instagram connections" 
ON public.instagram_connections 
FOR SELECT 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert instagram connections" 
ON public.instagram_connections 
FOR INSERT 
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update instagram connections" 
ON public.instagram_connections 
FOR UPDATE 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete instagram connections" 
ON public.instagram_connections 
FOR DELETE 
USING (public.is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_instagram_connections_updated_at
BEFORE UPDATE ON public.instagram_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();