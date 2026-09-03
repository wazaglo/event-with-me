CREATE OR REPLACE FUNCTION public.register_participant(
  _full_name text,
  _organisation text,
  _email text,
  _phone text,
  _position text
)
RETURNS TABLE (id uuid, registration_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  new_reg text;
BEGIN
  IF NOT public.registration_is_open() THEN
    RAISE EXCEPTION 'Registration is closed' USING ERRCODE = '22023';
  END IF;

  _full_name := btrim(_full_name);
  _organisation := btrim(_organisation);
  _email := lower(btrim(_email));
  _phone := NULLIF(btrim(_phone), '');
  _position := NULLIF(btrim(_position), '');

  IF _full_name IS NULL OR char_length(_full_name) < 2 OR char_length(_full_name) > 120 THEN
    RAISE EXCEPTION 'Invalid full name' USING ERRCODE = '22023';
  END IF;
  IF _organisation IS NULL OR char_length(_organisation) < 2 OR char_length(_organisation) > 160 THEN
    RAISE EXCEPTION 'Invalid organisation' USING ERRCODE = '22023';
  END IF;
  IF _email IS NULL OR _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = '22023';
  END IF;
  IF _phone IS NOT NULL AND _phone !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Phone must be exactly 10 digits' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.participants (full_name, organisation, email, phone, position, registration_type)
  VALUES (_full_name, _organisation, _email, _phone, _position, 'walk_in')
  RETURNING participants.id, participants.registration_number
  INTO new_id, new_reg;

  RETURN QUERY SELECT new_id, new_reg;
END;
$$;
