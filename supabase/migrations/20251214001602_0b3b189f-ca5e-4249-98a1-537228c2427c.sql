-- Function to copy activities from existing leads when a new lead is added to a sub_origin
CREATE OR REPLACE FUNCTION public.copy_activities_for_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  activity_record RECORD;
  new_group_id UUID;
BEGIN
  -- Only process if the new lead has a sub_origin_id
  IF NEW.sub_origin_id IS NOT NULL THEN
    -- Find distinct activity_group_ids that exist for other leads in the same sub_origin
    FOR activity_record IN 
      SELECT DISTINCT ON (activity_group_id) 
        activity_group_id,
        pipeline_id,
        titulo,
        tipo,
        data,
        hora,
        notas
      FROM lead_activities 
      WHERE activity_group_id IS NOT NULL
        AND lead_id IN (
          SELECT id FROM leads WHERE sub_origin_id = NEW.sub_origin_id AND id != NEW.id
        )
      ORDER BY activity_group_id, created_at ASC
    LOOP
      -- Insert the activity for the new lead with the same group_id
      INSERT INTO lead_activities (
        lead_id,
        pipeline_id,
        titulo,
        tipo,
        data,
        hora,
        notas,
        activity_group_id,
        concluida
      ) VALUES (
        NEW.id,
        activity_record.pipeline_id,
        activity_record.titulo,
        activity_record.tipo,
        activity_record.data,
        activity_record.hora,
        activity_record.notas,
        activity_record.activity_group_id,
        false
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new leads
DROP TRIGGER IF EXISTS copy_activities_on_new_lead ON leads;
CREATE TRIGGER copy_activities_on_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_activities_for_new_lead();