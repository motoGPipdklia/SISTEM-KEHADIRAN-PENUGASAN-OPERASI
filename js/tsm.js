"use strict";

/* =========================================================
   SKPO V2 — MODUL TSM
   Pengurusan Pendaftaran, Pelepasan dan Pemulangan
   Set Walkie-Talkie

   Fail: js/tsm.js
========================================================= */


/* =========================================================
   SAMBUNGAN SUPABASE
========================================================= */

const db = window.supabaseClient;


/* =========================================================
   PEMBOLEH UBAH GLOBAL
========================================================= */

let tsmAktif = null;

let senaraiPendaftaranSet = [];

let rekodPelepasanAktif = null;
let rekodPenolakanAktif = null;
let rekodPemulanganAktif = null;


/* =========================================================
   UTILITI ASAS
========================================================= */

/**
 * Lindungi teks daripada suntikan HTML.
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
 * Tukarkan No Badan kepada e-mel dalaman Supabase Auth.
 *
 * Contoh:
 * RF12345 → rf12345@skpo.local
 */
function binaEmailDalaman(noBadan) {
  return `${normalisasiNoBadan(noBadan).toLowerCase()}@skpo.local`;
}


/**
 * Format tarikh dan masa dalam waktu Malaysia.
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
 * Paparkan status mesej.
 */
function paparStatusTSM(elemenId, mesej, jenis = "warning") {
  const elemen = document.getElementById(elemenId);

  if (!elemen) {
    return;
  }

  elemen.className = `status ${jenis}`;
  elemen.textContent = mesej;
  elemen.classList.remove("hidden");
}


/**
 * Sembunyikan status mesej.
 */
function sembunyiStatusTSM(elemenId) {
  const elemen = document.getElementById(elemenId);

  if (!elemen) {
    return;
  }

  elemen.textContent = "";
  elemen.className = "hidden";
}


/**
 * Tukar keadaan butang semasa proses berjalan.
 */
function setButangLoadingTSM(
  elemenId,
  sedangLoading,
  teksLoading,
  teksAsal
) {
  const butang = document.getElementById(elemenId);

  if (!butang) {
    return;
  }

  butang.disabled = sedangLoading;
  butang.textContent = sedangLoading
    ? teksLoading
    : teksAsal;
}


/**
 * Pastikan sambungan Supabase tersedia.
 */
function semakSupabaseTSM() {
  if (!window.supabaseClient) {
    throw new Error(
      "Sambungan Supabase belum tersedia. Semak api-config.js dan supabase-client.js."
    );
  }
}


/**
 * Normalisasikan status rekod.
 */
function normalisasiStatus(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}


/**
 * Tukarkan senarai aksesori kepada teks.
 */
function formatAksesori(value) {
  if (!value) {
    return "-";
  }

  if (Array.isArray(value)) {
    return value.length
      ? value.join(", ")
      : "-";
  }

  if (typeof value === "string") {
    const nilai = value.trim();

    if (!nilai) {
      return "-";
    }

    try {
      const parsed = JSON.parse(nilai);

      if (Array.isArray(parsed)) {
        return parsed.length
          ? parsed.join(", ")
          : "-";
      }
    } catch {
      // Nilai bukan JSON. Paparkan sebagai teks biasa.
    }

    return nilai;
  }

  return String(value);
}


/**
 * Dapatkan nilai aksesori daripada checkbox.
 */
function dapatkanAksesoriDipilih(ids) {
  return ids
    .map(id => document.getElementById(id))
    .filter(elemen => elemen?.checked)
    .map(elemen => elemen.value);
}


/**
 * Reset checkbox.
 */
function resetCheckbox(ids) {
  ids.forEach(id => {
    const elemen = document.getElementById(id);

    if (elemen) {
      elemen.checked = false;
    }
  });
}


/**
 * Tentukan kelas paparan status.
 */
function kelasStatus(status) {
  switch (normalisasiStatus(status)) {
    case "MENUNGGU":
      return "status-menunggu";

    case "DILEPASKAN":
      return "status-dilepaskan";

    case "DIPULANGKAN":
      return "status-dipulangkan";

    case "DITOLAK":
      return "status-ditolak";

    default:
      return "status-lain";
  }
}


/* =========================================================
   PERMULAAN HALAMAN
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    semakSupabaseTSM();

    await pulihkanSesiTSM();
  } catch (error) {
    console.error("Ralat permulaan modul TSM:", error);

    paparStatusTSM(
      "loginStatus",
      error.message || "Modul TSM gagal dimulakan.",
      "error"
    );
  }
});


/* =========================================================
   PEMULIHAN SESI
========================================================= */

/**
 * Pulihkan sesi pengguna selepas halaman dimuat semula.
 */
async function pulihkanSesiTSM() {
  const {
    data: { session },
    error
  } = await db.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user) {
    paparHalamanLoginTSM();
    return;
  }

  const profil = await dapatkanProfilTSM(
    session.user.id
  );

  if (!profil) {
    await db.auth.signOut();

    paparHalamanLoginTSM();

    paparStatusTSM(
      "loginStatus",
      "Profil pengguna tidak ditemui.",
      "error"
    );

    return;
  }

  if (!perananTSMDibenarkan(profil.peranan)) {
    await db.auth.signOut();

    paparHalamanLoginTSM();

    paparStatusTSM(
      "loginStatus",
      "Akaun ini tidak mempunyai akses ke Modul TSM.",
      "error"
    );

    return;
  }

  if (profil.aktif === false) {
    await db.auth.signOut();

    paparHalamanLoginTSM();

    paparStatusTSM(
      "loginStatus",
      "Akaun ini telah dinyahaktifkan.",
      "error"
    );

    return;
  }

  tsmAktif = profil;

  paparDashboardTSM();
  await muatSenaraiTSM();
}


/**
 * Dapatkan profil berdasarkan Auth User ID.
 */
async function dapatkanProfilTSM(authUserId) {
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
 * Semak peranan yang dibenarkan.
 */
function perananTSMDibenarkan(peranan) {
  const nilai = normalisasiStatus(peranan);

  return [
    "TSM",
    "ADMIN",
    "PENTADBIR"
  ].includes(nilai);
}


/* =========================================================
   LOGIN TSM
========================================================= */

async function loginTSMUI() {
  const noBadanInput =
    document.getElementById("noBadan");

  const passwordInput =
    document.getElementById("password");

  const noBadan = normalisasiNoBadan(
    noBadanInput?.value
  );

  const password = String(
    passwordInput?.value ?? ""
  );

  sembunyiStatusTSM("loginStatus");

  if (!noBadan) {
    paparStatusTSM(
      "loginStatus",
      "Sila masukkan No Badan.",
      "warning"
    );

    noBadanInput?.focus();
    return;
  }

  if (!password) {
    paparStatusTSM(
      "loginStatus",
      "Sila masukkan kata laluan.",
      "warning"
    );

    passwordInput?.focus();
    return;
  }

  setButangLoadingTSM(
    "btnLogin",
    true,
    "SEDANG LOGIN...",
    "LOGIN TSM"
  );

  try {
    semakSupabaseTSM();

    const email = binaEmailDalaman(noBadan);

    const {
      data: authData,
      error: authError
    } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      throw new Error(
        "No Badan atau kata laluan tidak sah."
      );
    }

    const profil = await dapatkanProfilTSM(
      authData.user.id
    );

    if (!profil) {
      await db.auth.signOut();

      throw new Error(
        "Profil pengguna tidak ditemui dalam sistem."
      );
    }

    if (!perananTSMDibenarkan(profil.peranan)) {
      await db.auth.signOut();

      throw new Error(
        "Akaun ini tidak mempunyai akses ke Modul TSM."
      );
    }

    if (profil.aktif === false) {
      await db.auth.signOut();

      throw new Error(
        "Akaun ini telah dinyahaktifkan oleh Pentadbir."
      );
    }

    tsmAktif = profil;

    paparDashboardTSM();
    await muatSenaraiTSM();
  } catch (error) {
    console.error("Ralat login TSM:", error);

    paparStatusTSM(
      "loginStatus",
      error.message || "Login TSM gagal.",
      "error"
    );
  } finally {
    setButangLoadingTSM(
      "btnLogin",
      false,
      "SEDANG LOGIN...",
      "LOGIN TSM"
    );
  }
}


/**
 * Benarkan login dengan menekan Enter.
 */
document.addEventListener("keydown", event => {
  const loginSection =
    document.getElementById("loginSection");

  if (
    event.key === "Enter" &&
    loginSection &&
    !loginSection.classList.contains("hidden")
  ) {
    loginTSMUI();
  }
});


/* =========================================================
   PAPARAN LOGIN DAN DASHBOARD
========================================================= */

function paparHalamanLoginTSM() {
  document
    .getElementById("loginSection")
    ?.classList.remove("hidden");

  document
    .getElementById("dashboardSection")
    ?.classList.add("hidden");
}


function paparDashboardTSM() {
  document
    .getElementById("loginSection")
    ?.classList.add("hidden");

  document
    .getElementById("dashboardSection")
    ?.classList.remove("hidden");

  const profile = document.getElementById("profile");

  if (!profile || !tsmAktif) {
    return;
  }

  profile.innerHTML = `
    <div>
      <strong>
        ${escapeHtml(tsmAktif.pangkat || "")}
      </strong>

      ${escapeHtml(tsmAktif.nama || "-")}
    </div>

    <div>
      No Badan:

      <strong>
        ${escapeHtml(tsmAktif.no_badan || "-")}
      </strong>
    </div>

    <div>
      Peranan:

      <strong>
        ${escapeHtml(tsmAktif.peranan || "TSM")}
      </strong>
    </div>
  `;
}


/* =========================================================
   LOG KELUAR
========================================================= */

async function logoutTSM() {
  const pasti = window.confirm(
    "Adakah anda pasti mahu log keluar?"
  );

  if (!pasti) {
    return;
  }

  try {
    await db.auth.signOut();
  } catch (error) {
    console.error("Ralat log keluar TSM:", error);
  }

  tsmAktif = null;
  senaraiPendaftaranSet = [];

  const password =
    document.getElementById("password");

  const carian =
    document.getElementById("carian");

  const tapisan =
    document.getElementById("tapisanStatus");

  if (password) {
    password.value = "";
  }

  if (carian) {
    carian.value = "";
  }

  if (tapisan) {
    tapisan.value = "";
  }

  paparHalamanLoginTSM();
}


/* =========================================================
   MUAT SENARAI PENDAFTARAN SET
========================================================= */

async function muatSenaraiTSM() {
  if (!tsmAktif) {
    return;
  }

  setButangLoadingTSM(
    "btnRefresh",
    true,
    "SEDANG MEMUAT...",
    "SEMAK SEMULA"
  );

  paparStatusTSM(
    "senaraiStatus",
    "Sedang mendapatkan rekod pendaftaran set...",
    "warning"
  );

  try {
    /*
     * Ambil semua rekod pendaftaran set.
     */
    const {
      data: walkieData,
      error: walkieError
    } = await db
      .from("walkie_talkie")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (walkieError) {
      throw walkieError;
    }

    if (!walkieData?.length) {
      senaraiPendaftaranSet = [];

      sembunyiStatusTSM("senaraiStatus");
      kemasKiniStatistikTSM();
      paparSenaraiTSM();

      return;
    }

    /*
     * Dapatkan semua ID profil dan penugasan berkaitan.
     */
    const profileIds = [
      ...new Set(
        walkieData
          .map(item => item.profile_id)
          .filter(Boolean)
      )
    ];

    const penugasanIds = [
      ...new Set(
        walkieData
          .map(item => item.penugasan_id)
          .filter(Boolean)
      )
    ];

    const pelepasIds = [
      ...new Set(
        walkieData
          .map(item => item.dilepaskan_oleh)
          .filter(Boolean)
      )
    ];

    const pemulangIds = [
      ...new Set(
        walkieData
          .map(item => item.dipulangkan_kepada)
          .filter(Boolean)
      )
    ];

    const penolakIds = [
      ...new Set(
        walkieData
          .map(item => item.ditolak_oleh)
          .filter(Boolean)
      )
    ];

    const semuaProfileIds = [
      ...new Set([
        ...profileIds,
        ...pelepasIds,
        ...pemulangIds,
        ...penolakIds
      ])
    ];

    /*
     * Ambil maklumat semua profil berkaitan.
     */
    let profiles = [];

    if (semuaProfileIds.length) {
      const {
        data,
        error
      } = await db
        .from("profiles")
        .select(
          `
            id,
            auth_user_id,
            no_badan,
            pangkat,
            nama,
            peranan,
            telefon,
            bahagian,
            daerah,
            aktif
          `
        )
        .in("id", semuaProfileIds);

      if (error) {
        throw error;
      }

      profiles = data || [];
    }

    /*
     * Ambil maklumat penugasan.
     */
    let penugasan = [];

    if (penugasanIds.length) {
      const {
        data,
        error
      } = await db
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
     * Gabungkan rekod.
     */
    senaraiPendaftaranSet = walkieData.map(item => ({
      ...item,

      profile:
        profileMap.get(item.profile_id) || null,

      penugasan:
        penugasanMap.get(item.penugasan_id) || null,

      pegawaiPelepas:
        profileMap.get(item.dilepaskan_oleh) || null,

      pegawaiPemulangan:
        profileMap.get(item.dipulangkan_kepada) || null,

      pegawaiPenolak:
        profileMap.get(item.ditolak_oleh) || null
    }));

    sembunyiStatusTSM("senaraiStatus");

    kemasKiniStatistikTSM();
    paparSenaraiTSM();
  } catch (error) {
    console.error(
      "Ralat mendapatkan senarai TSM:",
      error
    );

    senaraiPendaftaranSet = [];

    kemasKiniStatistikTSM();
    paparSenaraiTSM();

    paparStatusTSM(
      "senaraiStatus",
      error.message ||
        "Rekod pendaftaran set gagal diperoleh.",
      "error"
    );
  } finally {
    setButangLoadingTSM(
      "btnRefresh",
      false,
      "SEDANG MEMUAT...",
      "SEMAK SEMULA"
    );
  }
}


/* =========================================================
   STATISTIK
========================================================= */

function kemasKiniStatistikTSM() {
  const statistik = {
    keseluruhan: senaraiPendaftaranSet.length,
    menunggu: 0,
    dilepaskan: 0,
    dipulangkan: 0,
    ditolak: 0
  };

  senaraiPendaftaranSet.forEach(item => {
    const status = normalisasiStatus(item.status);

    if (status === "MENUNGGU") {
      statistik.menunggu += 1;
    }

    if (status === "DILEPASKAN") {
      statistik.dilepaskan += 1;
    }

    if (status === "DIPULANGKAN") {
      statistik.dipulangkan += 1;
    }

    if (status === "DITOLAK") {
      statistik.ditolak += 1;
    }
  });

  const pemetaan = {
    jumlahKeseluruhan: statistik.keseluruhan,
    jumlahMenunggu: statistik.menunggu,
    jumlahDilepaskan: statistik.dilepaskan,
    jumlahDipulangkan: statistik.dipulangkan,
    jumlahDitolak: statistik.ditolak
  };

  Object.entries(pemetaan).forEach(
    ([elemenId, nilai]) => {
      const elemen =
        document.getElementById(elemenId);

      if (elemen) {
        elemen.textContent = String(nilai);
      }
    }
  );
}


/* =========================================================
   PAPAR SENARAI TSM
========================================================= */

function paparSenaraiTSM() {
  const tbody = document.getElementById("senaraiTSM");

  if (!tbody) {
    return;
  }

  const carian = String(
    document.getElementById("carian")?.value ?? ""
  )
    .trim()
    .toLowerCase();

  const tapisanStatus = normalisasiStatus(
    document.getElementById("tapisanStatus")?.value
  );

  const rekodDitapis =
    senaraiPendaftaranSet.filter(item => {
      const profile = item.profile || {};
      const tugas = item.penugasan || {};

      const status = normalisasiStatus(item.status);

      const teksCarian = [
        profile.no_badan,
        profile.pangkat,
        profile.nama,
        profile.telefon,
        profile.bahagian,
        tugas.jenis_tugas,
        tugas.lokasi,
        tugas.tarikh_tugas,
        item.no_set,
        item.nombor_set,
        formatAksesori(item.aksesori),
        status
      ]
        .join(" ")
        .toLowerCase();

      const padanCarian =
        !carian ||
        teksCarian.includes(carian);

      const padanStatus =
        !tapisanStatus ||
        status === tapisanStatus;

      return padanCarian && padanStatus;
    });

  if (!rekodDitapis.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="10"
          class="empty-row"
        >
          ${
            carian || tapisanStatus
              ? "Tiada rekod yang sepadan dengan carian atau tapisan."
              : "Tiada pendaftaran set walkie-talkie."
          }
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = rekodDitapis
    .map((item, index) =>
      binaBarisTSM(item, index + 1)
    )
    .join("");
}


/**
 * Bina satu baris rekod.
 */
function binaBarisTSM(item, bilangan) {
  const profile = item.profile || {};
  const tugas = item.penugasan || {};

  const status = normalisasiStatus(item.status);

  const noSet =
    item.no_set ||
    item.nombor_set ||
    "-";

  let butangTindakan = "";

  if (status === "MENUNGGU") {
    butangTindakan = `
      <button
        class="btn-ok btn-small"
        type="button"
        onclick="bukaModalPelepasan('${escapeHtml(item.id)}')"
      >
        LEPASKAN
      </button>

      <button
        class="btn-no btn-small"
        type="button"
        onclick="bukaModalTolak('${escapeHtml(item.id)}')"
      >
        TOLAK
      </button>
    `;
  }

  if (status === "DILEPASKAN") {
    butangTindakan = `
      <button
        class="btn-ok btn-small"
        type="button"
        onclick="bukaModalPemulangan('${escapeHtml(item.id)}')"
      >
        PEMULANGAN
      </button>
    `;
  }

  butangTindakan += `
    <button
      class="btn-secondary btn-small"
      type="button"
      onclick="bukaModalButiran('${escapeHtml(item.id)}')"
    >
      BUTIRAN
    </button>
  `;

  return `
    <tr>

      <td>
        ${bilangan}
      </td>

      <td>
        ${formatTarikhMasa(
          item.tarikh_pendaftaran ||
          item.created_at
        )}
      </td>

      <td>
        <strong>
          ${escapeHtml(profile.pangkat || "")}
          ${escapeHtml(profile.nama || "-")}
        </strong>
      </td>

      <td>
        ${escapeHtml(profile.no_badan || "-")}
      </td>

      <td>
        ${escapeHtml(tugas.jenis_tugas || "-")}
      </td>

      <td>
        ${escapeHtml(tugas.lokasi || "-")}
      </td>

      <td>
        ${escapeHtml(noSet)}
      </td>

      <td>
        ${escapeHtml(formatAksesori(item.aksesori))}
      </td>

      <td>
        <span class="status-badge ${kelasStatus(status)}">
          ${escapeHtml(status || "-")}
        </span>
      </td>

      <td>
        <div class="table-actions">
          ${butangTindakan}
        </div>
      </td>

    </tr>
  `;
}


/* =========================================================
   CARI REKOD BERDASARKAN ID
========================================================= */

function cariRekodTSM(id) {
  return senaraiPendaftaranSet.find(
    item => String(item.id) === String(id)
  );
}


/**
 * Bina paparan ringkas maklumat petugas.
 */
function binaMaklumatRingkas(item) {
  const profile = item?.profile || {};
  const tugas = item?.penugasan || {};

  return `
    <div>
      <strong>Petugas:</strong><br>
      ${escapeHtml(profile.pangkat || "")}
      ${escapeHtml(profile.nama || "-")}
    </div>

    <div>
      <strong>No Badan:</strong><br>
      ${escapeHtml(profile.no_badan || "-")}
    </div>

    <div>
      <strong>Penugasan:</strong><br>
      ${escapeHtml(tugas.jenis_tugas || "-")}
    </div>

    <div>
      <strong>Lokasi:</strong><br>
      ${escapeHtml(tugas.lokasi || "-")}
    </div>

    <div>
      <strong>Tarikh Tugas:</strong><br>
      ${formatTarikh(tugas.tarikh_tugas)}
    </div>
  `;
}


/* =========================================================
   MODAL PELEPASAN SET
========================================================= */

function bukaModalPelepasan(id) {
  const rekod = cariRekodTSM(id);

  if (!rekod) {
    alert("Rekod pendaftaran tidak ditemui.");
    return;
  }

  if (normalisasiStatus(rekod.status) !== "MENUNGGU") {
    alert(
      "Hanya permohonan berstatus MENUNGGU boleh dilepaskan."
    );

    return;
  }

  rekodPelepasanAktif = rekod;

  resetBorangPelepasan();

  document.getElementById(
    "maklumatPelepasan"
  ).innerHTML = binaMaklumatRingkas(rekod);

  document
    .getElementById("modalPelepasan")
    .classList.remove("hidden");
}


function tutupModalPelepasan() {
  document
    .getElementById("modalPelepasan")
    ?.classList.add("hidden");

  rekodPelepasanAktif = null;

  resetBorangPelepasan();
}


function resetBorangPelepasan() {
  const noSet =
    document.getElementById("noSetPelepasan");

  const catatan =
    document.getElementById("catatanPelepasan");

  if (noSet) {
    noSet.value = "";
  }

  if (catatan) {
    catatan.value = "";
  }

  resetCheckbox([
    "aksesoriBateri",
    "aksesoriCharger",
    "aksesoriEarphone",
    "aksesoriClip",
    "aksesoriAntenna",
    "aksesoriLain"
  ]);

  sembunyiStatusTSM("statusPelepasan");
}


/**
 * Simpan pelepasan set.
 */
async function simpanPelepasanSet() {
  if (!rekodPelepasanAktif?.id) {
    paparStatusTSM(
      "statusPelepasan",
      "Rekod permohonan tidak sah.",
      "error"
    );

    return;
  }

  const noSet = String(
    document.getElementById("noSetPelepasan")?.value ?? ""
  )
    .trim()
    .toUpperCase();

  const aksesori = dapatkanAksesoriDipilih([
    "aksesoriBateri",
    "aksesoriCharger",
    "aksesoriEarphone",
    "aksesoriClip",
    "aksesoriAntenna",
    "aksesoriLain"
  ]);

  const catatan = String(
    document.getElementById("catatanPelepasan")?.value ?? ""
  ).trim();

  if (!noSet) {
    paparStatusTSM(
      "statusPelepasan",
      "Sila masukkan nombor set.",
      "warning"
    );

    return;
  }

  const pasti = window.confirm(
    `Adakah anda pasti mahu melepaskan set ${noSet} kepada petugas ini?`
  );

  if (!pasti) {
    return;
  }

  setButangLoadingTSM(
    "btnSimpanPelepasan",
    true,
    "SEDANG MENYIMPAN...",
    "LEPASKAN SET"
  );

  try {
    /*
     * RPC akan:
     * 1. Semak peranan TSM.
     * 2. Semak status MENUNGGU.
     * 3. Semak nombor set tidak sedang digunakan.
     * 4. Kemas kini status kepada DILEPASKAN.
     */
    const {
      data,
      error
    } = await db.rpc(
      "kemas_kini_set_tsm",
      {
        p_rekod_id:
          rekodPelepasanAktif.id,

        p_tindakan:
          "LEPASKAN",

        p_no_set:
          noSet,

        p_aksesori:
          aksesori,

        p_keadaan_set:
          null,

        p_sebab:
          null,

        p_catatan:
          catatan || null
      }
    );

    if (error) {
      throw error;
    }

    if (data?.success === false) {
      throw new Error(
        data.message || "Pelepasan set gagal."
      );
    }

    alert("Set walkie-talkie berjaya dilepaskan.");

    tutupModalPelepasan();
    await muatSenaraiTSM();
  } catch (error) {
    console.error("Ralat pelepasan set:", error);

    paparStatusTSM(
      "statusPelepasan",
      `Pelepasan set gagal: ${
        error.message || "Ralat tidak diketahui."
      }`,
      "error"
    );
  } finally {
    setButangLoadingTSM(
      "btnSimpanPelepasan",
      false,
      "SEDANG MENYIMPAN...",
      "LEPASKAN SET"
    );
  }
}


/* =========================================================
   MODAL PENOLAKAN
========================================================= */

function bukaModalTolak(id) {
  const rekod = cariRekodTSM(id);

  if (!rekod) {
    alert("Rekod pendaftaran tidak ditemui.");
    return;
  }

  if (normalisasiStatus(rekod.status) !== "MENUNGGU") {
    alert(
      "Hanya permohonan berstatus MENUNGGU boleh ditolak."
    );

    return;
  }

  rekodPenolakanAktif = rekod;

  resetBorangTolak();

  document.getElementById(
    "maklumatTolak"
  ).innerHTML = binaMaklumatRingkas(rekod);

  document
    .getElementById("modalTolak")
    .classList.remove("hidden");
}


function tutupModalTolak() {
  document
    .getElementById("modalTolak")
    ?.classList.add("hidden");

  rekodPenolakanAktif = null;

  resetBorangTolak();
}


function resetBorangTolak() {
  const sebab =
    document.getElementById("sebabTolak");

  const catatan =
    document.getElementById("catatanTolak");

  if (sebab) {
    sebab.value = "";
  }

  if (catatan) {
    catatan.value = "";
  }

  sembunyiStatusTSM("statusTolak");
}


/**
 * Simpan penolakan permohonan.
 */
async function simpanPenolakanSet() {
  if (!rekodPenolakanAktif?.id) {
    paparStatusTSM(
      "statusTolak",
      "Rekod permohonan tidak sah.",
      "error"
    );

    return;
  }

  const sebab = normalisasiStatus(
    document.getElementById("sebabTolak")?.value
  );

  const catatan = String(
    document.getElementById("catatanTolak")?.value ?? ""
  ).trim();

  if (!sebab) {
    paparStatusTSM(
      "statusTolak",
      "Sila pilih sebab penolakan.",
      "warning"
    );

    return;
  }

  const pasti = window.confirm(
    "Adakah anda pasti mahu menolak permohonan set ini?"
  );

  if (!pasti) {
    return;
  }

  setButangLoadingTSM(
    "btnSimpanTolak",
    true,
    "SEDANG MENYIMPAN...",
    "TOLAK PERMOHONAN"
  );

  try {
    const {
      data,
      error
    } = await db.rpc(
      "kemas_kini_set_tsm",
      {
        p_rekod_id:
          rekodPenolakanAktif.id,

        p_tindakan:
          "TOLAK",

        p_no_set:
          null,

        p_aksesori:
          [],

        p_keadaan_set:
          null,

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
        data.message || "Penolakan permohonan gagal."
      );
    }

    alert("Permohonan set telah ditolak.");

    tutupModalTolak();
    await muatSenaraiTSM();
  } catch (error) {
    console.error(
      "Ralat penolakan permohonan:",
      error
    );

    paparStatusTSM(
      "statusTolak",
      `Penolakan gagal: ${
        error.message || "Ralat tidak diketahui."
      }`,
      "error"
    );
  } finally {
    setButangLoadingTSM(
      "btnSimpanTolak",
      false,
      "SEDANG MENYIMPAN...",
      "TOLAK PERMOHONAN"
    );
  }
}


/* =========================================================
   MODAL PEMULANGAN
========================================================= */

function bukaModalPemulangan(id) {
  const rekod = cariRekodTSM(id);

  if (!rekod) {
    alert("Rekod set tidak ditemui.");
    return;
  }

  if (normalisasiStatus(rekod.status) !== "DILEPASKAN") {
    alert(
      "Hanya set berstatus DILEPASKAN boleh dipulangkan."
    );

    return;
  }

  rekodPemulanganAktif = rekod;

  resetBorangPemulangan();

  const noSet =
    rekod.no_set ||
    rekod.nombor_set ||
    "-";

  document.getElementById(
    "maklumatPemulangan"
  ).innerHTML = `
    ${binaMaklumatRingkas(rekod)}

    <div>
      <strong>Nombor Set:</strong><br>
      ${escapeHtml(noSet)}
    </div>

    <div>
      <strong>Aksesori Dilepaskan:</strong><br>
      ${escapeHtml(formatAksesori(rekod.aksesori))}
    </div>

    <div>
      <strong>Masa Dilepaskan:</strong><br>
      ${formatTarikhMasa(rekod.masa_dilepaskan)}
    </div>
  `;

  tandakanAksesoriPemulangan(rekod.aksesori);

  document
    .getElementById("modalPemulangan")
    .classList.remove("hidden");
}


/**
 * Tandakan aksesori asal sebagai dipulangkan secara default.
 */
function tandakanAksesoriPemulangan(aksesoriAsal) {
  let senarai = [];

  if (Array.isArray(aksesoriAsal)) {
    senarai = aksesoriAsal;
  } else if (typeof aksesoriAsal === "string") {
    try {
      const parsed = JSON.parse(aksesoriAsal);

      senarai = Array.isArray(parsed)
        ? parsed
        : aksesoriAsal.split(",");
    } catch {
      senarai = aksesoriAsal.split(",");
    }
  }

  senarai = senarai.map(item =>
    normalisasiStatus(item)
  );

  const pemetaan = {
    BATERI: "pulangBateri",
    CHARGER: "pulangCharger",
    PENGECAS: "pulangCharger",
    EARPHONE: "pulangEarphone",
    CLIP: "pulangClip",
    "BELT CLIP": "pulangClip",
    ANTENNA: "pulangAntenna",
    "LAIN-LAIN": "pulangLain"
  };

  Object.entries(pemetaan).forEach(
    ([nama, elemenId]) => {
      const elemen =
        document.getElementById(elemenId);

      if (elemen && senarai.includes(nama)) {
        elemen.checked = true;
      }
    }
  );
}


function tutupModalPemulangan() {
  document
    .getElementById("modalPemulangan")
    ?.classList.add("hidden");

  rekodPemulanganAktif = null;

  resetBorangPemulangan();
}


function resetBorangPemulangan() {
  const keadaan =
    document.getElementById("keadaanSet");

  const catatan =
    document.getElementById("catatanPemulangan");

  if (keadaan) {
    keadaan.value = "";
  }

  if (catatan) {
    catatan.value = "";
  }

  resetCheckbox([
    "pulangBateri",
    "pulangCharger",
    "pulangEarphone",
    "pulangClip",
    "pulangAntenna",
    "pulangLain"
  ]);

  sembunyiStatusTSM("statusPemulangan");
}


/**
 * Simpan pemulangan set.
 */
async function simpanPemulanganSet() {
  if (!rekodPemulanganAktif?.id) {
    paparStatusTSM(
      "statusPemulangan",
      "Rekod set tidak sah.",
      "error"
    );

    return;
  }

  const keadaanSet = normalisasiStatus(
    document.getElementById("keadaanSet")?.value
  );

  const aksesoriDipulangkan =
    dapatkanAksesoriDipilih([
      "pulangBateri",
      "pulangCharger",
      "pulangEarphone",
      "pulangClip",
      "pulangAntenna",
      "pulangLain"
    ]);

  const catatan = String(
    document.getElementById("catatanPemulangan")?.value ?? ""
  ).trim();

  if (!keadaanSet) {
    paparStatusTSM(
      "statusPemulangan",
      "Sila pilih keadaan set.",
      "warning"
    );

    return;
  }

  if (
    ["ROSAK", "TIDAK LENGKAP", "HILANG"].includes(
      keadaanSet
    ) &&
    !catatan
  ) {
    paparStatusTSM(
      "statusPemulangan",
      "Catatan wajib dimasukkan bagi set rosak, tidak lengkap atau hilang.",
      "warning"
    );

    return;
  }

  const pasti = window.confirm(
    "Adakah anda pasti mahu mengesahkan pemulangan set ini?"
  );

  if (!pasti) {
    return;
  }

  setButangLoadingTSM(
    "btnSimpanPemulangan",
    true,
    "SEDANG MENYIMPAN...",
    "SAHKAN PEMULANGAN"
  );

  try {
    const {
      data,
      error
    } = await db.rpc(
      "kemas_kini_set_tsm",
      {
        p_rekod_id:
          rekodPemulanganAktif.id,

        p_tindakan:
          "PULANG",

        p_no_set:
          rekodPemulanganAktif.no_set ||
          rekodPemulanganAktif.nombor_set ||
          null,

        p_aksesori:
          aksesoriDipulangkan,

        p_keadaan_set:
          keadaanSet,

        p_sebab:
          null,

        p_catatan:
          catatan || null
      }
    );

    if (error) {
      throw error;
    }

    if (data?.success === false) {
      throw new Error(
        data.message || "Pemulangan set gagal."
      );
    }

    alert("Pemulangan set berjaya disahkan.");

    tutupModalPemulangan();
    await muatSenaraiTSM();
  } catch (error) {
    console.error("Ralat pemulangan set:", error);

    paparStatusTSM(
      "statusPemulangan",
      `Pemulangan set gagal: ${
        error.message || "Ralat tidak diketahui."
      }`,
      "error"
    );
  } finally {
    setButangLoadingTSM(
      "btnSimpanPemulangan",
      false,
      "SEDANG MENYIMPAN...",
      "SAHKAN PEMULANGAN"
    );
  }
}


/* =========================================================
   MODAL BUTIRAN
========================================================= */

function bukaModalButiran(id) {
  const rekod = cariRekodTSM(id);

  if (!rekod) {
    alert("Rekod tidak ditemui.");
    return;
  }

  const profile = rekod.profile || {};
  const tugas = rekod.penugasan || {};

  const pelepas = rekod.pegawaiPelepas || {};
  const pemulang = rekod.pegawaiPemulangan || {};
  const penolak = rekod.pegawaiPenolak || {};

  const noSet =
    rekod.no_set ||
    rekod.nombor_set ||
    "-";

  document.getElementById(
    "kandunganButiran"
  ).innerHTML = `
    <div class="detail-grid">

      <div class="detail-label">
        Petugas
      </div>

      <div>
        ${escapeHtml(profile.pangkat || "")}
        ${escapeHtml(profile.nama || "-")}
      </div>


      <div class="detail-label">
        No Badan
      </div>

      <div>
        ${escapeHtml(profile.no_badan || "-")}
      </div>


      <div class="detail-label">
        Telefon
      </div>

      <div>
        ${escapeHtml(profile.telefon || "-")}
      </div>


      <div class="detail-label">
        Bahagian
      </div>

      <div>
        ${escapeHtml(profile.bahagian || "-")}
      </div>


      <div class="detail-label">
        Penugasan
      </div>

      <div>
        ${escapeHtml(tugas.jenis_tugas || "-")}
      </div>


      <div class="detail-label">
        Lokasi
      </div>

      <div>
        ${escapeHtml(tugas.lokasi || "-")}
      </div>


      <div class="detail-label">
        Tarikh Tugas
      </div>

      <div>
        ${formatTarikh(tugas.tarikh_tugas)}
      </div>


      <div class="detail-label">
        Masa Pendaftaran
      </div>

      <div>
        ${formatTarikhMasa(
          rekod.tarikh_pendaftaran ||
          rekod.created_at
        )}
      </div>


      <div class="detail-label">
        Status
      </div>

      <div>
        <span class="status-badge ${kelasStatus(rekod.status)}">
          ${escapeHtml(
            normalisasiStatus(rekod.status) || "-"
          )}
        </span>
      </div>


      <div class="detail-label">
        Nombor Set
      </div>

      <div>
        ${escapeHtml(noSet)}
      </div>


      <div class="detail-label">
        Aksesori Dilepaskan
      </div>

      <div>
        ${escapeHtml(
          formatAksesori(rekod.aksesori)
        )}
      </div>


      <div class="detail-label">
        Dilepaskan Oleh
      </div>

      <div>
        ${
          pelepas.nama
            ? `${escapeHtml(pelepas.pangkat || "")}
               ${escapeHtml(pelepas.nama)}`
            : "-"
        }
      </div>


      <div class="detail-label">
        Masa Dilepaskan
      </div>

      <div>
        ${formatTarikhMasa(rekod.masa_dilepaskan)}
      </div>


      <div class="detail-label">
        Catatan Pelepasan
      </div>

      <div>
        ${escapeHtml(
          rekod.catatan_pelepasan || "-"
        )}
      </div>


      <div class="detail-label">
        Keadaan Set
      </div>

      <div>
        ${escapeHtml(rekod.keadaan_set || "-")}
      </div>


      <div class="detail-label">
        Aksesori Dipulangkan
      </div>

      <div>
        ${escapeHtml(
          formatAksesori(
            rekod.aksesori_dipulangkan
          )
        )}
      </div>


      <div class="detail-label">
        Diterima Oleh
      </div>

      <div>
        ${
          pemulang.nama
            ? `${escapeHtml(pemulang.pangkat || "")}
               ${escapeHtml(pemulang.nama)}`
            : "-"
        }
      </div>


      <div class="detail-label">
        Masa Dipulangkan
      </div>

      <div>
        ${formatTarikhMasa(rekod.masa_dipulangkan)}
      </div>


      <div class="detail-label">
        Catatan Pemulangan
      </div>

      <div>
        ${escapeHtml(
          rekod.catatan_pemulangan || "-"
        )}
      </div>


      <div class="detail-label">
        Sebab Penolakan
      </div>

      <div>
        ${escapeHtml(
          rekod.sebab_penolakan || "-"
        )}
      </div>


      <div class="detail-label">
        Ditolak Oleh
      </div>

      <div>
        ${
          penolak.nama
            ? `${escapeHtml(penolak.pangkat || "")}
               ${escapeHtml(penolak.nama)}`
            : "-"
        }
      </div>


      <div class="detail-label">
        Masa Ditolak
      </div>

      <div>
        ${formatTarikhMasa(rekod.masa_ditolak)}
      </div>


      <div class="detail-label">
        Catatan Penolakan
      </div>

      <div>
        ${escapeHtml(
          rekod.catatan_penolakan || "-"
        )}
      </div>

    </div>
  `;

  document
    .getElementById("modalButiran")
    .classList.remove("hidden");
}


function tutupModalButiran() {
  document
    .getElementById("modalButiran")
    ?.classList.add("hidden");

  const kandungan =
    document.getElementById("kandunganButiran");

  if (kandungan) {
    kandungan.innerHTML = "";
  }
}


/* =========================================================
   TUTUP MODAL APABILA KLIK LATAR GELAP
========================================================= */

document.addEventListener("click", event => {
  const modalPelepasan =
    document.getElementById("modalPelepasan");

  const modalTolak =
    document.getElementById("modalTolak");

  const modalPemulangan =
    document.getElementById("modalPemulangan");

  const modalButiran =
    document.getElementById("modalButiran");

  if (event.target === modalPelepasan) {
    tutupModalPelepasan();
  }

  if (event.target === modalTolak) {
    tutupModalTolak();
  }

  if (event.target === modalPemulangan) {
    tutupModalPemulangan();
  }

  if (event.target === modalButiran) {
    tutupModalButiran();
  }
});


/* =========================================================
   PEMANTAUAN PERUBAHAN AUTH
========================================================= */

db.auth.onAuthStateChange(
  async (event, session) => {
    if (event === "SIGNED_OUT") {
      tsmAktif = null;
      senaraiPendaftaranSet = [];

      paparHalamanLoginTSM();
      return;
    }

    if (
      event === "SIGNED_IN" &&
      session?.user &&
      !tsmAktif
    ) {
      try {
        const profil = await dapatkanProfilTSM(
          session.user.id
        );

        if (
          profil &&
          perananTSMDibenarkan(profil.peranan) &&
          profil.aktif !== false
        ) {
          tsmAktif = profil;

          paparDashboardTSM();
          await muatSenaraiTSM();
        }
      } catch (error) {
        console.error(
          "Ralat perubahan sesi TSM:",
          error
        );
      }
    }
  }
);
