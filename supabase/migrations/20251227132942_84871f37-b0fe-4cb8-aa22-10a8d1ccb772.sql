-- Add photo_url column to profiles table for team member profile pictures
ALTER TABLE public.profiles 
ADD COLUMN photo_url text;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.photo_url IS 'URL of the team member profile photo stored in Supabase storage';