-- Add sub_origin_id column to pipelines table for data isolation
ALTER TABLE public.pipelines 
ADD COLUMN sub_origin_id uuid REFERENCES public.crm_sub_origins(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_pipelines_sub_origin_id ON public.pipelines(sub_origin_id);

-- Add sub_origin_id to pipeline_automations to isolate automations per sub-origin
ALTER TABLE public.pipeline_automations 
ADD COLUMN sub_origin_id uuid REFERENCES public.crm_sub_origins(id) ON DELETE CASCADE;

-- Create index for automations
CREATE INDEX idx_pipeline_automations_sub_origin_id ON public.pipeline_automations(sub_origin_id);