"use strict";

/* =========================================================
   SKPO V2 — MODUL PENYELIA
   Backend: Supabase
   Fail: js/penyelia.js
========================================================= */


/* =========================================================
   PEMBOLEH UBAH GLOBAL
========================================================= */

const db = window.supabaseClient;

let penyeliaAktif = null;
let senaraiCheckIn = [];

let rekodPertukaranAktif = null;
let petugasGantiAktif = null;
let modPertukaran = "CARI";


/* =========================================================
   UTILITI ASAS
========================================================= */

/**
 * Bersihkan teks sebelum dipaparkan ke dalam HTML.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/**
 * Normalisasikan No Badan.
 */
function normalisasiNoBadan(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}


/**
 * Tukarkan No Badan kepada email dalaman Supabase Auth.
 *
 * Contoh:
 * RF12345 → rf12345@skpo.local
 */
function binaEmailDalaman(noBadan) {
  const nilai = normalisasiNoBadan(noBadan).toLowerCase();

  return `${nilai}@skpo.local`;
}


/**
 * Format tarikh dan masa untuk paparan Malaysia.
 */
function formatTarikhMasa(value) {
  if (!value) {
    return "-";
  }

  const tarikh = new Date(value);

  if (Number.isNaN(tarikh.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(tarikh);
}


/**
 * Format tarikh sahaja.
 */
function formatTarikh(value) {
  if (!value) {
    return "-";
  }

  const tarikh = new Date(`${value}T00:00:00`);

  if (Number.isNaN(tarikh.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(tarikh);
}


/**
 * Paparkan status dalam elemen tertentu.
 */
function paparStatus(elemenId, mesej, jenis = "warning") {
  const elemen = document.getElementById(elemenId);

  if (!elemen) {
    return;
  }

  elemen.className = `status ${jenis}`;
  elemen.textContent = mesej;
  elemen.classList.remove("hidden");
}


/**
 * Sembunyikan status.
 */
function sembunyiStatus(elemenId) {
  const elemen = document.getElementById(elemenId);

  if (!elemen) {
    return;
  }

  elemen.textContent = "";
  elemen.className = "hidden";
}


/**
 * Aktif atau nyahaktif butang.
 */
function setButangLoading(elemenId, sedangLoading, teksLoading, teksAsal) {
  const butang = document.getElementById(elemenId);

  if (!butang) {
    return;
  }

  butang.disabled = sedangLoading;
  butang.textContent = sedangLoading ? teksLoading : teksAsal;
}


/**
 * Ambil ID pengguna Auth daripada profil.
 */
function dapatkanAuthUserId(profil) {
  return profil?.auth_user_id || profil?.id || null;
}


/* =========================================================
   SEMAK SAMBUNGAN SUPABASE
========================================================= */

function semakSupabase() {
  if (!window.supabaseClient) {
    throw new Error(
      "Sambungan Supabase belum tersedia. Semak api-config.js dan supabase-client.js."
    );
  }
}


/* =========================================================
   PEMULIHAN SESI
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    semakSupabase();

    await pulihkanSesiPenyelia();
  } catch (error) {
    console.error("Ralat permulaan Penyelia:", error);

    paparStatus(
      "loginStatus",
      error.message || "Sistem gagal dimulakan.",
      "error"
    );
  }
});


/**
 * Pulihkan sesi Supabase apabila halaman dimuat semula.
 */
async function pulihkanSesiPenyelia() {
  const {
    data: { session },
    error
  } = await db.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user) {
    paparHalamanLogin();
    return;
  }

  const profil = await dapatkanProfilDaripadaAuth(session.user.id);

  if (!profil) {
    await db.auth.signOut();
    paparHalamanLogin();

    paparStatus(
      "loginStatus",
      "Profil pengguna tidak ditemui.",
      "error"
    );

    return;
  }

  if (!perananDibenarkan(profil.peranan)) {
    await db.auth.signOut();
    paparHalamanLogin();

    paparStatus(
      "loginStatus",
      "Akaun ini tidak mempunyai akses sebagai Penyelia.",
      "error"
    );

    return;
  }

  if (profil.aktif === false) {
    await db.auth.signOut();
    paparHalamanLogin();

    paparStatus(
      "loginStatus",
      "Akaun ini telah dinyahaktifkan.",
      "error"
    );

    return;
  }

  penyeliaAktif = profil;

  paparDashboardPenyelia();
  await muatSenarai();
}


/**
 * Dapatkan profil berdasarkan Auth User ID.
 */
async function dapatkanProfilDaripadaAuth(authUserId) {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}


/**
 * Semak peranan yang dibenarkan membuka modul Penyelia.
 */
function perananDibenarkan(peranan) {
  const nilai = String(peranan ?? "").trim().toUpperCase();

  return [
    "PENYELIA",
    "ADMIN",
    "PENTADBIR"
  ].includes(nilai);
}


/* =========================================================
   LOGIN PENYELIA
========================================================= */

async function loginPenyeliaUI() {
  const noBadanInput = document.getElementById("noBadan");
  const passwordInput = document.getElementById("password");

  const noBadan = normalisasiNoBadan(noBadanInput?.value);
  const password = String(passwordInput?.value ?? "");

  sembunyiStatus("loginStatus");

  if (!noBadan) {
    paparStatus(
      "loginStatus",
      "Sila masukkan No Badan.",
      "warning"
    );

    noBadanInput?.focus();
    return;
  }

  if (!password) {
    paparStatus(
      "loginStatus",
      "Sila masukkan kata laluan.",
      "warning"
    );

    passwordInput?.focus();
    return;
  }

  setButangLoading(
    "btnLogin",
    true,
    "SEDANG LOGIN...",
    "LOGIN PENYELIA"
  );

  try {
    semakSupabase();

    const email = binaEmailDalaman(noBadan);

    const { data: authData, error: authError } =
      await db.auth.signInWithPassword({
        email,
        password
      });

    if (authError) {
      throw new Error(
        "No Badan atau kata laluan tidak sah."
      );
    }

    const profil = await dapatkanProfilDaripadaAuth(
      authData.user.id
    );

    if (!profil) {
      await db.auth.signOut();

      throw new Error(
        "Profil pengguna tidak ditemui dalam sistem."
      );
    }

    if (!perananDibenarkan(profil.peranan)) {
      await db.auth.signOut();

      throw new Error(
        "Akaun ini tidak mempunyai akses sebagai Penyelia."
      );
    }

    if (profil.aktif === false) {
      await db.auth.signOut();

      throw new Error(
        "Akaun ini telah dinyahaktifkan oleh Pentadbir."
      );
    }

    penyeliaAktif = profil;

    paparDashboardPenyelia();
    await muatSenarai();
  } catch (error) {
    console.error("Ralat login Penyelia:", error);

    paparStatus(
      "loginStatus",
      error.message || "Login Penyelia gagal.",
      "error"
    );
  } finally {
    setButangLoading(
      "btnLogin",
      false,
      "SEDANG LOGIN...",
      "LOGIN PENYELIA"
    );
  }
}


/**
 * Sokongan tekan Enter pada ruang login.
 */
document.addEventListener("keydown", event => {
  const loginSection = document.getElementById("loginSection");

  if (
    event.key === "Enter" &&
    loginSection &&
    !loginSection.classList.contains("hidden")
  ) {
    loginPenyeliaUI();
  }
});


/* =========================================================
   PAPARAN LOGIN DAN DASHBOARD
========================================================= */

function paparHalamanLogin() {
  document
    .getElementById("loginSection")
    ?.classList.remove("hidden");

  document
    .getElementById("dashboardSection")
    ?.classList.add("hidden");
}


function paparDashboardPenyelia() {
  document
    .getElementById("loginSection")
    ?.classList.add("hidden");

  document
    .getElementById("dashboardSection")
    ?.classList.remove("hidden");

  const profile = document.getElementById("profile");

  if (profile && penyeliaAktif) {
    profile.innerHTML = `
      <div>
        <strong>${escapeHtml(penyeliaAktif.pangkat || "")}</strong>
        ${escapeHtml(penyeliaAktif.nama || "-")}
      </div>

      <div>
        No Badan:
        <strong>${escapeHtml(penyeliaAktif.no_badan || "-")}</strong>
      </div>

      <div>
        Peranan:
        <strong>${escapeHtml(penyeliaAktif.peranan || "PENYELIA")}</strong>
      </div>
    `;
  }
}


/* =========================================================
   LOG KELUAR
========================================================= */

async function logoutPenyelia() {
  const pasti = window.confirm(
    "Adakah anda pasti mahu log keluar?"
  );

  if (!pasti) {
    return;
  }

  try {
    await db.auth.signOut();
  } catch (error) {
    console.error("Ralat log keluar:", error);
  }

  penyeliaAktif = null;
  senaraiCheckIn = [];

  document.getElementById("password").value = "";
  document.getElementById("carian").value = "";

  paparHalamanLogin();
}


/* =========================================================
   MUAT SENARAI MENUNGGU PENGESAHAN
========================================================= */

async function muatSenarai() {
  if (!penyeliaAktif) {
    return;
  }

  setButangLoading(
    "btnRefresh",
    true,
    "SEDANG MEMUAT...",
    "SEMAK SEMULA"
  );

  paparStatus(
    "senaraiStatus",
    "Sedang mendapatkan rekod Check-In...",
    "warning"
  );

  try {
    /*
     * Langkah 1:
     * Ambil rekod Check-In yang masih menunggu pengesahan.
     */
    const { data: checkinData, error: checkinError } = await db
      .from("checkin")
      .select("*")
      .eq("status_pengesahan", "MENUNGGU")
      .order("waktu_checkin", {
        ascending: true
      });

    if (checkinError) {
      throw checkinError;
    }

    if (!checkinData?.length) {
      senaraiCheckIn = [];

      sembunyiStatus("senaraiStatus");
      paparRekod();

      return;
    }

    /*
     * Langkah 2:
     * Ambil semua ID profil dan penugasan berkaitan.
     */
    const profileIds = [
      ...new Set(
        checkinData
          .map(item => item.profile_id)
          .filter(Boolean)
      )
    ];

    const penugasanIds = [
      ...new Set(
        checkinData
          .map(item => item.penugasan_id)
          .filter(Boolean)
      )
    ];

    /*
     * Langkah 3:
     * Ambil maklumat petugas.
     */
    let profiles = [];

    if (profileIds.length) {
      const { data, error } = await db
        .from("profiles")
        .select(
          "id, auth_user_id, no_badan, pangkat, nama, peranan, telefon, bahagian, daerah, aktif"
        )
        .in("id", profileIds);

      if (error) {
        throw error;
      }

      profiles = data || [];
    }

    /*
     * Langkah 4:
     * Ambil maklumat penugasan.
     */
    let penugasan = [];

    if (penugasanIds.length) {
      const { data, error } = await db
        .from("penugasan")
        .select("*")
        .in("id", penugasanIds);

      if (error) {
        throw error;
      }

      penugasan = data || [];
    }

    const profileMap = new Map(
      profiles.map(item => [item.id, item])
    );

    const penugasanMap = new Map(
      penugasan.map(item => [item.id, item])
    );

    /*
     * Langkah 5:
     * Gabungkan semua data untuk paparan.
     */
    senaraiCheckIn = checkinData.map(checkin => ({
      ...checkin,
      profile: profileMap.get(checkin.profile_id) || null,
      penugasan:
        penugasanMap.get(checkin.penugasan_id) || null
    }));

    sembunyiStatus("senaraiStatus");
    paparRekod();
  } catch (error) {
    console.error(
      "Ralat mendapatkan senarai Check-In:",
      error
    );

    senaraiCheckIn = [];
    paparRekod();

    paparStatus(
      "senaraiStatus",
      error.message ||
        "Rekod Check-In gagal diperoleh daripada Supabase.",
      "error"
    );
  } finally {
    setButangLoading(
      "btnRefresh",
      false,
      "SEDANG MEMUAT...",
      "SEMAK SEMULA"
    );
  }
}


/* =========================================================
   PAPAR SENARAI REKOD
========================================================= */

function paparRekod() {
  const senarai = document.getElementById("senarai");
  const jumlah = document.getElementById("jumlah");
  const carian = String(
    document.getElementById("carian")?.value ?? ""
  )
    .trim()
    .toLowerCase();

  if (!senarai || !jumlah) {
    return;
  }

  const rekodDitapis = senaraiCheckIn.filter(item => {
    const profile = item.profile || {};
    const tugas = item.penugasan || {};

    const teks = [
      profile.no_badan,
      profile.pangkat,
      profile.nama,
      profile.bahagian,
      profile.daerah,
      tugas.jenis_tugas,
      tugas.lokasi,
      tugas.tarikh_tugas,
      item.status_pengesahan
    ]
      .join(" ")
      .toLowerCase();

    return !carian || teks.includes(carian);
  });

  jumlah.textContent = String(rekodDitapis.length);

  if (!rekodDitapis.length) {
    senarai.innerHTML = `
      <div class="empty">
        ${
          carian
            ? "Tiada rekod yang sepadan dengan carian."
            : "Tiada Check-In sedang menunggu pengesahan."
        }
      </div>
    `;

    return;
  }

  senarai.innerHTML = rekodDitapis
    .map(item => binaKadCheckIn(item))
    .join("");
}


/**
 * Bina kad rekod Check-In.
 */
function binaKadCheckIn(item) {
  const profile = item.profile || {};
  const tugas = item.penugasan || {};

  const jarak =
    item.jarak_meter === null ||
    item.jarak_meter === undefined
      ? "-"
      : `${Number(item.jarak_meter).toFixed(2)} meter`;

  const ketepatan =
    item.ketepatan_gps === null ||
    item.ketepatan_gps === undefined
      ? "-"
      : `${Number(item.ketepatan_gps).toFixed(2)} meter`;

  return `
    <article class="record">

      <h3>
        ${escapeHtml(profile.pangkat || "")}
        ${escapeHtml(profile.nama || "PETUGAS")}
      </h3>

      <div class="grid">

        <div class="label">No Badan</div>
        <div>${escapeHtml(profile.no_badan || "-")}</div>

        <div class="label">Tarikh Tugas</div>
        <div>${formatTarikh(tugas.tarikh_tugas)}</div>

        <div class="label">Jenis Tugas</div>
        <div>${escapeHtml(tugas.jenis_tugas || "-")}</div>

        <div class="label">Lokasi</div>
        <div>${escapeHtml(tugas.lokasi || "-")}</div>

        <div class="label">Masa Check-In</div>
        <div>${formatTarikhMasa(item.waktu_checkin)}</div>

        <div class="label">Jarak Lokasi</div>
        <div>${escapeHtml(jarak)}</div>

        <div class="label">Ketepatan GPS</div>
        <div>${escapeHtml(ketepatan)}</div>

        <div class="label">Bahagian</div>
        <div>${escapeHtml(profile.bahagian || "-")}</div>

        <div class="label">Telefon</div>
        <div>${escapeHtml(profile.telefon || "-")}</div>

      </div>

      <div class="actions">

        <button
          class="btn-ok"
          type="button"
          onclick="sahkanCheckIn('${escapeHtml(item.id)}')"
        >
          SAHKAN
        </button>

        <button
          class="btn-no"
          type="button"
          onclick="tolakCheckIn('${escapeHtml(item.id)}')"
        >
          TOLAK
        </button>

        <button
          class="btn-change"
          type="button"
          onclick="bukaModalTukar('${escapeHtml(item.id)}')"
        >
          TUKAR PETUGAS
        </button>

      </div>

    </article>
  `;
}


/* =========================================================
   SAHKAN CHECK-IN
========================================================= */

async function sahkanCheckIn(checkinId) {
  const rekod = senaraiCheckIn.find(
    item => String(item.id) === String(checkinId)
  );

  if (!rekod) {
    alert("Rekod Check-In tidak ditemui.");
    return;
  }

  const nama = rekod.profile?.nama || "petugas ini";

  const pasti = window.confirm(
    `Adakah anda pasti mahu mengesahkan Check-In ${nama}?`
  );

  if (!pasti) {
    return;
  }

  try {
    /*
     * RPC ini akan dibina dalam fail SQL SKPO.
     * Ia mengemas kini Check-In dan status penugasan secara atomik.
     */
    const { data, error } = await db.rpc(
      "sahkan_checkin_penyelia",
      {
        p_checkin_id: checkinId,
        p_status: "DISAHKAN",
        p_catatan: null
      }
    );

    if (error) {
      throw error;
    }

    if (data?.success === false) {
      throw new Error(
        data.message || "Pengesahan Check-In gagal."
      );
    }

    alert("Check-In berjaya disahkan.");

    await muatSenarai();
  } catch (error) {
    console.error("Ralat sahkan Check-In:", error);

    alert(
      `Pengesahan gagal: ${
        error.message || "Ralat tidak diketahui."
      }`
    );
  }
}


/* =========================================================
   TOLAK CHECK-IN
========================================================= */

async function tolakCheckIn(checkinId) {
  const rekod = senaraiCheckIn.find(
    item => String(item.id) === String(checkinId)
  );

  if (!rekod) {
    alert("Rekod Check-In tidak ditemui.");
    return;
  }

  const sebab = window.prompt(
    "Masukkan sebab Check-In ditolak:"
  );

  if (sebab === null) {
    return;
  }

  const sebabBersih = sebab.trim();

  if (!sebabBersih) {
    alert("Sebab penolakan wajib dimasukkan.");
    return;
  }

  const pasti = window.confirm(
    "Adakah anda pasti mahu menolak Check-In ini?"
  );

  if (!pasti) {
    return;
  }

  try {
    const { data, error } = await db.rpc(
      "sahkan_checkin_penyelia",
      {
        p_checkin_id: checkinId,
        p_status: "DITOLAK",
        p_catatan: sebabBersih
      }
    );

    if (error) {
      throw error;
    }

    if (data?.success === false) {
      throw new Error(
        data.message || "Penolakan Check-In gagal."
      );
    }

    alert("Check-In telah ditolak.");

    await muatSenarai();
  } catch (error) {
    console.error("Ralat tolak Check-In:", error);

    alert(
      `Penolakan gagal: ${
        error.message || "Ralat tidak diketahui."
      }`
    );
  }
}


/* =========================================================
   MODAL PERTUKARAN PETUGAS
========================================================= */

function bukaModalTukar(checkinId) {
  const rekod = senaraiCheckIn.find(
    item => String(item.id) === String(checkinId)
  );

  if (!rekod) {
    alert("Rekod petugas asal tidak ditemui.");
    return;
  }

  rekodPertukaranAktif = rekod;
  petugasGantiAktif = null;
  modPertukaran = "CARI";

  resetBorangPertukaran();

  const profile = rekod.profile || {};
  const tugas = rekod.penugasan || {};

  document.getElementById("petugasAsalPreview").innerHTML = `
    <strong>PETUGAS ASAL</strong><br>
    ${escapeHtml(profile.pangkat || "")}
    ${escapeHtml(profile.nama || "-")}<br>
    No Badan:
    <strong>${escapeHtml(profile.no_badan || "-")}</strong><br>
    Penugasan:
    <strong>${escapeHtml(tugas.jenis_tugas || "-")}</strong><br>
    Lokasi:
    <strong>${escapeHtml(tugas.lokasi || "-")}</strong>
  `;

  pilihModPetugas("CARI");

  document
    .getElementById("modalTukar")
    .classList.remove("hidden");
}


function tutupModalTukar() {
  document
    .getElementById("modalTukar")
    .classList.add("hidden");

  rekodPertukaranAktif = null;
  petugasGantiAktif = null;

  resetBorangPertukaran();
}


/**
 * Tutup modal apabila klik kawasan gelap di luar kotak.
 */
document.addEventListener("click", event => {
  const modal = document.getElementById("modalTukar");

  if (
    modal &&
    !modal.classList.contains("hidden") &&
    event.target === modal
  ) {
    tutupModalTukar();
  }
});


function resetBorangPertukaran() {
  const ids = [
    "noBadanGanti",
    "daftarNoBadan",
    "daftarPangkat",
    "daftarNama",
    "daftarPassword",
    "daftarTelefon",
    "daftarBahagian",
    "daftarDaerah",
    "sebabPertukaran",
    "catatanPertukaran"
  ];

  ids.forEach(id => {
    const elemen = document.getElementById(id);

    if (elemen) {
      elemen.value = "";
    }
  });

  document
    .getElementById("petugasGantiPreview")
    ?.classList.add("hidden");

  const preview = document.getElementById(
    "petugasGantiPreview"
  );

  if (preview) {
    preview.innerHTML = "";
  }

  const simpan = document.getElementById(
    "btnSimpanTukar"
  );

  if (simpan) {
    simpan.disabled = true;
  }

  sembunyiStatus("statusPertukaran");
}


/* =========================================================
   PILIH MOD CARI ATAU DAFTAR
========================================================= */

function pilihModPetugas(mod) {
  modPertukaran =
    String(mod).toUpperCase() === "DAFTAR"
      ? "DAFTAR"
      : "CARI";

  petugasGantiAktif = null;

  const tabCari = document.getElementById("tabCari");
  const tabDaftar = document.getElementById("tabDaftar");
  const modCari = document.getElementById("modCari");
  const modDaftar = document.getElementById("modDaftar");
  const btnSimpan = document.getElementById(
    "btnSimpanTukar"
  );

  if (modPertukaran === "CARI") {
    tabCari.classList.add("active");
    tabDaftar.classList.remove("active");

    modCari.classList.remove("hidden");
    modDaftar.classList.add("hidden");

    btnSimpan.disabled = true;
  } else {
    tabCari.classList.remove("active");
    tabDaftar.classList.add("active");

    modCari.classList.add("hidden");
    modDaftar.classList.remove("hidden");

    btnSimpan.disabled = false;
  }

  sembunyiStatus("statusPertukaran");
}


/* =========================================================
   CARI PETUGAS GANTI SEDIA ADA
========================================================= */

async function cariGanti() {
  const noBadan = normalisasiNoBadan(
    document.getElementById("noBadanGanti")?.value
  );

  petugasGantiAktif = null;

  const preview = document.getElementById(
    "petugasGantiPreview"
  );

  preview.classList.add("hidden");
  preview.innerHTML = "";

  document.getElementById(
    "btnSimpanTukar"
  ).disabled = true;

  if (!noBadan) {
    paparStatus(
      "statusPertukaran",
      "Sila masukkan No Badan petugas ganti.",
      "warning"
    );

    return;
  }

  if (
    normalisasiNoBadan(
      rekodPertukaranAktif?.profile?.no_badan
    ) === noBadan
  ) {
    paparStatus(
      "statusPertukaran",
      "Petugas ganti tidak boleh sama dengan petugas asal.",
      "error"
    );

    return;
  }

  setButangLoading(
    "btnCariGanti",
    true,
    "SEDANG MENCARI...",
    "CARI PETUGAS"
  );

  try {
    const { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("no_badan", noBadan)
      .eq("aktif", true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      paparStatus(
        "statusPertukaran",
        "Petugas tidak ditemui. Gunakan tab Daftar Petugas Baharu.",
        "warning"
      );

      return;
    }

    if (
      !["PETUGAS", "URUSETIA"].includes(
        String(data.peranan ?? "").toUpperCase()
      )
    ) {
      paparStatus(
        "statusPertukaran",
        "Profil yang ditemui bukan akaun Petugas.",
        "error"
      );

      return;
    }

    petugasGantiAktif = data;

    preview.innerHTML = `
      <strong>PETUGAS GANTI DITEMUI</strong><br>
      ${escapeHtml(data.pangkat || "")}
      ${escapeHtml(data.nama || "-")}<br>
      No Badan:
      <strong>${escapeHtml(data.no_badan || "-")}</strong><br>
      Bahagian:
      <strong>${escapeHtml(data.bahagian || "-")}</strong><br>
      Daerah:
      <strong>${escapeHtml(data.daerah || "-")}</strong>
    `;

    preview.classList.remove("hidden");

    document.getElementById(
      "btnSimpanTukar"
    ).disabled = false;

    paparStatus(
      "statusPertukaran",
      "Petugas ganti berjaya ditemui.",
      "success"
    );
  } catch (error) {
    console.error("Ralat cari petugas:", error);

    paparStatus(
      "statusPertukaran",
      error.message || "Carian petugas gagal.",
      "error"
    );
  } finally {
    setButangLoading(
      "btnCariGanti",
      false,
      "SEDANG MENCARI...",
      "CARI PETUGAS"
    );
  }
}


/* =========================================================
   SIMPAN PERTUKARAN PETUGAS
========================================================= */

async function simpanPertukaran() {
  if (!rekodPertukaranAktif?.penugasan?.id) {
    paparStatus(
      "statusPertukaran",
      "Maklumat penugasan asal tidak lengkap.",
      "error"
    );

    return;
  }

  const sebab = String(
    document.getElementById("sebabPertukaran")?.value ?? ""
  ).trim();

  const catatan = String(
    document.getElementById("catatanPertukaran")?.value ?? ""
  ).trim();

  if (!sebab) {
    paparStatus(
      "statusPertukaran",
      "Sila pilih sebab pertukaran.",
      "warning"
    );

    return;
  }

  let profileIdGanti = null;

  try {
    setButangLoading(
      "btnSimpanTukar",
      true,
      "SEDANG MENYIMPAN...",
      "SIMPAN PERTUKARAN"
    );

    sembunyiStatus("statusPertukaran");

    if (modPertukaran === "CARI") {
      if (!petugasGantiAktif?.id) {
        throw new Error(
          "Sila cari dan pilih petugas ganti terlebih dahulu."
        );
      }

      profileIdGanti = petugasGantiAktif.id;
    } else {
      profileIdGanti = await daftarPetugasBaharu();
    }

    const namaGanti =
      petugasGantiAktif?.nama ||
      document.getElementById("daftarNama")?.value ||
      "petugas baharu";

    const pasti = window.confirm(
      `Adakah anda pasti mahu menggantikan petugas asal dengan ${namaGanti}?`
    );

    if (!pasti) {
      return;
    }

    /*
     * RPC ini akan:
     * 1. Menandakan penugasan lama sebagai DIGANTI.
     * 2. Menyimpan petugas ganti pada rekod lama.
     * 3. Mencipta penugasan baharu untuk petugas ganti.
     * 4. Membatalkan Check-In lama yang sedang menunggu.
     * 5. Menyimpan audit penyelia, sebab dan catatan.
     */
    const { data, error } = await db.rpc(
      "tukar_petugas_penyelia",
      {
        p_penugasan_asal_id:
          rekodPertukaranAktif.penugasan.id,

        p_profile_ganti_id:
          profileIdGanti,

        p_sebab:
          sebab,

        p_catatan:
          catatan || null
      }
    );

    if (error) {
      throw error;
    }

    if (data?.success === false) {
      throw new Error(
        data.message || "Pertukaran petugas gagal."
      );
    }

    alert("Pertukaran petugas berjaya direkodkan.");

    tutupModalTukar();
    await muatSenarai();
  } catch (error) {
    console.error("Ralat pertukaran petugas:", error);

    paparStatus(
      "statusPertukaran",
      `Ralat pertukaran petugas: ${
        error.message || "Ralat tidak diketahui."
      }`,
      "error"
    );
  } finally {
    const btnSimpan = document.getElementById(
      "btnSimpanTukar"
    );

    if (btnSimpan) {
      btnSimpan.textContent = "SIMPAN PERTUKARAN";

      btnSimpan.disabled =
        modPertukaran === "CARI"
          ? !petugasGantiAktif
          : false;
    }
  }
}


/* =========================================================
   DAFTAR PETUGAS BAHARU
========================================================= */

async function daftarPetugasBaharu() {
  const noBadan = normalisasiNoBadan(
    document.getElementById("daftarNoBadan")?.value
  );

  const pangkat = String(
    document.getElementById("daftarPangkat")?.value ?? ""
  )
    .trim()
    .toUpperCase();

  const nama = String(
    document.getElementById("daftarNama")?.value ?? ""
  )
    .trim()
    .toUpperCase();

  const password = String(
    document.getElementById("daftarPassword")?.value ?? ""
  );

  const telefon = String(
    document.getElementById("daftarTelefon")?.value ?? ""
  ).trim();

  const bahagian = String(
    document.getElementById("daftarBahagian")?.value ?? ""
  )
    .trim()
    .toUpperCase();

  const daerah = String(
    document.getElementById("daftarDaerah")?.value ?? ""
  )
    .trim()
    .toUpperCase();

  if (!noBadan) {
    throw new Error("No Badan petugas baharu diperlukan.");
  }

  if (!pangkat) {
    throw new Error("Pangkat petugas baharu diperlukan.");
  }

  if (!nama) {
    throw new Error("Nama petugas baharu diperlukan.");
  }

  if (password.length < 6) {
    throw new Error(
      "Kata laluan mestilah sekurang-kurangnya 6 aksara."
    );
  }

  if (
    normalisasiNoBadan(
      rekodPertukaranAktif?.profile?.no_badan
    ) === noBadan
  ) {
    throw new Error(
      "No Badan petugas baharu sama dengan petugas asal."
    );
  }

  /*
   * Semak dahulu supaya No Badan tidak didaftarkan dua kali.
   */
  const { data: profilSediaAda, error: semakError } =
    await db
      .from("profiles")
      .select("id, no_badan, nama, aktif")
      .eq("no_badan", noBadan)
      .maybeSingle();

  if (semakError) {
    throw semakError;
  }

  if (profilSediaAda) {
    if (profilSediaAda.aktif === false) {
      throw new Error(
        "No Badan ini sudah wujud tetapi akaunnya tidak aktif. Hubungi Pentadbir."
      );
    }

    petugasGantiAktif = profilSediaAda;

    return profilSediaAda.id;
  }

  /*
   * Pendaftaran Auth user mesti dibuat melalui Edge Function
   * kerana service-role key tidak boleh diletakkan dalam frontend.
   */
  const { data, error } = await db.functions.invoke(
    "tambah-petugas",
    {
      body: {
        no_badan: noBadan,
        pangkat,
        nama,
        peranan: "PETUGAS",
        password,
        telefon: telefon || null,
        bahagian: bahagian || null,
        daerah: daerah || null
      }
    }
  );

  if (error) {
    throw new Error(
      error.message || "Edge Function tambah-petugas gagal."
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Petugas baharu gagal didaftarkan."
    );
  }

  /*
   * Edge Function disarankan memulangkan profile.
   * Jika hanya ID dipulangkan, kod ini masih menyokongnya.
   */
  const profileId =
    data.profile?.id ||
    data.profile_id ||
    data.id ||
    null;

  if (!profileId) {
    /*
     * Fallback: dapatkan profil berdasarkan No Badan.
     */
    const { data: profilBaru, error: profilError } =
      await db
        .from("profiles")
        .select("*")
        .eq("no_badan", noBadan)
        .single();

    if (profilError) {
      throw profilError;
    }

    petugasGantiAktif = profilBaru;

    return profilBaru.id;
  }

  petugasGantiAktif =
    data.profile || {
      id: profileId,
      no_badan: noBadan,
      pangkat,
      nama,
      peranan: "PETUGAS",
      telefon,
      bahagian,
      daerah
    };

  return profileId;
}


/* =========================================================
   PEMANTAUAN PERUBAHAN AUTH
========================================================= */

db.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_OUT") {
    penyeliaAktif = null;
    senaraiCheckIn = [];

    paparHalamanLogin();
  }

  if (
    event === "SIGNED_IN" &&
    session?.user &&
    !penyeliaAktif
  ) {
    try {
      const profil = await dapatkanProfilDaripadaAuth(
        session.user.id
      );

      if (
        profil &&
        perananDibenarkan(profil.peranan) &&
        profil.aktif !== false
      ) {
        penyeliaAktif = profil;

        paparDashboardPenyelia();
        await muatSenarai();
      }
    } catch (error) {
      console.error(
        "Ralat perubahan sesi Supabase:",
        error
      );
    }
  }
});
