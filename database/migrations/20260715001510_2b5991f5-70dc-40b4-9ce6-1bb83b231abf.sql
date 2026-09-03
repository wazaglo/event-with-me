ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER TABLE public.participants REPLICA IDENTITY FULL;