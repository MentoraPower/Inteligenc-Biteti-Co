-- Enable realtime for overview_cards table
ALTER TABLE public.overview_cards REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.overview_cards;