ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS tg_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tg_admin_ids text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tg_channel text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tg_bot_username text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tg_store_text text NOT NULL DEFAULT 'مرحباً بك في متجر WORM GPT',
  ADD COLUMN IF NOT EXISTS tg_contact text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tg_plans jsonb NOT NULL DEFAULT '[{"plan":"plus","label":"Plus","price":"$5"},{"plan":"pro","label":"Pro","price":"$10"},{"plan":"ultra","label":"Ultra","price":"$20"}]'::jsonb,
  ADD COLUMN IF NOT EXISTS tg_ref_points integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tg_ref_credits integer NOT NULL DEFAULT 1;

CREATE TABLE public.tg_users (
  tg_id bigint PRIMARY KEY,
  username text,
  first_name text,
  points integer NOT NULL DEFAULT 0,
  referrals integer NOT NULL DEFAULT 0,
  referred_by bigint,
  profile_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_users TO service_role;
ALTER TABLE public.tg_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tg_link_tokens (
  token text PRIMARY KEY,
  profile_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_link_tokens TO service_role;
ALTER TABLE public.tg_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tg_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  prize_plan text,
  prize_days integer NOT NULL DEFAULT 0,
  prize_credits integer NOT NULL DEFAULT 0,
  winners_count integer NOT NULL DEFAULT 1,
  entry_cost integer NOT NULL DEFAULT 0,
  min_points integer NOT NULL DEFAULT 0,
  min_referrals integer NOT NULL DEFAULT 0,
  require_channel boolean NOT NULL DEFAULT false,
  vote_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'scheduled',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  message_id bigint,
  winners jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_drops TO service_role;
ALTER TABLE public.tg_drops ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tg_drop_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES public.tg_drops(id) ON DELETE CASCADE,
  tg_id bigint NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  choice integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drop_id, tg_id)
);
GRANT ALL ON public.tg_drop_entries TO service_role;
ALTER TABLE public.tg_drop_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX tg_drop_entries_drop_idx ON public.tg_drop_entries(drop_id);
CREATE INDEX tg_drops_status_idx ON public.tg_drops(status, starts_at);

CREATE TABLE public.tg_updates (
  update_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_updates TO service_role;
ALTER TABLE public.tg_updates ENABLE ROW LEVEL SECURITY;