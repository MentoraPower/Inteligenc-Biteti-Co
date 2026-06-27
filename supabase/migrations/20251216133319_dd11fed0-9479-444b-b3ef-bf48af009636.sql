-- Fix orphan leads: move them to the correct pipeline for Captação sub-origin
UPDATE leads
SET pipeline_id = 'd9d6dc7f-0d79-4953-9c25-b3bd3b1ce5d6'  -- Entrada pipeline of Captação
WHERE sub_origin_id = 'c74f2b5f-380d-4221-a606-18f1964f77ac'  -- Captação sub-origin
  AND pipeline_id = 'b62bdfc2-cfda-4cc2-9a72-f87f9ac1f724';  -- Base pipeline (wrong)