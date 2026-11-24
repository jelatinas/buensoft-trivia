import { createClient } from "@supabase/supabase-js";

// Credenciales compartidas con Buensoft Evalua (fminldhflehobacskjfp.supabase.co)
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://fminldhflehobacskjfp.supabase.co";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_c2iAk4irD5NHosm7q5tFrw_iK07fI0A";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
