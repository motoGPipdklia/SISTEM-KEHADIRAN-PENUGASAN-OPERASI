import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization") || "";

    const penggunaClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await penggunaClient.auth.getUser();
    if (userError || !userData.user) {
      throw new Error("Sesi Pentadbir tidak sah.");
    }

    const { data: pentadbir, error: profilError } = await adminClient
      .from("profiles")
      .select("peranan, aktif")
      .eq("id", userData.user.id)
      .single();

    if (profilError || !pentadbir || pentadbir.aktif !== true || pentadbir.peranan !== "PENTADBIR") {
      throw new Error("Hanya Pentadbir boleh mencipta pengguna.");
    }

    const body = await req.json();
    const noBadan = String(body.no_badan || body.noBadan || "").trim().toUpperCase();
    const pangkat = String(body.pangkat || "").trim().toUpperCase();
    const nama = String(body.nama || "").trim().toUpperCase();
    const peranan = String(body.peranan || "PETUGAS").trim().toUpperCase();
    const password = String(body.password || "");

    if (!noBadan || !pangkat || !nama || password.length < 8) {
      throw new Error("Maklumat pengguna tidak lengkap atau kata laluan terlalu pendek.");
    }

    const perananSah = ["PETUGAS", "PENYELIA", "URUSETIA", "PENTADBIR", "TSM"];
    if (!perananSah.includes(peranan)) {
      throw new Error("Peranan pengguna tidak sah.");
    }

    const email = `${noBadan.toLowerCase().replace(/[^a-z0-9_-]/g, "")}@skpo.local`;

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { no_badan: noBadan, nama },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Akaun Authentication gagal dicipta.");
    }

    const { error: insertError } = await adminClient.from("profiles").insert({
      id: authData.user.id,
      no_badan: noBadan,
      pangkat,
      nama,
      peranan,
      telefon: String(body.telefon || "").trim() || null,
      bahagian: String(body.bahagian || "").trim().toUpperCase() || null,
      daerah: String(body.daerah || "").trim().toUpperCase() || null,
      aktif: true,
    });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      throw new Error(insertError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Pengguna berjaya didaftarkan.",
      user_id: authData.user.id,
      email,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : "Ralat tidak diketahui.",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
