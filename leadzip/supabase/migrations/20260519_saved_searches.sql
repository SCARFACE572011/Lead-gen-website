CREATE TABLE saved_searches (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          text        NOT NULL,
  zip           text        NOT NULL,
  radius        integer     NOT NULL,
  category      text        NOT NULL,
  keyword       text,
  alert_enabled boolean     DEFAULT false NOT NULL,
  last_place_ids text[]     DEFAULT '{}' NOT NULL,
  last_run_at   timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved searches"
  ON saved_searches FOR ALL
  USING (auth.uid() = user_id);
