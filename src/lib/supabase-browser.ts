import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  _client = createClient(url, key, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });

  return _client;
}

// Lazy singleton — solo se crea cuando se usa en el browser
export const supabaseBrowser = typeof window !== "undefined"
  ? getSupabaseBrowser()
  : (null as unknown as SupabaseClient);
