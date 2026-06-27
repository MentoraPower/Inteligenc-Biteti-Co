-- Allow public read access to leads for the dashboard (temporary, until auth is implemented)
CREATE POLICY "Anyone can view leads" 
ON public.leads 
FOR SELECT 
TO anon
USING (true);