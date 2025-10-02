-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- Airports table
create table if not exists public.airports (
  id uuid primary key default uuid_generate_v4(),
  iata text not null check (char_length(iata) = 3),
  icao text check (char_length(icao) = 4),
  name text not null,
  city text,
  state text,
  country text not null,
  location geography(Point, 4326)
);

create unique index if not exists airports_iata_unique on public.airports (upper(iata));
create unique index if not exists airports_icao_unique on public.airports (upper(icao)) where icao is not null;
create index if not exists airports_location_idx on public.airports using gist (location);

-- Airlines table
create table if not exists public.airlines (
  id uuid primary key default uuid_generate_v4(),
  iata text not null check (char_length(iata) = 2),
  icao text check (char_length(icao) = 3),
  name text not null
);

create unique index if not exists airlines_iata_unique on public.airlines (upper(iata));
create unique index if not exists airlines_icao_unique on public.airlines (upper(icao)) where icao is not null;

-- Alerts table
do $$ begin
  create type alert_status as enum ('active', 'completed', 'deleted');
exception when duplicate_object then null; end $$;

create table if not exists public.alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  filters jsonb not null default '{}'::jsonb,
  status alert_status not null default 'active',
  alert_end timestamptz,
  created_at timestamptz not null default now()
);

-- RLS setup (basic owner policy)
alter table public.alerts enable row level security;
create policy if not exists "Users can manage their alerts" on public.alerts
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
