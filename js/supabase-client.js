/* ================================================================
   SKPO — SAMBUNGAN SUPABASE

   Fail ini mesti dimuatkan selepas:
   1. @supabase/supabase-js@2
   2. js/api-config.js
================================================================ */

(function mulakanSupabaseSKPO() {
  "use strict";

  window.SKPO_SUPABASE_READY = false;
  window.SKPO_SUPABASE_ERROR = "";

  try {
    const konfigurasi = window.SKPO_CONFIG || {};

    const projectUrlInput = String(
      konfigurasi.SUPABASE_URL || ""
    ).trim();

    /*
      Ambil origin projek sahaja. Ini turut membetulkan konfigurasi yang
      tersilap ditampal sebagai /functions/v1/... atau /auth/v1/....
    */
    let projectUrl = "";

    try {
      const url = new URL(projectUrlInput);

      if (
        url.protocol !== "https:" ||
        !url.hostname.endsWith(".supabase.co")
      ) {
        throw new Error("Domain Supabase tidak sah.");
      }

      projectUrl = url.origin;
    } catch (_) {
      throw new Error(
        "SUPABASE_URL tidak sah. Gunakan URL projek seperti https://PROJECT-ID.supabase.co"
      );
    }

    /*
      Menyokong kedua-dua nama kerana projek Supabase lama mungkin
      menggunakan ANON_KEY manakala projek baharu menggunakan
      PUBLISHABLE_KEY.
    */
    const publishableKey = String(
      konfigurasi.SUPABASE_PUBLISHABLE_KEY ||
      konfigurasi.SUPABASE_ANON_KEY ||
      ""
    ).trim();

    if (!projectUrl || !publishableKey) {
      throw new Error(
        "Project URL atau Publishable Key belum dimasukkan dalam js/api-config.js."
      );
    }

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      throw new Error(
        "Pustaka Supabase tidak berjaya dimuatkan daripada CDN."
      );
    }

    /*
      Jangan gunakan: const supabase = ...
      Nama tersebut boleh bertembung dengan window.supabase daripada CDN.
    */
    const klienSKPO = window.supabase.createClient(
      projectUrl,
      publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "skpo-supabase-auth"
        },
        global: {
          headers: {
            "X-Client-Info": "skpo-github-pages"
          }
        }
      }
    );

    window.supabaseClient = klienSKPO;
    window.skpoSupabase = klienSKPO;
    window.SKPO_SUPABASE_READY = true;

    console.info("SKPO: Sambungan Supabase telah dimulakan.");
  } catch (error) {
    window.supabaseClient = null;
    window.skpoSupabase = null;
    window.SKPO_SUPABASE_READY = false;
    window.SKPO_SUPABASE_ERROR =
      error?.message || "Sambungan Supabase gagal dimulakan.";

    console.error(
      "SKPO: Sambungan Supabase gagal:",
      error
    );
  }
})();
