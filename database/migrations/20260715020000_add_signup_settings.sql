CREATE TABLE public.signup_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.signup_settings ENABLE ROW LEVEL SECURITY;

-- No token row is inserted here: self-signup stays disabled until an admin sets one.
-- No policies, and no grants to anon/authenticated — every read/write goes through
-- server functions using the service-role client, never the browser-side client.
REVOKE ALL ON public.signup_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.signup_settings TO service_role;
