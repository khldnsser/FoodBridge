-- Add price columns to listings
alter table public.listings
  add column if not exists original_price numeric default null,
  add column if not exists listing_price  numeric not null default 0;

-- Update search_listings_nearby to include price fields
drop function if exists public.search_listings_nearby(numeric,numeric,numeric,text[],text[],text,text,integer,integer);

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
  lister_role       text,
  original_price    numeric,
  listing_price     numeric
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
    u.name, u.photo, u.avg_rating, u.role,
    l.original_price, l.listing_price
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
