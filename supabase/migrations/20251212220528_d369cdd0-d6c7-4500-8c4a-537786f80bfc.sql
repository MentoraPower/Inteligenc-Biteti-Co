-- Associate all existing pipelines with the "Entrada" sub-origin
UPDATE public.pipelines 
SET sub_origin_id = '00000000-0000-0000-0000-000000000002' 
WHERE sub_origin_id IS NULL;

-- Also associate existing pipeline_automations with the same sub-origin
UPDATE public.pipeline_automations 
SET sub_origin_id = '00000000-0000-0000-0000-000000000002' 
WHERE sub_origin_id IS NULL;