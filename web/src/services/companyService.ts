import { getSupabase } from './supabaseClient'

// Only files under services/ talk to Supabase directly -- see
// docs/engineering/folder-structure.md. Its own small file rather than
// folded into adminService.ts: reading the company name is deliberately
// public (get_company_name() takes no passcode -- see
// web/supabase/migrations/011_company_branding.sql), used by
// client-facing pages that never see an admin passcode at all, unlike
// everything else adminService.ts talks to.

export async function getCompanyName(): Promise<string | null> {
  const result = (await getSupabase().rpc('get_company_name')) as { data: string | null; error: Error | null }
  if (result.error) throw result.error
  return result.data ?? null
}

export async function setCompanyName(passcode: string, companyName: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_company_name', {
    p_admin_passcode: passcode,
    p_company_name: companyName,
  })
  if (error) throw error
}
