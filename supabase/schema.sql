-- Final-state reference for the Baby Memory Book database.
-- For an existing project, review and apply the numbered files in migrations/
-- in order. Never run this reference against production without reviewing the
-- target database and the public-access implications of the photo bucket.

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  photo_url text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  recipient_type text NOT NULL DEFAULT 'baby',
  pinned boolean NOT NULL DEFAULT false,
  CONSTRAINT messages_recipient_type_check
    CHECK (recipient_type IN ('baby', 'parents'))
);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS recipient_type text NOT NULL DEFAULT 'baby',
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

UPDATE public.messages SET recipient_type = 'baby' WHERE recipient_type IS NULL;
UPDATE public.messages SET pinned = false WHERE pinned IS NULL;

ALTER TABLE public.messages
  ALTER COLUMN recipient_type SET DEFAULT 'baby',
  ALTER COLUMN recipient_type SET NOT NULL,
  ALTER COLUMN pinned SET DEFAULT false,
  ALTER COLUMN pinned SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND conname = 'messages_recipient_type_check'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_recipient_type_check
      CHECK (recipient_type IN ('baby', 'parents')) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.messages
  VALIDATE CONSTRAINT messages_recipient_type_check;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.admins FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins
    WHERE user_id = auth.uid()
  );
$function$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.site_settings (
  id integer PRIMARY KEY DEFAULT 1,
  baby_name text,
  mother_name text,
  father_name text,
  birth_date date,
  birth_time time,
  birth_weight numeric,
  birth_length numeric,
  welcome_title_en text,
  welcome_title_ar text,
  welcome_message_en text,
  welcome_message_ar text,
  baby_photo_url text,
  theme text NOT NULL DEFAULT 'boy',
  allow_visitor_theme_change boolean NOT NULL DEFAULT true,
  guestbook_open boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton_check CHECK (id = 1)
);

-- Safe additions for a pre-existing settings table; existing incompatible
-- table shapes or multiple settings rows require manual review, never a drop.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS id integer,
  ADD COLUMN IF NOT EXISTS baby_name text,
  ADD COLUMN IF NOT EXISTS mother_name text,
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS birth_time time,
  ADD COLUMN IF NOT EXISTS birth_weight numeric,
  ADD COLUMN IF NOT EXISTS birth_length numeric,
  ADD COLUMN IF NOT EXISTS welcome_title_en text,
  ADD COLUMN IF NOT EXISTS welcome_title_ar text,
  ADD COLUMN IF NOT EXISTS welcome_message_en text,
  ADD COLUMN IF NOT EXISTS welcome_message_ar text,
  ADD COLUMN IF NOT EXISTS baby_photo_url text,
  ADD COLUMN IF NOT EXISTS theme text DEFAULT 'boy',
  ADD COLUMN IF NOT EXISTS allow_visitor_theme_change boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS guestbook_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  settings_id_type text;
  settings_row_count bigint;
BEGIN
  SELECT data_type INTO settings_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'site_settings'
    AND column_name = 'id';

  IF settings_id_type <> 'integer' THEN
    RAISE EXCEPTION
      'public.site_settings.id must be integer; inspect the existing table and migrate it manually.';
  END IF;

  SELECT count(*) INTO settings_row_count FROM public.site_settings;
  IF settings_row_count > 1
     AND EXISTS (SELECT 1 FROM public.site_settings WHERE id IS NULL) THEN
    RAISE EXCEPTION
      'public.site_settings has multiple rows with null ids; inspect and consolidate them manually.';
  END IF;

  UPDATE public.site_settings SET id = 1 WHERE id IS NULL;

  IF EXISTS (SELECT 1 FROM public.site_settings WHERE id <> 1) THEN
    RAISE EXCEPTION
      'public.site_settings contains an id other than 1; inspect it manually.';
  END IF;
END
$$;

UPDATE public.site_settings SET theme = 'boy' WHERE theme IS NULL;
UPDATE public.site_settings SET allow_visitor_theme_change = true
  WHERE allow_visitor_theme_change IS NULL;
UPDATE public.site_settings SET guestbook_open = true WHERE guestbook_open IS NULL;
UPDATE public.site_settings SET updated_at = now() WHERE updated_at IS NULL;

ALTER TABLE public.site_settings
  ALTER COLUMN id SET DEFAULT 1,
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN theme SET DEFAULT 'boy',
  ALTER COLUMN theme SET NOT NULL,
  ALTER COLUMN allow_visitor_theme_change SET DEFAULT true,
  ALTER COLUMN allow_visitor_theme_change SET NOT NULL,
  ALTER COLUMN guestbook_open SET DEFAULT true,
  ALTER COLUMN guestbook_open SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.site_settings'::regclass
      AND conname = 'site_settings_id_key'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_id_key UNIQUE (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.site_settings'::regclass
      AND conname = 'site_settings_singleton_check'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_singleton_check CHECK (id = 1) NOT VALID;
  END IF;

END
$$;

DO $$
DECLARE
  theme_attnum smallint;
  theme_constraint record;
BEGIN
  SELECT attnum INTO theme_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.site_settings'::regclass
    AND attname = 'theme'
    AND NOT attisdropped;

  FOR theme_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.site_settings'::regclass
      AND contype = 'c'
      AND (
        conname = 'site_settings_theme_check'
        OR (
          theme_attnum = ANY (conkey)
          AND pg_get_constraintdef(oid) ILIKE '%theme%'
          AND pg_get_constraintdef(oid) ILIKE '%boy%'
          AND pg_get_constraintdef(oid) ILIKE '%girl%'
        )
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS %I',
      theme_constraint.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_theme_check
  CHECK (theme IN ('boy', 'girl', 'royal')) NOT VALID;

ALTER TABLE public.site_settings
  VALIDATE CONSTRAINT site_settings_singleton_check;
ALTER TABLE public.site_settings
  VALIDATE CONSTRAINT site_settings_theme_check;

INSERT INTO public.site_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.messages',
      existing_policy.policyname
    );
  END LOOP;
END
$$;

CREATE POLICY "messages_read_approved"
  ON public.messages FOR SELECT TO anon, authenticated
  USING (approved IS TRUE);

CREATE POLICY "messages_admin_read_all"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "messages_public_insert_open_guestbook"
  ON public.messages FOR INSERT TO anon, authenticated
  WITH CHECK (
    approved IS FALSE
    AND pinned IS FALSE
    AND EXISTS (
      SELECT 1 FROM public.site_settings
      WHERE id = 1 AND guestbook_open IS TRUE
    )
  );

CREATE POLICY "messages_admin_update"
  ON public.messages FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "messages_admin_delete"
  ON public.messages FOR DELETE TO authenticated
  USING (public.is_admin());

DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'site_settings'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.site_settings',
      existing_policy.policyname
    );
  END LOOP;
END
$$;

CREATE POLICY "site_settings_public_read"
  ON public.site_settings FOR SELECT TO anon, authenticated
  USING (id = 1);

CREATE POLICY "site_settings_admin_update"
  ON public.site_settings FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL PRIVILEGES ON TABLE public.messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.messages TO anon, authenticated;
GRANT INSERT (name, message, photo_url, approved, recipient_type, pinned)
  ON TABLE public.messages TO anon, authenticated;
GRANT UPDATE (name, message, photo_url, approved, recipient_type, pinned)
  ON TABLE public.messages TO authenticated;
GRANT DELETE ON TABLE public.messages TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.admins FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_settings TO anon, authenticated;
GRANT UPDATE (
  baby_name, mother_name, father_name, birth_date, birth_time,
  birth_weight, birth_length, welcome_title_en, welcome_title_ar,
  welcome_message_en, welcome_message_ar, baby_photo_url, theme,
  allow_visitor_theme_change, guestbook_open, updated_at
)
  ON TABLE public.site_settings TO authenticated;

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
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

GRANT USAGE ON SCHEMA storage TO anon, authenticated;

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
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'baby-photos');

CREATE POLICY "baby_photos_public_image_insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'baby-photos'
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

CREATE POLICY "baby_photos_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'baby-photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'baby-photos' AND public.is_admin());

CREATE POLICY "baby_photos_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'baby-photos' AND public.is_admin());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END
$$;
