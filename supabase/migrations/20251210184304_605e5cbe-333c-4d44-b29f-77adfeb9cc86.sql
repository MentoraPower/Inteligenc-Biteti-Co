-- Add RLS policy to allow deleting leads
CREATE POLICY "Anyone can delete leads" 
ON public.leads 
FOR DELETE 
USING (true);