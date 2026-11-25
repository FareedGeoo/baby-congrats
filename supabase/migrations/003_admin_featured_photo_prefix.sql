BEGIN;

-- Existing public uploads remain available outside the reserved baby/ prefix.
DROP POLICY IF EXISTS "baby_photos_admin_baby_prefix_guard" ON storage.objects;
CREATE POLICY "baby_photos_admin_baby_prefix_guard"
  ON storage.objects AS RESTRICTIVE
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    CASE
      WHEN bucket_id <> 'baby-photos'
        OR (storage.foldername(name))[1] IS DISTINCT FROM 'baby'
        THEN true
      WHEN auth.role() = 'authenticated' THEN public.is_admin()
      ELSE false
    END
  );

COMMIT;
