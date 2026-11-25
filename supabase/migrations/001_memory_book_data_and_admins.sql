-- Add memory-book fields, administrator authorization, and site settings.
-- Safe to re-run. This migration is not applied automatically.

BEGIN;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  photo_url text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  recipient_type text NOT NULL DEFAULT 'baby',
  pinned boolean NOT NULL DEFAULT false
);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS recipient_type text NOT NULL DEFAULT 'baby',
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

UPDATE public.messages
SET recipient_type = 'baby'
WHERE recipient_type IS NULL;

UPDATE public.messages
SET pinned = false
WHERE pinned IS NULL;

ALTER TABLE public.messages
  ALTER COLUMN recipient_type SET DEFAULT 'baby',
  ALTER COLUMN recipient_type SET NOT NULL,
  ALTER COLUMN pinned SET DEFAULT false,
  ALTER COLUMN pinned SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
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
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns to an existing site_settings table without replacing it.
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
  SELECT data_type
  INTO settings_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'site_settings'
    AND column_name = 'id';

  IF settings_id_type <> 'integer' THEN
    RAISE EXCEPTION
      'public.site_settings.id must be integer; inspect the existing table and migrate it manually before continuing.';
  END IF;

  SELECT count(*) INTO settings_row_count
  FROM public.site_settings;

  IF settings_row_count > 1
     AND EXISTS (SELECT 1 FROM public.site_settings WHERE id IS NULL) THEN
    RAISE EXCEPTION
      'public.site_settings contains multiple rows with a null id; inspect and consolidate settings manually before continuing.';
  END IF;

  UPDATE public.site_settings SET id = 1 WHERE id IS NULL;

  IF EXISTS (SELECT 1 FROM public.site_settings WHERE id <> 1) THEN
    RAISE EXCEPTION
      'public.site_settings contains an id other than 1; inspect and migrate the existing settings manually before continuing.';
  END IF;
END
$$;

UPDATE public.site_settings
SET theme = 'boy'
WHERE theme IS NULL;

UPDATE public.site_settings
SET allow_visitor_theme_change = true
WHERE allow_visitor_theme_change IS NULL;

UPDATE public.site_settings
SET guestbook_open = true
WHERE guestbook_open IS NULL;

UPDATE public.site_settings
SET updated_at = now()
WHERE updated_at IS NULL;

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
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.site_settings'::regclass
      AND conname = 'site_settings_id_key'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_id_key UNIQUE (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.site_settings'::regclass
      AND conname = 'site_settings_singleton_check'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_singleton_check CHECK (id = 1) NOT VALID;
  END IF;

END
$$;

-- Replace existing boy/girl-only theme checks so the Royal value is allowed.
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

COMMIT;
