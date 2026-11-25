-- Align photo uploads with the bucket's MIME/size limits and remove legacy
-- policies that could otherwise grant broader storage access.
BEGIN;

DROP POLICY IF EXISTS "baby_photos_public_image_insert" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete baby photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload baby photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view baby photos" ON storage.objects;

CREATE POLICY "baby_photos_public_image_insert"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'baby-photos'
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

COMMIT;
