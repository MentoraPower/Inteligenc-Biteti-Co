-- Add unique constraint for upsert
ALTER TABLE public.overview_cards ADD CONSTRAINT overview_cards_sub_origin_card_id_unique UNIQUE (sub_origin_id, card_id);