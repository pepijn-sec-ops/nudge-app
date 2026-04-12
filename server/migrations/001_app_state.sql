-- PostgreSQL / Supabase: single-row JSON document (matches Nudge server/db.js)
CREATE TABLE IF NOT EXISTS app_state (
  id int PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
