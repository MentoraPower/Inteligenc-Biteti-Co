-- Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to whatsapp-media bucket
CREATE POLICY "Authenticated users can upload WhatsApp media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow public access to read WhatsApp media (for WAHA to fetch)
CREATE POLICY "Public can read WhatsApp media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete WhatsApp media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');