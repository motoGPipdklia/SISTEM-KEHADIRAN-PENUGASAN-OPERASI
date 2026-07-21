const supabase = window.supabase.createClient(
  window.SKPO_CONFIG.SUPABASE_URL,
  window.SKPO_CONFIG.SUPABASE_ANON_KEY
);

window.supabaseClient = supabase;

console.log("✅ Supabase Connected");
