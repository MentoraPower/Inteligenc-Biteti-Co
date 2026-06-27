-- ===========================================
-- SECURITY FIX: Enable RLS on google_tokens
-- ===========================================

-- Enable RLS on google_tokens table
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own tokens
CREATE POLICY "Users can view their own tokens"
ON public.google_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own tokens
CREATE POLICY "Users can insert their own tokens"
ON public.google_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tokens
CREATE POLICY "Users can update their own tokens"
ON public.google_tokens
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own tokens
CREATE POLICY "Users can delete their own tokens"
ON public.google_tokens
FOR DELETE
USING (auth.uid() = user_id);