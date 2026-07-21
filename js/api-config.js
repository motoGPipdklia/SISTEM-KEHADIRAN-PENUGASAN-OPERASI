/*
  SKPO API CONFIGURATION

  GitHub Pages hanya menghoskan frontend. Fail ini disediakan sebagai
  tempat sambungan backend baharu seperti Supabase atau REST API.

  Semasa migrasi seterusnya:
  1. Masukkan URL backend.
  2. Tukarkan semua google.script.run dalam fail js/*.js kepada fetch()
     atau fungsi Supabase.
*/

window.SKPO_CONFIG = {
  API_BASE_URL: "",

  SUPABASE_URL: "https://ukapxshyhqtsseraphnn.supabase.co",

  SUPABASE_ANON_KEY: "sb_publishable_2Px0J5xxzhIyWu0FkGoQEw_ezyOZXvt"
};

window.SKPO_BACKEND_READY =
  Boolean(window.SKPO_CONFIG.API_BASE_URL || window.SKPO_CONFIG.SUPABASE_URL);
