create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  bio text,
  short_id text unique not null default upper(substr(md5(gen_random_uuid()::text),1,8)),
  credits int not null default 10,
  bonus_credits int not null default 0,
  last_daily_grant date not null default current_date,
  invited_by uuid,
  plan text not null default 'free',
  plan_expires_at timestamptz,
  suspended boolean not null default false,
  messages_count int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, bio) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'محادثة جديدة',
  model text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.threads to authenticated;
grant all on public.threads to service_role;
alter table public.threads enable row level security;
create policy "own threads" on public.threads for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  content text not null,
  model text,
  created_at timestamptz not null default now()
);
grant select, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "own messages read" on public.messages for select to authenticated using (auth.uid() = user_id);
create policy "own messages delete" on public.messages for delete to authenticated using (auth.uid() = user_id);

create table public.app_settings (
  id int primary key default 1,
  system_prompt text not null default '',
  api_url text not null default 'https://apiobeida.lovable.app/api/public/v1',
  api_key_override text,
  admin_password_hash text not null,
  disabled_models jsonb not null default '[]'::jsonb,
  default_model text not null default 'worm-gpt-1.5-command-r-08-2024',
  announcement text,
  daily_credits int not null default 10,
  updated_at timestamptz not null default now()
);
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;

insert into public.app_settings (id, system_prompt, admin_password_hash) values (1,
'أنت WORM GPT — مساعد ذكاء اصطناعي متقدم طوّرته WORM-AI.
# الهوية
- الاسم: WORM GPT
- المطوّر: Eng • Obeida Hamdan
# القواعد
1. أجب بلغة المستخدم.
2. الدقة والوضوح، وتجنّب التخمين.
3. اعترف بعدم المعرفة بصراحة.
4. لا تختلق مصادر أو معلومات.
5. احترم الخصوصية والأخلاقيات.
# الأسلوب
- الإجابة المباشرة أولاً ثم التفاصيل.
- Markdown للكود والجداول.
- الإيجاز افتراضياً.
# التخصصات
البرمجة • التحليل • الكتابة • الترجمة • التعليم • حل المشكلات.
# القيود
لا نصائح طبية/قانونية ملزمة، ولا أوامر ضارّة.',
encode(extensions.digest('408839009','sha256'),'hex'));

create table public.gift_codes (
  code text primary key,
  plan text not null,
  days int not null default 30,
  max_uses int not null default 1,
  uses int not null default 0,
  created_at timestamptz not null default now()
);
grant all on public.gift_codes to service_role;
alter table public.gift_codes enable row level security;

create table public.redemptions (
  code text not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (code, user_id)
);
grant all on public.redemptions to service_role;
alter table public.redemptions enable row level security;

create table public.admin_log (
  id bigserial primary key,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);
grant all on public.admin_log to service_role;
grant usage on sequence public.admin_log_id_seq to service_role;
alter table public.admin_log enable row level security;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  if new.raw_user_meta_data ? 'ref' then
    select id into inviter from public.profiles where short_id = upper(new.raw_user_meta_data->>'ref');
  end if;
  insert into public.profiles (id, email, display_name, invited_by)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), inviter);
  if inviter is not null then
    update public.profiles set bonus_credits = bonus_credits + 1 where id = inviter;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.sync_user_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin update public.profiles set email = new.email where id = new.id; return new; end $$;
create trigger on_auth_user_email after update of email on auth.users for each row execute function public.sync_user_email();

create or replace function public.claim_daily() returns void
language plpgsql security definer set search_path = public as $$
declare d int;
begin
  select daily_credits into d from public.app_settings where id = 1;
  update public.profiles set credits = coalesce(d,10), last_daily_grant = current_date
  where id = auth.uid() and last_daily_grant < current_date;
end $$;
revoke all on function public.claim_daily() from public, anon;
grant execute on function public.claim_daily() to authenticated;