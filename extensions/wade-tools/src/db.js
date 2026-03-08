import { createClient } from "@supabase/supabase-js";
let _supabase = null;
export function getSupabase() {
    if (_supabase)
        return _supabase;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }
    _supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return _supabase;
}
//# sourceMappingURL=db.js.map