-- Drop the handle_new_user trigger (registration now done explicitly via RPC)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ─────────────────────────────────────────────
-- RPC: register_user (called from client after auth.signUp)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_user(
  p_username      text,
  p_name          text,
  p_neighborhood  text DEFAULT '',
  p_role          text DEFAULT 'individual',
  p_dietary_prefs text[] DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, username, email, name, neighborhood, role, dietary_prefs, is_admin)
  VALUES (
    auth.uid(),
    p_username,
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    p_name,
    COALESCE(p_neighborhood, ''),
    COALESCE(p_role, 'individual'),
    COALESCE(p_dietary_prefs, '{}'),
    (SELECT COUNT(*) = 0 FROM public.users)
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────
-- UPDATE expire_listings to send notifications
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_listings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Expire active listings past their expiry date and notify listers
  FOR rec IN
    SELECT l.id, l.user_id, l.title
    FROM public.listings l
    WHERE l.status = 'active' AND l.expiry_date < current_date
  LOOP
    UPDATE public.listings SET status = 'expired' WHERE id = rec.id;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      rec.user_id,
      'listing_expired',
      'Your listing expired',
      'Your listing "' || rec.title || '" has expired and is no longer visible to others.',
      jsonb_build_object('listing_id', rec.id)
    );
  END LOOP;

  -- Cancel active claims on expired listings and notify claimers
  FOR rec IN
    SELECT c.id AS claim_id, c.claimer_id, l.title, l.id AS listing_id
    FROM public.claims c
    JOIN public.listings l ON l.id = c.listing_id
    WHERE l.status = 'expired' AND c.status = 'active'
  LOOP
    UPDATE public.claims SET status = 'cancelled' WHERE id = rec.claim_id;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      rec.claimer_id,
      'claim_cancelled_expiry',
      'Claim cancelled',
      'Your claim for "' || rec.title || '" was cancelled because the listing expired.',
      jsonb_build_object('listing_id', rec.listing_id)
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- RPC: notify_expiry_soon (24h advance warning)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_expiry_soon()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    l.user_id,
    'listing_expiring_soon',
    'Listing expiring tomorrow',
    'Your listing "' || l.title || '" expires tomorrow. Update it if you still have food available.',
    jsonb_build_object('listing_id', l.id)
  FROM public.listings l
  WHERE
    l.status = 'active'
    AND l.expiry_date = current_date + INTERVAL '1 day'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE (n.data->>'listing_id') = l.id::text
        AND n.type = 'listing_expiring_soon'
        AND n.created_at > now() - INTERVAL '25 hours'
    );
END;
$$;

-- Schedule daily expiry-soon check at 9 AM
SELECT cron.schedule('notify-expiry-soon', '0 9 * * *', 'SELECT public.notify_expiry_soon()');
