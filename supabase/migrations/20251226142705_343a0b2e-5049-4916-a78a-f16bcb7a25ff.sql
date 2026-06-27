-- Add width_percent column to overview_cards
ALTER TABLE public.overview_cards 
ADD COLUMN width_percent real NOT NULL DEFAULT 25;

-- Migrate existing data: assume typical container width of ~1200px to calculate percentages
-- Cards with width >= 450 are considered "large" (~50%)
-- Cards with width >= 320 are considered "medium" (~30%)
-- Default smaller cards get ~25%
UPDATE public.overview_cards 
SET width_percent = CASE 
  WHEN width >= 500 THEN 50
  WHEN width >= 400 THEN 40
  WHEN width >= 320 THEN 30
  ELSE 25
END;