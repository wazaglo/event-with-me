DROP POLICY IF EXISTS "Public online registration" ON public.participants;
REVOKE INSERT ON public.participants FROM anon;