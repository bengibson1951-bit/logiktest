-- Logikträning: isolated lt_* objects inside the shared DigitalContentNu project.
-- Idempotent. Paste into the Supabase SQL editor.
--
-- After running this, set the passphrase separately (never commit it):
--   insert into lt_config values ('pass_hash', crypt('<pass>', gen_salt('bf')))
--   on conflict (key) do update set value = excluded.value;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.lt_config (
  key text primary key,
  value text not null
);

create table if not exists public.lt_questions (
  id text primary key,
  area text not null,
  subtype text not null,
  difficulty int not null,
  source text not null check (source in ('bank', 'generated')),
  generator text,
  seed bigint,
  prompt text not null,
  options jsonb not null,
  correct int not null,
  explanation text,
  figure jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lt_sessions (
  id uuid primary key,
  mode text not null,
  filter jsonb,
  started_at timestamptz not null,
  ended_at timestamptz,
  time_limit_s int,
  paused_total_ms int not null default 0,
  total int not null,
  answered int,
  correct int,
  metrics jsonb,
  client_version text
);

create table if not exists public.lt_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lt_sessions(id) on delete cascade,
  question_id text not null references public.lt_questions(id),
  position int not null,
  chosen int,
  is_correct boolean,
  skipped boolean not null default false,
  time_ms int not null,
  paused_ms int not null default 0,
  answered_at timestamptz not null default now(),
  unique (session_id, position)
);

create index if not exists lt_answers_question_idx on public.lt_answers(question_id);

alter table public.lt_config enable row level security;
alter table public.lt_questions enable row level security;
alter table public.lt_sessions enable row level security;
alter table public.lt_answers enable row level security;

revoke all on public.lt_config, public.lt_questions, public.lt_sessions, public.lt_answers from anon, authenticated;

-- Internal guard: raises unless the passphrase matches.
create or replace function public.lt_check(p_pass text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select value into h from lt_config where key = 'pass_hash';
  if h is null or p_pass is null or crypt(p_pass, h) <> h then
    raise exception 'unauthorized' using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function public.lt_check(text) from public, anon, authenticated;

create or replace function public.lt_auth(p_pass text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform lt_check(p_pass);
  return true;
exception when insufficient_privilege then
  return false;
end $$;

create or replace function public.lt_start_session(p_pass text, p_session jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform lt_check(p_pass);
  insert into lt_sessions (id, mode, filter, started_at, time_limit_s, total, client_version)
  values (
    (p_session->>'id')::uuid,
    p_session->>'mode',
    p_session->'filter',
    (p_session->>'startedAt')::timestamptz,
    nullif(p_session->>'timeLimitS', '')::int,
    (p_session->>'total')::int,
    p_session->>'clientVersion'
  )
  on conflict (id) do nothing;
end $$;

create or replace function public.lt_record_answers(p_pass text, p_session uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a jsonb; q jsonb;
begin
  perform lt_check(p_pass);
  for a in select * from jsonb_array_elements(p_answers) loop
    q := a->'question';
    insert into lt_questions (id, area, subtype, difficulty, source, generator, seed, prompt, options, correct, explanation, figure)
    values (
      q->>'id', q->>'area', q->>'subtype', (q->>'difficulty')::int, q->>'source',
      q->>'generator', nullif(q->>'seed', '')::bigint, q->>'prompt', q->'options',
      (q->>'correct')::int, q->>'explanation', q->'figure'
    )
    on conflict (id) do update set
      prompt = excluded.prompt, options = excluded.options, correct = excluded.correct,
      explanation = excluded.explanation, figure = excluded.figure, difficulty = excluded.difficulty;

    insert into lt_answers (session_id, question_id, position, chosen, is_correct, skipped, time_ms, paused_ms, answered_at)
    values (
      p_session, q->>'id', (a->>'position')::int,
      nullif(a->>'chosen', '')::int, (a->>'isCorrect')::boolean,
      coalesce((a->>'skipped')::boolean, false),
      (a->>'timeMs')::int, coalesce((a->>'pausedMs')::int, 0),
      coalesce((a->>'answeredAt')::timestamptz, now())
    )
    on conflict (session_id, position) do nothing;
  end loop;
end $$;

create or replace function public.lt_finish_session(p_pass text, p_session uuid, p_summary jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform lt_check(p_pass);
  update lt_sessions set
    ended_at = coalesce((p_summary->>'endedAt')::timestamptz, now()),
    paused_total_ms = coalesce((p_summary->>'pausedTotalMs')::int, 0),
    answered = (p_summary->>'answered')::int,
    correct = (p_summary->>'correct')::int,
    metrics = p_summary->'metrics'
  where id = p_session;
end $$;

create or replace function public.lt_history(p_pass text, p_n int default 20) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare result jsonb;
begin
  perform lt_check(p_pass);
  with s as (
    select * from lt_sessions order by started_at desc limit greatest(1, least(p_n, 200))
  )
  select jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) order by s.started_at desc) from s), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', a.session_id, 'position', a.position, 'area', q.area, 'subtype', q.subtype,
        'is_correct', a.is_correct, 'skipped', a.skipped, 'time_ms', a.time_ms,
        'started_at', s.started_at) order by s.started_at, a.position)
      from lt_answers a join s on s.id = a.session_id join lt_questions q on q.id = a.question_id
    ), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.lt_auth(text), public.lt_start_session(text, jsonb),
  public.lt_record_answers(text, uuid, jsonb), public.lt_finish_session(text, uuid, jsonb),
  public.lt_history(text, int) from public;
grant execute on function public.lt_auth(text), public.lt_start_session(text, jsonb),
  public.lt_record_answers(text, uuid, jsonb), public.lt_finish_session(text, uuid, jsonb),
  public.lt_history(text, int) to anon, authenticated;
