
CREATE TYPE public.app_role AS ENUM ('admin', 'registration_officer', 'checkin_officer');
CREATE TYPE public.registration_type AS ENUM ('online', 'walk_in');

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id); $$;

CREATE POLICY "Users see their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_profiles TO authenticated;
GRANT ALL ON public.staff_profiles TO service_role;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read profiles" ON public.staff_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "Admins manage staff profiles" ON public.staff_profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own profile" ON public.staff_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.staff_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.event_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  event_name text NOT NULL DEFAULT 'Financial Architecture Summit',
  event_date date,
  venue text,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#00655b',
  accent_color text NOT NULL DEFAULT '#ffd400',
  registration_open boolean NOT NULL DEFAULT true,
  badge_layout text NOT NULL DEFAULT 'standard',
  badge_font_size int NOT NULL DEFAULT 16,
  show_qr boolean NOT NULL DEFAULT true,
  show_registration_number boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.event_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.event_settings TO anon, authenticated;
GRANT UPDATE ON public.event_settings TO authenticated;
GRANT ALL ON public.event_settings TO service_role;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads settings" ON public.event_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.event_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE SEQUENCE public.participant_reg_seq START 1;

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text UNIQUE NOT NULL DEFAULT '',
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  organisation text NOT NULL CHECK (char_length(organisation) BETWEEN 1 AND 160),
  email citext UNIQUE NOT NULL,
  phone text,
  position text,
  registration_type public.registration_type NOT NULL DEFAULT 'online',
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES auth.users(id),
  badge_printed_at timestamptz,
  badge_print_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_registration_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.registration_number IS NULL OR NEW.registration_number = '' THEN
    NEW.registration_number := 'SUMMIT-' || lpad(nextval('public.participant_reg_seq')::text, 4, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_participants_reg_no BEFORE INSERT ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.set_registration_number();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_participants_touch BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_participants_created_at ON public.participants (created_at DESC);
CREATE INDEX idx_participants_email ON public.participants (email);
CREATE INDEX idx_participants_name_trgm ON public.participants USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_participants_org_trgm ON public.participants USING gin (organisation gin_trgm_ops);
CREATE INDEX idx_participants_checked_in ON public.participants (checked_in_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT INSERT ON public.participants TO anon;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.registration_is_open()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT registration_open FROM public.event_settings WHERE id = 1;
$$;

CREATE POLICY "Public online registration" ON public.participants
  FOR INSERT TO anon
  WITH CHECK (
    public.registration_is_open()
    AND registration_type = 'online'
    AND checked_in_at IS NULL
    AND checked_in_by IS NULL
    AND created_by IS NULL
    AND badge_print_count = 0
  );

CREATE POLICY "Staff read participants" ON public.participants
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert participants" ON public.participants
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Officers & admins update participants" ON public.participants
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'registration_officer') OR public.has_role(auth.uid(), 'checkin_officer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'registration_officer') OR public.has_role(auth.uid(), 'checkin_officer'));

CREATE POLICY "Admins delete participants" ON public.participants
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity text,
  entity_id uuid,
  actor_id uuid REFERENCES auth.users(id),
  actor_label text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_action ON public.audit_logs (action);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  role_count int;
BEGIN
  SELECT count(*) INTO role_count FROM public.user_roles;
  INSERT INTO public.staff_profiles (id, display_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.email)
    ON CONFLICT (id) DO NOTHING;
  IF role_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_user();

CREATE POLICY "Public read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "Admins write branding" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update branding" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete branding" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
