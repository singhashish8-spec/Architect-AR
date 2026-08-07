import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazily initialized, not created at module load time. Routes that don't
// touch Supabase at all (e.g. pages/LocalPreview.tsx) shouldn't crash just
// because env vars aren't configured yet -- only the code path that
// actually needs Supabase should ever hit the error below.
let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (client) return client

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy web/.env.example to ' +
        'web/.env.local and fill in real values -- see docs/engineering/environment.md.',
    )
  }

  client = createClient(supabaseUrl, supabaseAnonKey)
  return client
}
