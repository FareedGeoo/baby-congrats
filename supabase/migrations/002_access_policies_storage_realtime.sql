-- Replace message policies, secure site settings and photo management,
-- and include messages in Supabase Realtime. Safe to re-run.

BEGIN;

GRANT USAGE ON SCHEMA public, storage TO anon, authenticated;

-- Messages policies are replaced as a set so an older permissive policy
-- cannot grant access through PostgreSQL's permissive-policy OR behavior.
DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.messages',
      existing_policy.policyname
    );
  END LOOP;
END
$$;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_read_approved"
  ON public.messages
  FOR SELECT
  TO anon, authenticated
  USING (approved IS TRUE);

CREATE POLICY "messages_admin_read_all"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "messages_public_insert_open_guestbook"
  ON public.messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    approved IS FALSE
    AND pinned IS FALSE
    AND EXISTS (
      SELECT 1
      FROM public.site_settings
      WHERE id = 1
        AND guestbook_open IS TRUE
    )
  );

CREATE POLICY "messages_admin_update"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "messages_admin_delete"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Admin membership is only managed by trusted SQL/editor access.
REVOKE ALL PRIVILEGES ON TABLE public.admins FROM PUBLIC, anon, authenticated;

-- Public visitors can read the single settings row, but only admins can edit it.
DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_settings'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.site_settings',
      existing_policy.policyname
    );
  END LOOP;
END
$$;

CREATE POLICY "site_settings_public_read"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

CREATE POLICY "site_settings_admin_update"
  ON public.site_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Explicit table and column privileges; RLS remains the row-level boundary.
REVOKE ALL PRIVILEGES ON TABLE public.messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.messages TO anon, authenticated;
GRANT INSERT (name, message, photo_url, approved, recipient_type, pinned)
  ON TABLE public.messages TO anon, authenticated;
GRANT UPDATE (name, message, photo_url, approved, recipient_type, pinned)
  ON TABLE public.messages TO authenticated;
GRANT DELETE ON TABLE public.messages TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_settings TO anon, authenticated;
GRANT UPDATE (
  baby_name,
  mother_name,
  father_name,
  birth_date,
  birth_time,
  birth_weight,
  birth_length,
  welcome_title_en,
  welcome_title_ar,
  welcome_message_en,
  welcome_message_ar,
  baby_photo_url,
  theme,
  allow_visitor_theme_change,
  guestbook_open,
  updated_at
)
  ON TABLE public.site_settings TO authenticated;

-- Keep public photos readable and uploads available outside the reserved
-- baby/ prefix; the bucket enforces MIME and size limits.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'baby-photos',
  'baby-photos',
  true,
  5242879,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read access for baby-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload baby photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update baby photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete baby photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete baby photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload baby photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view baby photos" ON storage.objects;
DROP POLICY IF EXISTS "baby_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "baby_photos_public_image_insert" ON storage.objects;
DROP POLICY IF EXISTS "baby_photos_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "baby_photos_admin_delete" ON storage.objects;

CREATE POLICY "baby_photos_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'baby-photos');

CREATE POLICY "baby_photos_public_image_insert"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'baby-photos'
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

CREATE POLICY "baby_photos_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'baby-photos'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'baby-photos'
    AND public.is_admin()
  );

CREATE POLICY "baby_photos_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'baby-photos'
    AND public.is_admin()
  );

-- Create the publication only if the Supabase publication is absent, then add
-- this table only when it is not already a member.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END
$$;

COMMIT;
