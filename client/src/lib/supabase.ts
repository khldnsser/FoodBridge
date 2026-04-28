import { createClient } from '@supabase/supabase-js';

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function getSupabaseUrl() {
  if (!configuredSupabaseUrl) return window.location.origin;

  const isConfiguredLoopback = /:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(configuredSupabaseUrl);
  const isRemoteClient = !['localhost', '127.0.0.1'].includes(window.location.hostname);

  // When a phone opens the dev app over LAN, localhost/127.0.0.1 should resolve via Vite proxy.
  if (isConfiguredLoopback && isRemoteClient) return window.location.origin;

  return configuredSupabaseUrl;
}

const supabaseUrl = getSupabaseUrl();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});
