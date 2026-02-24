import { supabase } from './supabase'

export async function logAction(action: string, details?: Record<string, unknown>) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('system_logs').insert({
      action,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      details: details ?? null,
    })
  } catch {
    // Silently fail — logs are non-critical
  }
}
