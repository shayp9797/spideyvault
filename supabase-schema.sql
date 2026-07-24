create extension if not exists pgcrypto;
create table if not exists public.release_candidates (
 id uuid primary key default gen_random_uuid(), name text not null, source_url text unique not null, image_url text, box_number text, product_type text, search_term text,
 status text not null default 'pending' check(status in('pending','approved','ignored')), discovered_at timestamptz not null default now(), reviewed_at timestamptz
);
create table if not exists public.price_checks (
 id bigint generated always as identity primary key, query text not null, count integer, median numeric, average numeric, low numeric, high numeric, currency text,
 search_url text, note text, checked_at timestamptz not null default now()
);
alter table public.release_candidates enable row level security;
alter table public.price_checks enable row level security;
-- No public policies are required: server functions use the secret key.
