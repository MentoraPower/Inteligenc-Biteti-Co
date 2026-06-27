-- Drop the old restrictive update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new policy that allows admins to update any profile
CREATE POLICY "Users can update profiles"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id 
  OR 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  auth.uid() = id 
  OR 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);