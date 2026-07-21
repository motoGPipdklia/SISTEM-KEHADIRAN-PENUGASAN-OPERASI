"use strict";

/* ================================================================
   SKPO — MODUL WALKIE-TALKIE PETUGAS
================================================================ */

(function modulWalkiePetugas() {
  const dbWalkie = window.supabaseClient;
  const ZON_MASA_WALKIE = "Asia/Kuala_Lumpur";

  const state = {
    profil: null,
    penugasan: null,
    rekod: null,
    proses: false
  };

  function elemen(id) {
    return document.getElementById(id);
  }

  function teks(nilai) {
    return String(nilai ?? "").trim();
  }

  function atas(nilai) {
    return teks(nilai).toUpperCase();
  }

  function htmlSelamat(nilai) {
    return String(nilai ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function hariIni() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: ZON_MASA_WALKIE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function formatMasa(nilai) {
    if (!nilai) return "-";
    const tarikh = new Date(nilai);
    if (Number.isNaN(tarikh.getTime())) return teks(nilai) || "-";

    return new Intl.DateTimeFormat("ms-MY", {
      timeZone: ZON_MASA_WALKIE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(tarikh);
  }

  function nilaiBoolean(nilai) {
    return nilai === true || [
      "YA", "YES", "Y", "1", "TRUE", "BENAR"
    ].includes(atas(nilai));
  }

  function paparStatus(mesej, jenis = "warning") {
    const status = elemen("statusWalkiePetugas");
    if (!status) return;
    status.className = `status ${jenis}`;
    status.innerHTML = htmlSelamat(mesej);
  }

  function sembunyiStatus() {
    const status = elemen("statusWalkiePetugas");
    if (!status) return;
    status.className = "hidden";
    status.innerHTML = "";
  }

  async function dapatkanSesi() {
    if (!dbWalkie?.auth) throw new Error("Sambungan Supabase tidak tersedia.");

    const { data, error } = await dbWalkie.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) throw new Error("Sila login terlebih dahulu.");

    return data.session.user;
  }

  async function dapatkanProfil() {
    const pengguna = await dapatkanSesi();

    let hasil = await dbWalkie
      .from("profiles")
      .select("*")
      .eq("id", pengguna.id)
      .maybeSingle();

    if (hasil.error && /auth_user_id/i.test(hasil.error.message || "")) {
      hasil = await dbWalkie
        .from("profiles")
        .select("*")
        .eq("auth_user_id", pengguna.id)
        .maybeSingle();
    }

    if (hasil.error) throw hasil.error;
    if (!hasil.data) throw new Error("Profil petugas tidak ditemui.");

    state.profil = hasil.data;
    return hasil.data;
  }

  async function dapatkanPenugasan() {
    const profil = state.profil || await dapatkanProfil();

    let hasil = await dbWalkie
      .from("penugasan")
      .select("*")
      .eq("petugas_id", profil.id)
      .eq("tarikh", hariIni())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hasil.error && /petugas_id|tarikh/i.test(hasil.error.message || "")) {
      hasil = await dbWalkie
        .from("penugasan")
        .select("*")
        .eq("profile_id", profil.id)
        .eq("tarikh_tugas", hariIni())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (hasil.error) throw hasil.error;
    state.penugasan = hasil.data || null;
    return state.penugasan;
  }

  async function dapatkanRekod() {
    if (!state.penugasan || !state.profil) {
      state.rekod = null;
      return null;
    }

    const { data, error } = await dbWalkie
      .from("walkie_talkie")
      .select("*")
      .eq("penugasan_id", state.penugasan.id)
      .eq("petugas_id", state.profil.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    state.rekod = data || null;
    return state.rekod;
  }

  function kelasStatus(status) {
    if (status === "DILEPASKAN") return "walkie-dilepaskan";
    if (status === "DIPULANGKAN") return "walkie-dipulangkan";
    if (status === "DITOLAK") return "walkie-ditolak";
    return "walkie-menunggu";
  }

  function formatAksesori(nilai) {
    if (Array.isArray(nilai)) return nilai.join(", ") || "-";
    return teks(nilai) || "-";
  }

  function paparanTiadaTugasan(mesej) {
    return `
      <div class="walkie-empty">
        <div class="walkie-empty-icon">📻</div>
        <strong>${htmlSelamat(mesej)}</strong>
      </div>
    `;
  }

  function paparanBelumMohon() {
    const tugas = state.penugasan;

    return `
      <div class="walkie-info-grid">
        <div>
          <span class="walkie-label">Penugasan</span>
          <strong>${htmlSelamat(tugas.jenis_tugas || "-")}</strong>
        </div>
        <div>
          <span class="walkie-label">Lokasi</span>
          <strong>${htmlSelamat(tugas.tempat_tugas || tugas.lokasi || "-")}</strong>
        </div>
        <div>
          <span class="walkie-label">Status</span>
          <span class="walkie-badge walkie-tiada">BELUM MEMOHON</span>
        </div>
      </div>
      <button class="btn-main" type="button" onclick="SKPOWalkie.daftar()">
        MOHON SET WALKIE-TALKIE
      </button>
    `;
  }

  function paparanRekod() {
    const rekod = state.rekod;
    const status = atas(rekod.status);
    const kelas = kelasStatus(status);

    let keterangan = "Permohonan sedang menunggu tindakan TSM.";
    if (status === "DILEPASKAN") keterangan = "Set telah dilepaskan oleh TSM.";
    if (status === "MENUNGGU_PEMULANGAN") keterangan = "Pemulangan sedang menunggu pengesahan TSM.";
    if (status === "DIPULANGKAN") keterangan = "Pemulangan set telah disahkan oleh TSM.";
    if (status === "DITOLAK") keterangan = rekod.sebab_ditolak || "Permohonan ditolak oleh TSM.";

    return `
      <div class="walkie-info-grid">
        <div>
          <span class="walkie-label">Status</span>
          <span class="walkie-badge ${kelas}">${htmlSelamat(status)}</span>
        </div>
        <div>
          <span class="walkie-label">No Siri Set</span>
          <strong>${htmlSelamat(rekod.no_siri_set || "-")}</strong>
        </div>
        <div>
          <span class="walkie-label">No Siri Bateri</span>
          <strong>${htmlSelamat(rekod.no_siri_bateri || "-")}</strong>
        </div>
        <div>
          <span class="walkie-label">No Siri Charger</span>
          <strong>${htmlSelamat(rekod.no_siri_charger || "-")}</strong>
        </div>
        <div>
          <span class="walkie-label">Aksesori</span>
          <strong>${htmlSelamat(formatAksesori(rekod.aksesori))}</strong>
        </div>
        <div>
          <span class="walkie-label">Masa Permohonan</span>
          <strong>${htmlSelamat(formatMasa(rekod.masa_permohonan || rekod.created_at))}</strong>
        </div>
      </div>
      <div class="walkie-notis ${kelas}">${htmlSelamat(keterangan)}</div>
      ${status === "DILEPASKAN" ? `
        <button class="return-set-button" type="button" onclick="SKPOWalkie.pulang()">
          MOHON PEMULANGAN SET
        </button>
      ` : ""}
    `;
  }

  async function paparModul() {
    const kandungan = elemen("kandunganWalkiePetugas");
    if (!kandungan) return;

    kandungan.innerHTML = '<div class="walkie-loading">Sedang mendapatkan maklumat set...</div>';
    sembunyiStatus();

    try {
      await dapatkanProfil();
      const penugasan = await dapatkanPenugasan();

      if (!penugasan) {
        kandungan.innerHTML = paparanTiadaTugasan("Tiada penugasan hari ini.");
        return;
      }

      if (atas(penugasan.status) === "DIGANTI") {
        kandungan.innerHTML = paparanTiadaTugasan("Penugasan anda berstatus DIGANTI.");
        return;
      }

      if (!nilaiBoolean(penugasan.pemegang_set)) {
        kandungan.innerHTML = paparanTiadaTugasan("Anda bukan Pemegang Set bagi penugasan hari ini.");
        return;
      }

      await dapatkanRekod();
      kandungan.innerHTML = state.rekod ? paparanRekod() : paparanBelumMohon();
    } catch (error) {
      console.error("Modul Walkie Petugas gagal:", error);
      kandungan.innerHTML = `<div class="walkie-error">${htmlSelamat(error.message)}</div>`;
    }
  }

  async function daftar() {
    if (state.proses || !state.profil || !state.penugasan) return;
    if (!confirm("Hantar permohonan set Walkie-Talkie kepada TSM?")) return;

    state.proses = true;
    paparStatus("Sedang menghantar permohonan...", "warning");

    try {
      const { data, error } = await dbWalkie
        .from("walkie_talkie")
        .insert({
          penugasan_id: state.penugasan.id,
          petugas_id: state.profil.id,
          status: "MENUNGGU"
        })
        .select("*")
        .single();

      if (error) throw error;
      state.rekod = data;
      paparStatus("Permohonan berjaya dihantar kepada TSM.", "success");
      await paparModul();
    } catch (error) {
      paparStatus(error.message || "Permohonan gagal dihantar.", "error");
    } finally {
      state.proses = false;
    }
  }

  async function pulang() {
    if (state.proses || !state.rekod) return;
    if (!confirm("Hantar permohonan pemulangan set kepada TSM?")) return;

    state.proses = true;
    paparStatus("Sedang menghantar permohonan pemulangan...", "warning");

    try {
      const { data, error } = await dbWalkie.rpc(
        "mohon_pemulangan_set",
        { p_rekod_id: state.rekod.id }
      );

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.message || "Permohonan pemulangan gagal.");
      }

      paparStatus("Permohonan pemulangan berjaya dihantar.", "success");
      await paparModul();
    } catch (error) {
      paparStatus(error.message || "Permohonan pemulangan gagal.", "error");
    } finally {
      state.proses = false;
    }
  }

  async function muatSemula() {
    state.penugasan = null;
    state.rekod = null;
    await paparModul();
  }

  window.SKPOWalkie = {
    mula: paparModul,
    daftar,
    pulang,
    muatSemula,
    state
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const { data } = await dbWalkie?.auth?.getSession?.() || { data: null };
    if (data?.session?.user) await paparModul();
  });
})();
