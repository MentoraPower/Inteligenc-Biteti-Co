-- Update the 3 existing appointments to associate with the Comercial calendar
UPDATE calendar_appointments 
SET sub_origin_id = '0c5a488a-b28a-4ecb-b468-961b91ca1c35'
WHERE id IN (
  '5b4985a9-c4d4-4b12-a9ba-0d4532c82038',
  'd600316b-8b8f-4706-8933-1412932e1a98',
  'c824bc09-1eb4-42ae-a4e2-163d8ac31320'
);

-- Add is_locked column to prevent editing of migrated appointments
ALTER TABLE calendar_appointments ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- Lock the 3 migrated appointments
UPDATE calendar_appointments 
SET is_locked = true
WHERE id IN (
  '5b4985a9-c4d4-4b12-a9ba-0d4532c82038',
  'd600316b-8b8f-4706-8933-1412932e1a98',
  'c824bc09-1eb4-42ae-a4e2-163d8ac31320'
);