-- Kargo hiring desk. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Tables are prefixed kargo_ so this can safely share a Supabase project with other apps.

create table if not exists public.kargo_candidates (
  id              text primary key,
  name            text,
  email           text,
  role            text not null check (role in ('PM', 'SPM')),
  stage           text not null,
  score           integer,                 -- total for the role applied
  other_score     integer,                 -- same CV scored for the other role
  rubric_decision text,                    -- ADVANCE / HOLD / PASS / FLAG from the rubric
  final_decision  text,                    -- founder's override, else the rubric decision
  file_name       text,
  cv_path         text,                    -- object path in the private "kargo-cvs" bucket
  sent_at         timestamptz,
  sent_kind       text,
  data            jsonb not null,          -- full candidate: evidence, brief, email draft, redacted CV text
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists kargo_candidates_role_score on public.kargo_candidates (role, score desc);
create index if not exists kargo_candidates_decision on public.kargo_candidates (final_decision);

-- Every email that actually went out through Resend.
create table if not exists public.kargo_email_log (
  id           bigint generated always as identity primary key,
  candidate_id text references public.kargo_candidates (id) on delete set null,
  to_email     text not null,
  kind         text not null,
  subject      text not null,
  body         text not null,
  resend_id    text,
  sent_at      timestamptz not null default now()
);

-- Only the server (service-role key) touches these. RLS on with no policies = anon/public key gets nothing.
alter table public.kargo_candidates enable row level security;
alter table public.kargo_email_log enable row level security;

-- Private bucket for original CV files.
insert into storage.buckets (id, name, public)
values ('kargo-cvs', 'kargo-cvs', false)
on conflict (id) do nothing;
