
-- 1. Tighten is_staff to explicit roles (SECURITY INVOKER + fixed search_path, revoke from public)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'registration_officer'::app_role, 'checkin_officer'::app_role)
  );
$$;

-- 2. Fix mutable search_path on trigger functions
CREATE OR REPLACE FUNCTION public.set_registration_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.registration_number IS NULL OR NEW.registration_number = '' THEN
    NEW.registration_number := 'SUMMIT-' || lpad(nextval('public.participant_reg_seq')::text, 4, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

-- 3. Revoke EXECUTE on SECURITY DEFINER functions from PUBLIC, grant only where needed
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.registration_is_open() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registration_is_open() TO anon, authenticated, service_role;

-- 4. Restrict event_settings direct reads to authenticated staff; expose a narrow public view for anon
DROP POLICY IF EXISTS "Anyone reads settings" ON public.event_settings;
CREATE POLICY "Staff read settings" ON public.event_settings
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));
REVOKE SELECT ON public.event_settings FROM anon;

CREATE OR REPLACE VIEW public.public_event_settings
WITH (security_invoker = true) AS
SELECT
  id, event_name, event_date, venue, logo_url,
  primary_color, accent_color, registration_open,
  show_qr, show_registration_number, badge_layout, badge_font_size
FROM public.event_settings
WHERE id = 1;

-- View needs its own policy path: recreate as security_invoker means underlying RLS applies.
-- To allow anon/authenticated public read of the safe columns, add a permissive policy
-- scoped to a fixed row via a dedicated policy on event_settings limited to safe access:
-- simpler: switch view to security definer style via a stable function.
DROP VIEW IF EXISTS public.public_event_settings;

CREATE OR REPLACE FUNCTION public.get_public_event_settings()
RETURNS TABLE (
  id integer,
  event_name text,
  event_date timestamptz,
  venue text,
  logo_url text,
  primary_color text,
  accent_color text,
  registration_open boolean,
  show_qr boolean,
  show_registration_number boolean,
  badge_layout text,
  badge_font_size numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, event_name, event_date, venue, logo_url,
         primary_color, accent_color, registration_open,
         show_qr, show_registration_number, badge_layout, badge_font_size
  FROM public.event_settings WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_event_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_settings() TO anon, authenticated, service_role;
