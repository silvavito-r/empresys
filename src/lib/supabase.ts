import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// For full typing, run: npx supabase gen types typescript --project-id uycutwogahbtpniibtoh > src/types/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
