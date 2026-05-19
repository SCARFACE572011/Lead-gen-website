CREATE TABLE IF NOT EXISTS public.api_keys (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name         text        NOT NULL DEFAULT 'Default',
  key_hash     text        NOT NULL UNIQUE,
  key_prefix   text        NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  last_used_at timestamptz
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own api keys"
  ON public.api_keys FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys(key_hash);
