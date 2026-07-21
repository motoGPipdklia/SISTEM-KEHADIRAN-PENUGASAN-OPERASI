// SKPO Supabase Client

window.supabaseClient = window.supabase.createClient(
    window.SKPO_CONFIG.SUPABASE_URL,
    window.SKPO_CONFIG.SUPABASE_ANON_KEY
);

console.log("✅ Supabase Connected");
