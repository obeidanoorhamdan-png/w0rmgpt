-- WORM GPT Telegram bot: full feature expansion (store, growth, drops, user, admin, stats, safety).

-- ============ app_settings additions ============
alter table public.app_settings
  add column if not exists tg_maintenance boolean not null default false,
  add column if not exists tg_maintenance_text text not null default 'البوت تحت الصيانة، نعود قريباً',
  add column if not exists tg_channels jsonb not null default '[]'::jsonb,
  add column if not exists tg_require_channels jsonb not null default '[]'::jsonb,
  add column if not exists tg_captcha_enabled boolean not null default true,
  add column if not exists tg_rate_limit int not null default 12,
  add column if not exists tg_duplicate_check boolean not null default true,
  add column if not exists tg_daily_report_at text not null default '21:00',
  add column if not exists tg_trial_plan text not null default 'plus',
  add column if not exists tg_trial_days int not null default 1,
  add column if not exists tg_points_per_day int not null default 100,
  add column if not exists tg_ref_purchase_bonus int not null default 50,
  add column if not exists tg_ref_two_levels boolean not null default true,
  add column if not exists tg_ref_anti_fake boolean not null default true,
  add column if not exists tg_spin_prizes jsonb not null default '[{"points":5},{"points":10},{"points":25},{"points":0},{"points":50}]'::jsonb,
  add column if not exists tg_daily_box jsonb not null default '[{"points":10}]'::jsonb,
  add column if not exists tg_streak_bonus jsonb not null default '[]'::jsonb,
  add column if not exists tg_egg_prizes jsonb not null default '[{"points":5},{"points":15},{"points":40},{"points":100}]'::jsonb,
  add column if not exists tg_star_prices jsonb not null default '[]'::jsonb,
  add column if not exists tg_usdt_address text not null default '',
  add column if not exists tg_usdt_prices jsonb not null default '[]'::jsonb,
  add column if not exists tg_reminder_days int not null default 3,
  add column if not exists tg_notify_new_drop boolean not null default true,
  add column if not exists tg_support_enabled boolean not null default true,
  add column if not exists tg_bot_chat boolean not null default true,
  add column if not exists tg_bot_image boolean not null default true,
  add column if not exists tg_paid_plans jsonb not null default '["plus","pro","ultra"]'::jsonb,
  add column if not exists tg_leaderboard_days int not null default 30;

-- ============ tg_users additions ============
alter table public.tg_users
  add column if not exists language text not null default 'ar',
  add column if not exists notifications_on boolean not null default true,
  add column if not exists banned boolean not null default false,
  add column if not exists ban_reason text not null default '',
  add column if not exists xp int not null default 0,
  add column if not exists streak int not null default 0,
  add column if not exists last_checkin date,
  add column if not exists last_box_at date,
  add column if not exists last_spin_at date,
  add column if not exists win_count int not null default 0,
  add column if not exists last_win_at timestamp with time zone,
  add column if not exists paid boolean not null default false,
  add column if not exists trial_used boolean not null default false,
  add column if not exists captcha_code text,
  add column if not exists captcha_expires timestamp with time zone,
  add column if not exists points_earned int not null default 0,
  add column if not exists points_spent int not null default 0,
  add column if not exists last_seen_at timestamp with time zone not null default now(),
  add column if not exists dup_key text;

create index if not exists tg_users_created_idx on public.tg_users (created_at);
create index if not exists tg_users_dup_idx on public.tg_users (dup_key);

-- ============ tg_drops additions ============
alter table public.tg_drops
  add column if not exists "repeat" text not null default 'none',
  add column if not exists last_run_at timestamp with time zone,
  add column if not exists secret_word text not null default '',
  add column if not exists fairness_seed text not null default '',
  add column if not exists fairness_hash text not null default '',
  add column if not exists max_win_days int not null default 0,
  add column if not exists min_paid boolean not null default false,
  add column if not exists channels jsonb not null default '[]'::jsonb,
  add column if not exists live_counter boolean not null default true,
  add column if not exists question text not null default '',
  add column if not exists answer text not null default '';

-- ============ orders / purchases ============
create table if not exists public.tg_orders (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null,
  plan text not null,
  label text not null default '',
  price text not null default '',
  method text not null default 'stars',
  stars int not null default 0,
  usdt numeric(12,2) not null default 0,
  status text not null default 'pending',
  gift_code text,
  invoice_id text,
  txid text,
  coupon text,
  discount int not null default 0,
  note text not null default '',
  created_at timestamp with time zone not null default now(),
  paid_at timestamp with time zone
);
create index if not exists tg_orders_tg_idx on public.tg_orders (tg_id, created_at);
create index if not exists tg_orders_status_idx on public.tg_orders (status);

-- ============ cart ============
create table if not exists public.tg_cart (
  tg_id bigint primary key,
  items jsonb not null default '[]'::jsonb,
  coupon text,
  updated_at timestamp with time zone not null default now()
);

-- ============ coupons ============
create table if not exists public.tg_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent int not null default 0,
  max_uses int not null default 1,
  uses int not null default 0,
  expires_at timestamp with time zone,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

-- ============ points shop ============
create table if not exists public.tg_point_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  kind text not null default 'points',
  value int not null default 0,
  cost int not null default 0,
  stock int not null default 0,
  sold int not null default 0,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

-- ============ points ledger ============
create table if not exists public.tg_txn (
  id bigint primary key default abs(hashtextextended(gen_random_uuid()::text, 0)),
  tg_id bigint not null,
  kind text not null,
  amount int not null,
  note text not null default '',
  created_at timestamp with time zone not null default now()
);
create index if not exists tg_txn_tg_idx on public.tg_txn (tg_id, created_at);
create index if not exists tg_txn_day_idx on public.tg_txn (created_at);

-- ============ broadcasts ============
create table if not exists public.tg_broadcasts (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  buttons jsonb not null default '[]'::jsonb,
  image_url text,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  sent_count int not null default 0,
  failed_count int not null default 0,
  status text not null default 'draft',
  created_by bigint not null default 0,
  created_at timestamp with time zone not null default now()
);

-- ============ support tickets ============
create table if not exists public.tg_tickets (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null,
  status text not null default 'open',
  subject text not null default '',
  admin_tg_id bigint,
  created_at timestamp with time zone not null default now(),
  closed_at timestamp with time zone
);
create index if not exists tg_tickets_status_idx on public.tg_tickets (status, created_at);

create table if not exists public.tg_ticket_msgs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tg_tickets(id) on delete cascade,
  from_admin boolean not null default false,
  text text not null,
  created_at timestamp with time zone not null default now()
);
create index if not exists tg_ticket_msgs_t_idx on public.tg_ticket_msgs (ticket_id);

-- ============ bot admin action log ============
create table if not exists public.tg_bot_log (
  id bigint primary key default abs(hashtextextended(gen_random_uuid()::text, 0)),
  admin_tg_id bigint not null default 0,
  action text not null,
  detail text not null default '',
  created_at timestamp with time zone not null default now()
);

-- ============ badges / achievements ============
create table if not exists public.tg_badges (
  key text primary key,
  title text not null,
  description text not null default '',
  emoji text not null default '⭐'
);
create table if not exists public.tg_user_badges (
  tg_id bigint not null,
  badge_key text not null references public.tg_badges(key) on delete cascade,
  earned_at timestamp with time zone not null default now(),
  primary key (tg_id, badge_key)
);

-- ============ quiz questions ============
create table if not exists public.tg_quiz (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.tg_drops(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct int not null default 0,
  created_at timestamp with time zone not null default now()
);

-- ============ staff roles (separate table, never on users) ============
create table if not exists public.tg_staff (
  tg_id bigint primary key,
  role text not null default 'support',
  created_at timestamp with time zone not null default now()
);

-- ============ rate limiting ============
create table if not exists public.tg_rate (
  key text primary key,
  count int not null default 0,
  window_start timestamp with time zone not null default now()
);

-- ============ referral contests ============
create table if not exists public.tg_contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'referrals',
  prize_plan text,
  prize_days int not null default 0,
  prize_credits int not null default 0,
  winners_count int not null default 3,
  starts_at timestamp with time zone not null default now(),
  ends_at timestamp with time zone,
  status text not null default 'live',
  winners jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now()
);

-- ============ daily stats for charts ============
create table if not exists public.tg_daily_stats (
  day date primary key,
  new_users int not null default 0,
  total_users int not null default 0,
  orders int not null default 0,
  revenue_stars int not null default 0,
  points int not null default 0,
  drops int not null default 0,
  entries int not null default 0,
  updated_at timestamp with time zone not null default now()
);

-- ============ grants (service_role only; bot engine + admin functions) ============
grant all on public.tg_orders to service_role;
grant all on public.tg_cart to service_role;
grant all on public.tg_coupons to service_role;
grant all on public.tg_point_items to service_role;
grant all on public.tg_txn to service_role;
grant all on public.tg_broadcasts to service_role;
grant all on public.tg_tickets to service_role;
grant all on public.tg_ticket_msgs to service_role;
grant all on public.tg_bot_log to service_role;
grant all on public.tg_badges to service_role;
grant all on public.tg_user_badges to service_role;
grant all on public.tg_quiz to service_role;
grant all on public.tg_staff to service_role;
grant all on public.tg_rate to service_role;
grant all on public.tg_contests to service_role;
grant all on public.tg_daily_stats to service_role;

-- ============ RLS on every new table ============
alter table public.tg_orders enable row level security;
alter table public.tg_cart enable row level security;
alter table public.tg_coupons enable row level security;
alter table public.tg_point_items enable row level security;
alter table public.tg_txn enable row level security;
alter table public.tg_broadcasts enable row level security;
alter table public.tg_tickets enable row level security;
alter table public.tg_ticket_msgs enable row level security;
alter table public.tg_bot_log enable row level security;
alter table public.tg_badges enable row level security;
alter table public.tg_user_badges enable row level security;
alter table public.tg_quiz enable row level security;
alter table public.tg_staff enable row level security;
alter table public.tg_rate enable row level security;
alter table public.tg_contests enable row level security;
alter table public.tg_daily_stats enable row level security;

-- ============ seed badges ============
insert into public.tg_badges (key, title, description, emoji) values
  ('first_ref', 'أول إحالة', 'دعوت صديقًا وانضم', '🎁'),
  ('ref_10', 'مُحيل محترف', '10 إحالات', '🚀'),
  ('paid', 'مشترك مدفوع', 'اشترط خطة مدفوعة', '💎'),
  ('drop_winner', 'محظوظ', 'فاز في دروب', '🥚'),
  ('drop_winner_5', 'جامع الجوائز', 'فاز في 5 دروبات', '🏆'),
  ('streak_7', 'مواظب', '7 أيام متتالية', '🔥'),
  ('points_1000', 'جامع النقاط', 'وصل إلى 1000 نقطة', '⭐'),
  ('support_open', 'صوت مسموع', 'فتح تذكرة دعم', '🛟')
on conflict (key) do nothing;