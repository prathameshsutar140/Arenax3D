// Optional Supabase client configuration helper.
// When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided, ArenaX 3D
// recognizes external Supabase configuration; otherwise the built-in Express +
// WebSocket transactional backend handles auth, locking, and persistence.

export interface SupabaseConfig {
  url: string | undefined;
  anonKey: string | undefined;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
}
