
CREATE TABLE IF NOT EXISTS public.signup_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT ALL ON public.signup_settings TO service_role;
-- No anon/authenticated grants: only the service_role client (staff.functions.ts) reads/writes this.

ALTER TABLE public.signup_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.signup_settings (id, token) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING;
