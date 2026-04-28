-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ─────────────────────────────────────────────
-- USERS (profile data, extends auth.users)
-- ─────────────────────────────────────────────
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  email         text unique not null,
  name          text,
  photo         text,
  neighborhood  text,
  role          text not null default 'individual' check (role in ('individual','restaurant')),
  dietary_prefs text[] not null default '{}',
  id_verified   boolean not null default false,
  id_doc_url    text,
  id_doc_status text not null default 'none' check (id_doc_status in ('none','pending','approved','rejected')),
  avg_rating    numeric(3,2) not null default 0,
  rating_count  integer not null default 0,
  total_shared  integer not null default 0,
  total_claimed integer not null default 0,
  is_suspended  boolean not null default false,
  is_admin      boolean not null default false,
  profile_complete boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- LISTINGS
-- ─────────────────────────────────────────────
create table public.listings (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users(id) on delete cascade,
  title             text not null,
  description       text not null default '',
  photos            text[] not null default '{}',
  expiry_date       date not null,
  categories        text[] not null default '{}',
  storage_condition text not null default 'room_temperature'
    check (storage_condition in ('room_temperature','refrigerated','frozen')),
  pickup_address    text not null default '',
  pickup_lat        numeric,
  pickup_lng        numeric,
  neighborhood      text not null default '',
  dietary_tags      text[] not null default '{}',
  status            text not null default 'active'
    check (status in ('active','reserved','claimed','expired','removed')),
  created_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- CLAIMS
-- ─────────────────────────────────────────────
create table public.claims (
  id                        uuid primary key default uuid_generate_v4(),
  listing_id                uuid not null references public.listings(id) on delete cascade,
  claimer_id                uuid not null references public.users(id) on delete cascade,
  status                    text not null default 'active'
    check (status in ('active','cancelled','completed')),
  pickup_confirmed_lister   boolean not null default false,
  pickup_confirmed_claimer  boolean not null default false,
  rated_by_lister           boolean not null default false,
  rated_by_claimer          boolean not null default false,
  created_at                timestamptz not null default now(),
  unique(listing_id, claimer_id)
);

-- ─────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────
create table public.messages (
  id         uuid primary key default uuid_generate_v4(),
  claim_id   uuid not null references public.claims(id) on delete cascade,
  sender_id  uuid not null references public.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- RATINGS
-- ─────────────────────────────────────────────
create table public.ratings (
  id         uuid primary key default uuid_generate_v4(),
  claim_id   uuid not null references public.claims(id) on delete cascade,
  rater_id   uuid not null references public.users(id) on delete cascade,
  ratee_id   uuid not null references public.users(id) on delete cascade,
  stars      integer not null check (stars between 1 and 5),
  review     text not null default '',
  created_at timestamptz not null default now(),
  unique(claim_id, rater_id)
);

-- ─────────────────────────────────────────────
-- REPORTS
-- ─────────────────────────────────────────────
create table public.reports (
  id          uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  listing_id  uuid references public.listings(id) on delete set null,
  reason      text not null,
  status      text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null,
  data       jsonb not null default '{}',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- TRIGGER: create public.users row on auth.users insert
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  _username text;
  _name     text;
  _neighborhood text;
  _role     text;
  _dietary  text[];
begin
  _username     := new.raw_user_meta_data->>'username';
  _name         := new.raw_user_meta_data->>'name';
  _neighborhood := new.raw_user_meta_data->>'neighborhood';
  _role         := coalesce(new.raw_user_meta_data->>'role', 'individual');
  select array(
    select jsonb_array_elements_text(new.raw_user_meta_data->'dietary_prefs')
  ) into _dietary;

  -- first user becomes admin
  insert into public.users (id, username, email, name, neighborhood, role, dietary_prefs, is_admin)
  values (
    new.id,
    _username,
    new.email,
    _name,
    _neighborhood,
    _role,
    coalesce(_dietary, '{}'),
    (select count(*) = 0 from public.users)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- TRIGGER: update avg_rating on ratings insert
-- ─────────────────────────────────────────────
create or replace function public.update_avg_rating()
returns trigger language plpgsql security definer as $$
begin
  update public.users
  set
    avg_rating   = (select avg(stars) from public.ratings where ratee_id = new.ratee_id),
    rating_count = (select count(*)   from public.ratings where ratee_id = new.ratee_id)
  where id = new.ratee_id;
  return new;
end;
$$;

create trigger after_rating_insert
  after insert on public.ratings
  for each row execute procedure public.update_avg_rating();

-- ─────────────────────────────────────────────
-- RPC: resolve username → email (for login)
-- ─────────────────────────────────────────────
create or replace function public.get_email_by_username(p_username text)
returns text language plpgsql security definer as $$
declare
  v_email text;
begin
  select email into v_email from public.users where username = p_username;
  return v_email;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: search listings by distance (Haversine)
-- ─────────────────────────────────────────────
create or replace function public.search_listings_nearby(
  p_lat         numeric default null,
  p_lng         numeric default null,
  p_radius_km   numeric default 10,
  p_categories  text[]  default null,
  p_dietary     text[]  default null,
  p_storage     text    default null,
  p_search      text    default null,
  p_limit       integer default 50,
  p_offset      integer default 0
)
returns table (
  id                uuid,
  user_id           uuid,
  title             text,
  description       text,
  photos            text[],
  expiry_date       date,
  categories        text[],
  storage_condition text,
  pickup_address    text,
  pickup_lat        numeric,
  pickup_lng        numeric,
  neighborhood      text,
  dietary_tags      text[],
  status            text,
  created_at        timestamptz,
  distance_km       numeric,
  lister_name       text,
  lister_photo      text,
  lister_avg_rating numeric,
  lister_role       text
) language plpgsql security definer as $$
begin
  return query
  select
    l.id, l.user_id, l.title, l.description, l.photos,
    l.expiry_date, l.categories, l.storage_condition,
    l.pickup_address, l.pickup_lat, l.pickup_lng,
    l.neighborhood, l.dietary_tags, l.status, l.created_at,
    case
      when p_lat is not null and p_lng is not null and l.pickup_lat is not null and l.pickup_lng is not null
      then round(cast(
        6371 * acos(
          least(1.0, cos(radians(p_lat)) * cos(radians(l.pickup_lat))
          * cos(radians(l.pickup_lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(l.pickup_lat))
        )
      ) as numeric), 2)
      else null
    end as distance_km,
    u.name, u.photo, u.avg_rating, u.role
  from public.listings l
  join public.users u on u.id = l.user_id
  where
    l.status = 'active'
    and (p_categories is null or l.categories && p_categories)
    and (p_dietary     is null or l.dietary_tags && p_dietary)
    and (p_storage     is null or l.storage_condition = p_storage)
    and (p_search      is null or l.title ilike '%' || p_search || '%' or l.description ilike '%' || p_search || '%')
    and (
      p_lat is null or p_lng is null or l.pickup_lat is null or l.pickup_lng is null
      or 6371 * acos(
          least(1.0, cos(radians(p_lat)) * cos(radians(l.pickup_lat))
          * cos(radians(l.pickup_lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(l.pickup_lat))
        )
      ) <= p_radius_km
    )
  order by distance_km asc nulls last, l.created_at desc
  limit p_limit offset p_offset;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: claim a listing (atomic, prevents race)
-- ─────────────────────────────────────────────
create or replace function public.claim_listing(p_listing_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_claim_id uuid;
  v_status   text;
begin
  -- lock the listing row
  select status into v_status from public.listings where id = p_listing_id for update;
  if v_status is null then
    raise exception 'listing_not_found';
  end if;
  if v_status <> 'active' then
    raise exception 'listing_not_available';
  end if;

  -- insert claim
  insert into public.claims (listing_id, claimer_id)
  values (p_listing_id, auth.uid())
  returning id into v_claim_id;

  -- mark listing reserved
  update public.listings set status = 'reserved' where id = p_listing_id;

  -- increment total_claimed for claimer
  update public.users set total_claimed = total_claimed + 1 where id = auth.uid();

  return v_claim_id;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: confirm pickup (both sides)
-- ─────────────────────────────────────────────
create or replace function public.confirm_pickup(p_claim_id uuid)
returns void language plpgsql security definer as $$
declare
  v_claim     public.claims%rowtype;
  v_listing   public.listings%rowtype;
  v_caller    uuid := auth.uid();
  v_is_lister boolean;
begin
  select * into v_claim from public.claims where id = p_claim_id for update;
  if not found then raise exception 'claim_not_found'; end if;

  select * into v_listing from public.listings where id = v_claim.listing_id;
  v_is_lister := v_listing.user_id = v_caller;

  if v_is_lister then
    update public.claims set pickup_confirmed_lister = true where id = p_claim_id;
  else
    update public.claims set pickup_confirmed_claimer = true where id = p_claim_id;
  end if;

  -- if both confirmed → complete
  if (v_is_lister and v_claim.pickup_confirmed_claimer)
     or (not v_is_lister and v_claim.pickup_confirmed_lister)
  then
    update public.claims set status = 'completed' where id = p_claim_id;
    update public.listings set status = 'claimed' where id = v_claim.listing_id;
    -- increment total_shared for lister
    update public.users set total_shared = total_shared + 1 where id = v_listing.user_id;
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: expire listings (called by pg_cron)
-- ─────────────────────────────────────────────
create or replace function public.expire_listings()
returns void language plpgsql security definer as $$
begin
  update public.listings
  set status = 'expired'
  where status = 'active' and expiry_date < current_date;

  -- cancel active claims on expired listings
  update public.claims c
  set status = 'cancelled'
  from public.listings l
  where c.listing_id = l.id
    and l.status = 'expired'
    and c.status = 'active';
end;
$$;

-- Schedule expiry check every hour
select cron.schedule('expire-listings', '0 * * * *', 'select public.expire_listings()');

-- ─────────────────────────────────────────────
-- REALTIME publications
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.claims;

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

-- users
alter table public.users enable row level security;
create policy "users: public read"  on public.users for select using (true);
create policy "users: own update"   on public.users for update using (auth.uid() = id);
create policy "users: admin update" on public.users for update
  using (exists (select 1 from public.users where id = auth.uid() and is_admin));

-- listings
alter table public.listings enable row level security;
create policy "listings: public read"  on public.listings for select using (true);
create policy "listings: own insert"   on public.listings for insert with check (auth.uid() = user_id);
create policy "listings: own update"   on public.listings for update using (auth.uid() = user_id);
create policy "listings: admin update" on public.listings for update
  using (exists (select 1 from public.users where id = auth.uid() and is_admin));
create policy "listings: own delete"   on public.listings for delete using (auth.uid() = user_id);

-- claims
alter table public.claims enable row level security;
create policy "claims: parties read"  on public.claims for select
  using (
    claimer_id = auth.uid()
    or exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  );
create policy "claims: insert via rpc" on public.claims for insert with check (claimer_id = auth.uid());
create policy "claims: parties update" on public.claims for update
  using (
    claimer_id = auth.uid()
    or exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  );

-- messages
alter table public.messages enable row level security;
create policy "messages: claim parties read" on public.messages for select
  using (
    exists (
      select 1 from public.claims c
      join public.listings l on l.id = c.listing_id
      where c.id = claim_id
        and (c.claimer_id = auth.uid() or l.user_id = auth.uid())
    )
  );
create policy "messages: claim parties insert" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.claims c
      join public.listings l on l.id = c.listing_id
      where c.id = claim_id
        and (c.claimer_id = auth.uid() or l.user_id = auth.uid())
    )
  );

-- ratings
alter table public.ratings enable row level security;
create policy "ratings: public read"   on public.ratings for select using (true);
create policy "ratings: own insert"    on public.ratings for insert with check (rater_id = auth.uid());

-- reports
alter table public.reports enable row level security;
create policy "reports: own insert"    on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports: own read"      on public.reports for select
  using (
    reporter_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and is_admin)
  );
create policy "reports: admin update"  on public.reports for update
  using (exists (select 1 from public.users where id = auth.uid() and is_admin));

-- notifications
alter table public.notifications enable row level security;
create policy "notifs: own read"   on public.notifications for select using (user_id = auth.uid());
create policy "notifs: own update" on public.notifications for update using (user_id = auth.uid());
