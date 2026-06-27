-- Create table for Facebook Ads connections
CREATE TABLE public.facebook_ads_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  access_token_expires_at TIMESTAMP WITH TIME ZONE,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  selected_campaigns JSONB DEFAULT '[]'::jsonb,
  selected_metrics JSONB DEFAULT '{"spend": true, "cpm": true, "cpc": true}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.facebook_ads_connections ENABLE ROW LEVEL SECURITY;

-- Create policies - only admins can manage connections
CREATE POLICY "Admins can view facebook_ads_connections" 
ON public.facebook_ads_connections 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert facebook_ads_connections" 
ON public.facebook_ads_connections 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update facebook_ads_connections" 
ON public.facebook_ads_connections 
FOR UPDATE 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete facebook_ads_connections" 
ON public.facebook_ads_connections 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_facebook_ads_connections_updated_at
BEFORE UPDATE ON public.facebook_ads_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for Facebook Ads insights cache
CREATE TABLE public.facebook_ads_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.facebook_ads_connections(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  spend NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  date_preset TEXT DEFAULT 'last_30d',
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.facebook_ads_insights ENABLE ROW LEVEL SECURITY;

-- Create policies for insights
CREATE POLICY "Admins can view facebook_ads_insights" 
ON public.facebook_ads_insights 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert facebook_ads_insights" 
ON public.facebook_ads_insights 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update facebook_ads_insights" 
ON public.facebook_ads_insights 
FOR UPDATE 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete facebook_ads_insights" 
ON public.facebook_ads_insights 
FOR DELETE 
USING (is_admin(auth.uid()));