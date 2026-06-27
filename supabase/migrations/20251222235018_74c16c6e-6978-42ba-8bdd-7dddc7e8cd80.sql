-- Enable realtime for facebook_ads_insights table
ALTER TABLE public.facebook_ads_insights REPLICA IDENTITY FULL;

-- Add to realtime publication (if not already added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.facebook_ads_insights;