
-- Create storage bucket for custom field files
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-field-files', 'custom-field-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for custom field files"
ON storage.objects FOR SELECT
USING (bucket_id = 'custom-field-files');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload custom field files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'custom-field-files');

-- Allow service role to manage (for webhook uploads)
CREATE POLICY "Service role can manage custom field files"
ON storage.objects FOR ALL
USING (bucket_id = 'custom-field-files');
