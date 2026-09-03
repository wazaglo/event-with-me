-- Lock down EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.register_participant(text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_event_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registration_is_open() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_registration_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_staff_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_participant(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;