"use strict";

/* ================================================================
   SKPO MOTOGP — PENTADBIR
   GitHub Pages + Supabase
================================================================ */

const db = window.supabaseClient;
const ZON_MASA = "Asia/Kuala_Lumpur";
const BUCKET_SITREP_ADMIN = "sitrep-lampiran";
const MASA_TAMAT_PERMINTAAN = 15000;

/* Kunci sesi khusus Pentadbir MotoGP. */
const KUNCI_ADMIN_MOTOGP = "skpoAdmin";
let adminLogin = null;
let dataDashboard = [];
let dataLaporanPetugasAdmin = [];
let dataSitrepAdmin = [];
let tabLaporanAdminAktif = "petugas";
let dataPaparan = [];
let rekodResetDevice = null;
let rekodImportPenugasan = [];
let importSedangBerjalan = false;
let rekodImportPengguna = [];
let importPenggunaSedangBerjalan = false;

/* Peranti khas Pentadbir MotoGP */
const KUNCI_DEVICE_MOTOGP_ADMIN = "skpoDeviceId";
const HAD_PERANTI_KHAS_ADMIN = 2;
let dataPerantiKhasAdmin = [];


/* ================================================================
   CETAK CARTA INDIVIDU
================================================================ */

function tajukCetakanCartaPentadbir(jenis, tajuk) {
  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  return {
    tajuk:
      teks(tajuk) ||
      atas(jenis).replace(/_/g, " "),
    tarikh:
      formatTarikhMalaysia(tarikh)
  };
}


function tukarCanvasKeImejUntukCetakanPentadbir(
  asal,
  salinan
) {
  const canvasAsal =
    [...asal.querySelectorAll("canvas")];

  const canvasSalinan =
    [...salinan.querySelectorAll("canvas")];

  canvasAsal.forEach((canvas, index) => {
    const canvasClone =
      canvasSalinan[index];

    if (!canvasClone) return;

    try {
      const imej =
        document.createElement("img");

      imej.src =
        canvas.toDataURL(
          "image/png",
          1
        );

      imej.alt =
        canvas.getAttribute("aria-label") ||
        "Carta operasi";

      imej.className =
        "print-chart-image";

      canvasClone.replaceWith(
        imej
      );

    } catch (error) {
      console.warn(
        "Canvas gagal ditukar kepada imej untuk cetakan:",
        error
      );
    }
  });
}


function bersihkanSalinanCetakanCartaPentadbir(
  salinan
) {
  /*
    Butang dan kawalan interaktif tidak perlu dicetak.
  */
  salinan
    .querySelectorAll(
      "button, select, input, textarea, .admin-chart-print-button, " +
      ".admin-vehicle-hint, .admin-attendance-hint, .admin-incident-hint, " +
      ".admin-map-controls, .admin-map-marker-controls"
    )
    .forEach(item =>
      item.remove()
    );

  /*
    Status berjaya / ralat sistem tidak dimasukkan dalam laporan cetak.
  */
  salinan
    .querySelectorAll(
      ".status-box"
    )
    .forEach(item =>
      item.remove()
    );

  return salinan;
}


function cetakCartaPentadbir(
  jenis,
  tajuk
) {
  const jenisBersih =
    atas(jenis);

  const asal =
    document.querySelector(
      `[data-chart-section="${jenisBersih}"]`
    );

  if (!asal) {
    alert(
      "Bahagian carta untuk dicetak tidak dijumpai."
    );
    return;
  }

  const salinan =
    asal.cloneNode(true);

  tukarCanvasKeImejUntukCetakanPentadbir(
    asal,
    salinan
  );

  bersihkanSalinanCetakanCartaPentadbir(
    salinan
  );

  const maklumat =
    tajukCetakanCartaPentadbir(
      jenisBersih,
      tajuk
    );

  const cssLinks =
    [...document.querySelectorAll(
      'link[rel="stylesheet"]'
    )]
      .map(link => {
        const href =
          new URL(
            link.getAttribute("href"),
            document.baseURI
          ).href;

        return `<link rel="stylesheet" href="${escapeHtml(href)}">`;
      })
      .join("\n");

  const tetingkap =
    window.open(
      "",
      "_blank",
      "width=1400,height=900"
    );

  if (!tetingkap) {
    alert(
      "Pelayar menghalang tetingkap cetak. Benarkan pop-up untuk laman ini dan cuba semula."
    );
    return;
  }

  tetingkap.document.open();

  tetingkap.document.write(`
    <!DOCTYPE html>
    <html lang="ms">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(maklumat.tajuk)}</title>

      ${cssLinks}

      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #111111 !important;
          font-family: Arial, Helvetica, sans-serif !important;
        }

        body {
          padding: 8mm !important;
        }

        .print-report-header {
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 3px solid #d4af37;
          text-align: center;
        }

        .print-report-header h1 {
          margin: 0;
          color: #111111 !important;
          font-size: 22px;
        }

        .print-report-header h2 {
          margin: 6px 0 0;
          color: #111111 !important;
          font-size: 17px;
        }

        .print-report-header p {
          margin: 5px 0 0;
          color: #444444 !important;
          font-size: 12px;
        }

        .print-chart-container {
          width: 100%;
        }

        .print-chart-container .admin-chart-card {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 14px !important;
          border: 1px solid #b8b8b8 !important;
          box-shadow: none !important;
          background: #ffffff !important;
          color: #111111 !important;
        }

        .print-chart-container h3,
        .print-chart-container strong,
        .print-chart-container b,
        .print-chart-container td,
        .print-chart-container th,
        .print-chart-container span,
        .print-chart-container div {
          color: #111111;
        }

        .print-chart-container .muted,
        .print-chart-container small {
          color: #555555 !important;
        }

        .print-chart-container .admin-chart-card-heading,
        .print-chart-container .section-heading,
        .print-chart-container .admin-committee-heading {
          margin-bottom: 12px !important;
        }

        .print-chart-container .section-heading-actions,
        .print-chart-container .admin-committee-heading-actions {
          display: none !important;
        }

        .print-chart-image {
          display: block;
          width: 100% !important;
          max-width: 900px !important;
          height: auto !important;
          margin: 0 auto !important;
          object-fit: contain;
        }

        .print-chart-container .admin-chart-canvas-wrap,
        .print-chart-container .admin-vehicle-canvas-wrap,
        .print-chart-container .admin-attendance-canvas-wrap,
        .print-chart-container .admin-incident-canvas-wrap {
          height: auto !important;
          min-height: 0 !important;
          background: #ffffff !important;
        }

        .print-chart-container .admin-vehicle-layout,
        .print-chart-container .admin-attendance-layout,
        .print-chart-container .admin-incident-layout,
        .print-chart-container .admin-operation-map-layout {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(280px, .72fr) !important;
          gap: 12px !important;
        }

        .print-chart-container .admin-vehicle-chart-panel,
        .print-chart-container .admin-vehicle-detail-panel,
        .print-chart-container .admin-attendance-chart-panel,
        .print-chart-container .admin-attendance-list-panel,
        .print-chart-container .admin-incident-chart-panel,
        .print-chart-container .admin-incident-detail-panel,
        .print-chart-container .admin-operation-map-panel,
        .print-chart-container .admin-operation-map-detail {
          border: 1px solid #bcbcbc !important;
          background: #ffffff !important;
          color: #111111 !important;
        }

        .print-chart-container table {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          table-layout: auto !important;
          border-collapse: collapse !important;
          background: #ffffff !important;
        }

        .print-chart-container th,
        .print-chart-container td {
          position: static !important;
          padding: 7px 8px !important;
          border: 1px solid #777777 !important;
          background: #ffffff !important;
          color: #111111 !important;
          font-size: 10px !important;
        }

        .print-chart-container th {
          font-weight: 700 !important;
          text-align: center !important;
        }

        .print-chart-container .admin-committee-title-row th {
          background: #202020 !important;
          color: #ffffff !important;
        }

        .print-chart-container .admin-committee-group-row td {
          background: #ece2b8 !important;
          color: #111111 !important;
          font-weight: 700 !important;
        }

        .print-chart-container .admin-chronology-table tbody td:nth-child(2) {
          font-weight: 400 !important;
        }

        .print-chart-container .admin-chronology-table tbody td:nth-child(4) {
          text-align: center !important;
          vertical-align: middle !important;
        }

        .print-chart-container .admin-chart-list-item,
        .print-chart-container .admin-vehicle-detail-item,
        .print-chart-container .admin-attendance-person,
        .print-chart-container .admin-incident-detail-item {
          break-inside: avoid;
          border-color: #cccccc !important;
          background: #ffffff !important;
          color: #111111 !important;
        }

        .print-chart-container img {
          max-width: 100%;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>

    <body>
      <header class="print-report-header">
        <h1>OP LITAR MOTOGP 2026</h1>
        <h2>${escapeHtml(maklumat.tajuk)}</h2>
        <p>TARIKH: ${escapeHtml(maklumat.tarikh)}</p>
      </header>

      <main class="print-chart-container">
        ${salinan.outerHTML}
      </main>

      <script>
        window.addEventListener("load", function () {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 500);
        });
      <\/script>
    </body>
    </html>
  `);

  tetingkap.document.close();
}


/* ================================================================
   MODUL CARTA OPERASI
================================================================ */

let dataCartaLaporanPentadbir = [];
let cartaPengunjungPentadbir = null;
let cartaKenderaanPentadbir = null;
let kategoriKenderaanDipilihPentadbir = "BAS";
let cartaJawatankuasaPentadbir = null;
let dataJawatankuasaOperasiPentadbir = [];
let dataPilihanPetugasJawatankuasaPentadbir = [];
let rekodJawatankuasaSedangEditPentadbir = null;
let dataVvipVipOperasiPentadbir = [];
let rekodVvipVipSedangEditPentadbir = null;
let idVvipVipDipilihPentadbir = "";
let cartaKehadiranPentadbir = null;
let statusKehadiranCartaDipilihPentadbir = "HADIR";
let cartaInsidenPentadbir = null;
let kategoriInsidenDipilihPentadbir = "TANGKAPAN";

let lokasiPetaDipilihPentadbir = "";
let tabPetugasLokasiAktif = "BERTUGAS";
let zumPetaCartaPentadbir = 1;
let markerPetaDipaparkanPentadbir = true;

let sedangSeretMarkerPetaPentadbir = false;
let lokasiMarkerSeretPentadbir = "";
let kanvasMarkerSeretPentadbir = null;


const KUNCI_TETAPAN_PETA_CARTA_MOTOGP = "skpoTetapanPetaCarta";
const KUNCI_KRONOLOGI_CARTA_MOTOGP = "skpoKronologiCarta";


function el(id) {
  return document.getElementById(id);
}

function teks(nilai) {
  return String(nilai ?? "").trim();
}

function atas(nilai) {
  return teks(nilai).toUpperCase();
}

function escapeHtml(nilai) {
  return String(nilai ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nilaiBoolean(nilai) {
  return nilai === true || [
    "YA", "YES", "Y", "1", "BENAR", "TRUE"
  ].includes(atas(nilai));
}

function emailDalaman(noBadan) {
  const nilai = atas(noBadan)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  return `${nilai}@skpo.local`;
}


function hariIniMalaysia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}


function formatTarikhMalaysia(nilai) {
  if (!nilai) return "-";

  const input = teks(nilai);

  /*
    YYYY-MM-DD diproses tanpa timezone supaya tarikh
    tidak berubah akibat zon masa browser.
  */
  const padanan =
    input.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (padanan) {
    return `${padanan[3]}/${padanan[2]}/${padanan[1]}`;
  }

  const tarikh =
    new Date(input);

  if (
    Number.isNaN(
      tarikh.getTime()
    )
  ) {
    return input || "-";
  }

  return new Intl.DateTimeFormat(
    "ms-MY",
    {
      timeZone: ZON_MASA,
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(tarikh);
}


function formatTarikhMasa(nilai) {
  if (!nilai) return "-";

  const tarikh = new Date(nilai);
  if (Number.isNaN(tarikh.getTime())) return teks(nilai) || "-";

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(tarikh);
}

function formatTempoh(minit) {
  const jumlah = Number(minit);
  if (!Number.isFinite(jumlah)) return "-";

  const selamat = Math.max(0, jumlah);
  return `${Math.floor(selamat / 60)} jam ${Math.round(selamat % 60)} minit`;
}

function bahagiKumpulan(senarai, saiz) {
  const hasil = [];
  for (let i = 0; i < senarai.length; i += saiz) {
    hasil.push(senarai.slice(i, i + saiz));
  }
  return hasil;
}

function paparMesej(id, mesej, jenis = "warning") {
  const elemen = el(id);
  if (!elemen) return;

  elemen.className = jenis;
  elemen.innerHTML = mesej;
}

function denganHadMasa(promise, milisaat = MASA_TAMAT_PERMINTAAN) {
  let pemasa;

  const tamat = new Promise((_, reject) => {
    pemasa = setTimeout(() => {
      reject(new Error(
        "Sambungan ke Supabase mengambil masa terlalu lama. " +
        "Semak Project URL, Publishable Key dan status projek Supabase."
      ));
    }, milisaat);
  });

  return Promise.race([promise, tamat])
    .finally(() => clearTimeout(pemasa));
}

function pastikanSupabase() {
  if (!db?.auth || typeof db.auth.signInWithPassword !== "function") {
    throw new Error(
      window.SKPO_SUPABASE_ERROR ||
      "Sambungan Supabase belum tersedia. Semak api-config.js, " +
      "supabase-client.js dan susunan fail JavaScript."
    );
  }
}

async function panggilEdgeFunction(namaFungsi, body, masaTamat = 25000) {
  pastikanSupabase();

  const konfigurasi = window.SKPO_CONFIG || {};
  const projectUrlInput = teks(konfigurasi.SUPABASE_URL);
  const publishableKey = teks(
    konfigurasi.SUPABASE_PUBLISHABLE_KEY ||
    konfigurasi.SUPABASE_ANON_KEY
  );

  if (!projectUrlInput || !publishableKey) {
    throw new Error(
      "Project URL atau Publishable Key belum lengkap dalam js/api-config.js."
    );
  }

  let projectUrl;

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
      "SUPABASE_URL tidak sah. Gunakan URL seperti https://PROJECT-ID.supabase.co"
    );
  }

  const { data: sesiData, error: sesiError } =
    await denganHadMasa(db.auth.getSession());

  if (sesiError) throw sesiError;

  const accessToken = sesiData?.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "Sesi Pentadbir telah tamat. Sila log keluar dan login semula."
    );
  }

  const endpoint =
    `${projectUrl}/functions/v1/${encodeURIComponent(namaFungsi)}`;

  let response;

  try {
    response = await denganHadMasa(
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "apikey": publishableKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body || {})
      }),
      masaTamat
    );
  } catch (error) {
    throw new Error(
      "Edge Function tidak dapat dihubungi. Pastikan fungsi " +
      `\"${namaFungsi}\" telah dideploy dan kod CORS telah dimasukkan. ` +
      `Butiran: ${error?.message || "Ralat rangkaian"}`
    );
  }

  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (_) {
      data = { message: responseText };
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Edge Function gagal dengan status HTTP ${response.status}.`
    );
  }

  return data || {};
}

async function dapatkanProfil(userId) {
  let hasil = await denganHadMasa(
    db.from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
  );

  if (
    hasil.error &&
    /auth_user_id|column.*id|does not exist/i.test(hasil.error.message || "")
  ) {
    hasil = await denganHadMasa(
      db.from("profiles")
        .select("*")
        .eq("auth_user_id", userId)
        .maybeSingle()
    );
  }

  if (hasil.error) throw hasil.error;
  return hasil.data;
}

function semakPerananPentadbir(profil) {
  return ["PENTADBIR", "ADMIN"].includes(atas(profil?.peranan));
}

/* ================================================================
   PERANTI KHAS PENTADBIR
================================================================ */

function dapatkanDeviceIdAdmin() {
  let id = localStorage.getItem(KUNCI_DEVICE_MOTOGP_ADMIN);

  if (!id) {
    const rawak =
      window.crypto?.randomUUID?.() ||
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, aksara => {
        const nombor = Math.random() * 16 | 0;
        const nilai = aksara === "x" ? nombor : (nombor & 3 | 8);
        return nilai.toString(16);
      });

    id = `DEV-${rawak.toUpperCase()}`;
    localStorage.setItem(KUNCI_DEVICE_MOTOGP_ADMIN, id);
  }

  return id;
}

function jenisPerantiSemasaAdmin() {
  const ua = String(navigator.userAgent || "").toLowerCase();

  if (
    /android|iphone|ipad|ipod|mobile|windows phone/.test(ua)
  ) {
    return "TELEFON";
  }

  return "LAPTOP";
}

function paparanStatusPerantiKhasAdmin(aktif) {
  const ruang = el("statusPerantiKhasAdmin");
  const btnTambah = el("btnJadikanPerantiKhas");
  const btnBuang = el("btnBuangPerantiKhas");

  if (ruang) {
    ruang.innerHTML = aktif
      ? '<span class="badge badge-green">PERANTI KHAS AKTIF</span>'
      : '<span class="badge badge-gray">BUKAN PERANTI KHAS</span>';
  }

  if (btnTambah) btnTambah.disabled = aktif;
  if (btnBuang) btnBuang.disabled = !aktif;
}

async function muatPerantiKhasAdmin() {
  if (!adminLogin) return;

  const deviceId = dapatkanDeviceIdAdmin();
  const jenis = jenisPerantiSemasaAdmin();

  if (el("deviceIdAdmin")) {
    el("deviceIdAdmin").textContent = deviceId;
  }

  if (el("jenisPerantiAdmin")) {
    el("jenisPerantiAdmin").textContent = jenis;
  }

  try {
    const { data, error } = await denganHadMasa(
      db.from("device_whitelist")
        .select("device_id,akses_semua_petugas,catatan,aktif")
        .eq("akses_semua_petugas", true)
        .order("device_id", { ascending: true })
    );

    if (error) throw error;

    dataPerantiKhasAdmin = data || [];

    const perantiSemasa = dataPerantiKhasAdmin.find(
      item => atas(item.device_id) === atas(deviceId) && item.aktif !== false
    );

    paparanStatusPerantiKhasAdmin(Boolean(perantiSemasa));

    const tbody = el("tbodyPerantiKhasAdmin");
    if (tbody) {
      if (!dataPerantiKhasAdmin.length) {
        tbody.innerHTML =
          '<tr><td colspan="4" class="empty-row">Belum ada peranti khas didaftarkan.</td></tr>';
      } else {
        tbody.innerHTML = dataPerantiKhasAdmin.map((item, index) => {
          const catatan = teks(item.catatan) || "-";
          const jenisPeranti =
            /TELEFON/i.test(catatan) ? "TELEFON" :
            /LAPTOP/i.test(catatan) ? "LAPTOP" : "-";

          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(jenisPeranti)}</td>
              <td style="word-break:break-all">${escapeHtml(item.device_id || "-")}</td>
              <td>${escapeHtml(catatan)}</td>
            </tr>
          `;
        }).join("");
      }
    }

    const statusBox = el("mesejPerantiKhasAdmin");
    if (statusBox && !statusBox.innerHTML) {
      statusBox.style.display = "none";
    }

  } catch (error) {
    console.error("Gagal memuatkan peranti khas:", error);
    paparanStatusPerantiKhasAdmin(false);

    paparMesej(
      "mesejPerantiKhasAdmin",
      `Gagal menyemak peranti khas: ${escapeHtml(error.message)}. ` +
      "Pastikan kolum akses_semua_petugas dan catatan telah diwujudkan dalam device_whitelist.",
      "error"
    );
  }
}

async function salinDeviceIdAdmin() {
  const deviceId = dapatkanDeviceIdAdmin();

  try {
    await navigator.clipboard.writeText(deviceId);
    paparMesej(
      "mesejPerantiKhasAdmin",
      "Device ID berjaya disalin.",
      "success"
    );
  } catch (_) {
    window.prompt("Salin Device ID ini:", deviceId);
  }
}

async function jadikanPerantiKhasAdmin() {
  if (!adminLogin) return;

  const deviceId = dapatkanDeviceIdAdmin();
  const jenis = jenisPerantiSemasaAdmin();
  const btn = el("btnJadikanPerantiKhas");

  btn.disabled = true;
  btn.textContent = "SEDANG MENDAFTAR...";

  try {
    const { data: sediaAda, error: semakError } = await denganHadMasa(
      db.from("device_whitelist")
        .select("device_id,akses_semua_petugas,catatan,aktif")
        .eq("akses_semua_petugas", true)
    );

    if (semakError) throw semakError;

    const senaraiAktif = (sediaAda || []).filter(item => item.aktif !== false);
    const sudahAda = senaraiAktif.some(
      item => atas(item.device_id) === atas(deviceId)
    );

    if (!sudahAda && senaraiAktif.length >= HAD_PERANTI_KHAS_ADMIN) {
      throw new Error(
        "Had maksimum 2 peranti khas telah dicapai. Buang salah satu peranti khas dahulu."
      );
    }

    const jenisSudahAda = senaraiAktif.some(item => {
      if (atas(item.device_id) === atas(deviceId)) return false;
      const catatan = atas(item.catatan);
      return jenis === "TELEFON"
        ? catatan.includes("TELEFON")
        : catatan.includes("LAPTOP");
    });

    if (!sudahAda && jenisSudahAda) {
      throw new Error(
        `Satu peranti khas jenis ${jenis} sudah didaftarkan. ` +
        `Sistem hanya membenarkan 1 LAPTOP dan 1 TELEFON.`
      );
    }

    const payload = {
      device_id: deviceId,
      akses_semua_petugas: true,
      aktif: true,
      catatan: `PERANTI KHAS ADMIN MOTOGP - ${jenis}`
    };

    /*
      Cuba UPSERT terus ke device_whitelist.
      device_id perlu mempunyai UNIQUE constraint.
    */
    const { error } = await denganHadMasa(
      db.from("device_whitelist")
        .upsert(payload, { onConflict: "device_id" })
    );

    if (error) throw error;

    paparMesej(
      "mesejPerantiKhasAdmin",
      `<strong>PERANTI KHAS BERJAYA DIAKTIFKAN.</strong><br>` +
      `${escapeHtml(jenis)} ini kini boleh digunakan untuk login sebagai petugas lain.`,
      "success"
    );

    await muatPerantiKhasAdmin();

  } catch (error) {
    console.error("Gagal menjadikan peranti khas:", error);

    const tambahan =
      /row-level security|permission denied|policy/i.test(error.message || "")
        ? " Semak RLS/policy INSERT dan UPDATE pada table device_whitelist."
        : /duplicate|unique|on conflict/i.test(error.message || "")
          ? " Pastikan device_whitelist.device_id mempunyai UNIQUE constraint."
          : "";

    paparMesej(
      "mesejPerantiKhasAdmin",
      `Gagal mendaftarkan peranti khas: ${escapeHtml(error.message)}${escapeHtml(tambahan)}`,
      "error"
    );

  } finally {
    btn.textContent = "JADIKAN PERANTI KHAS";
    const aktif = dataPerantiKhasAdmin.some(
      item => atas(item.device_id) === atas(deviceId) && item.aktif !== false
    );
    btn.disabled = aktif;
  }
}

async function buangPerantiKhasAdmin() {
  if (!adminLogin) return;

  const deviceId = dapatkanDeviceIdAdmin();

  if (!confirm(
    "Buang status PERANTI KHAS daripada peranti ini? " +
    "Selepas dibuang, peranti ini akan kembali tertakluk kepada kawalan device binding biasa."
  )) return;

  const btn = el("btnBuangPerantiKhas");
  btn.disabled = true;
  btn.textContent = "SEDANG MEMBUANG...";

  try {
    const { error } = await denganHadMasa(
      db.from("device_whitelist")
        .update({
          akses_semua_petugas: false,
          aktif: false
        })
        .eq("device_id", deviceId)
    );

    if (error) throw error;

    paparMesej(
      "mesejPerantiKhasAdmin",
      "Status peranti khas berjaya dibuang.",
      "success"
    );

    await muatPerantiKhasAdmin();

  } catch (error) {
    console.error("Gagal membuang peranti khas:", error);

    paparMesej(
      "mesejPerantiKhasAdmin",
      `Gagal membuang peranti khas: ${escapeHtml(error.message)}`,
      "error"
    );

  } finally {
    btn.textContent = "BUANG PERANTI KHAS";
  }
}

/* ================================================================
   LOGIN DAN SESI
================================================================ */

async function login() {
  const noBadan = atas(el("noBadan")?.value);
  const password = teks(el("password")?.value);
  const butang = el("btnLogin");

  if (!noBadan || !password) {
    paparMesej(
      "loginStatus",
      "Sila masukkan No Badan dan kata laluan.",
      "error"
    );
    return;
  }

  butang.disabled = true;
  butang.textContent = "SEDANG MENYEMAK...";
  paparMesej("loginStatus", "Sedang menyemak...", "warning");

  try {
    pastikanSupabase();

    const { data, error } = await denganHadMasa(
      db.auth.signInWithPassword({
        email: emailDalaman(noBadan),
        password
      })
    );

    if (error) {
      const mesejSupabase = String(
        error.message || "Ralat pengesahan tidak diketahui."
      ).trim();

      throw new Error(
        "Login Supabase gagal: " + mesejSupabase
      );
    }

    if (!data?.user) {
      throw new Error(
        "Login Supabase tidak memulangkan maklumat pengguna."
      );
    }

    const profil = await dapatkanProfil(data.user.id);

    if (!profil) {
      throw new Error(
        "Akaun Auth berjaya ditemui tetapi profil pengguna tidak wujud."
      );
    }

    if (profil.aktif === false) {
      throw new Error("Akaun Pentadbir telah dinyahaktifkan.");
    }

    const peranan = atas(profil.peranan);

if (!semakPerananPentadbir(profil)) {

  await db.auth.signOut().catch(() => {});

  if (peranan === "TSM") {
    window.location.replace("tsm.html");
    return;
  }

  window.location.replace("index.html");
  return;
}

    adminLogin = {
      id: profil.id,
      authUserId: data.user.id,
      noBadan: profil.no_badan,
      pangkat: profil.pangkat || "",
      nama: profil.nama || "",
      peranan: atas(profil.peranan)
    };

    localStorage.setItem(KUNCI_ADMIN_MOTOGP, JSON.stringify(adminLogin));

    el("loginPage").style.display = "none";
    el("dashboard").style.display = "block";
    el("adminName").textContent = [
      adminLogin.pangkat,
      adminLogin.nama,
      `(${adminLogin.noBadan})`
    ].filter(Boolean).join(" ");

    paparMesej("loginStatus", "", "success");
    await muatData(true);
    await muatPerantiKhasAdmin();
  } catch (error) {
    console.error("Login Pentadbir gagal:", error);
    await db?.auth?.signOut().catch(() => {});

    paparMesej(
      "loginStatus",
      escapeHtml(error.message || "Login Pentadbir gagal."),
      "error"
    );
  } finally {
    butang.disabled = false;
    butang.textContent = "LOGIN PENTADBIR";
  }
}

async function pulihkanSesiPentadbir() {
  try {
    pastikanSupabase();

    const { data, error } = await denganHadMasa(db.auth.getSession());
    if (error || !data?.session?.user) return;

    const profil = await dapatkanProfil(data.session.user.id);
    if (!profil || profil.aktif === false) {

  await db.auth.signOut().catch(() => {});
  window.location.replace("index.html");
  return;

}

const peranan = atas(profil.peranan);

if (!semakPerananPentadbir(profil)) {

  await db.auth.signOut().catch(() => {});

  if (peranan === "TSM") {
    window.location.replace("tsm.html");
    return;
  }

  window.location.replace("index.html");
  return;

}

    adminLogin = {
      id: profil.id,
      authUserId: data.session.user.id,
      noBadan: profil.no_badan,
      pangkat: profil.pangkat || "",
      nama: profil.nama || "",
      peranan: atas(profil.peranan)
    };

    el("loginPage").style.display = "none";
    el("dashboard").style.display = "block";
    el("adminName").textContent = [
      adminLogin.pangkat,
      adminLogin.nama,
      `(${adminLogin.noBadan})`
    ].filter(Boolean).join(" ");

    await muatData(true);
    await muatPerantiKhasAdmin();
  } catch (error) {
    console.error("Pemulihan sesi Pentadbir gagal:", error);
    paparMesej("loginStatus", escapeHtml(error.message), "error");
  }
}

async function logout() {
  await db?.auth?.signOut().catch(() => {});
  localStorage.removeItem(KUNCI_ADMIN_MOTOGP);
  adminLogin = null;
  dataDashboard = [];
  dataPaparan = [];

  el("dashboard").style.display = "none";
  el("loginPage").style.display = "flex";
  el("noBadan").value = "";
  el("password").value = "";
  el("loginStatus").innerHTML = "";
  el("noBadan").focus();
}

/* ================================================================
   DATA DASHBOARD
================================================================ */

async function muatData(kemasKiniPenapis = false) {
  if (!adminLogin) return;

  const tarikh = el("tarikh").value || hariIniMalaysia();
  el("tarikh").value = tarikh;
  paparMesej("status", "Sedang mendapatkan data...", "warning");

  try {
    const penugasanRes = await denganHadMasa(
      db.from("penugasan")
        .select("*")
        .eq("tarikh", tarikh)
        .order("created_at", { ascending: true })
    );

    if (penugasanRes.error) throw penugasanRes.error;

    const senaraiTugas = penugasanRes.data || [];
    const petugasIds = [...new Set(
      senaraiTugas
        .map(item => item.petugas_id || item.profile_id)
        .filter(Boolean)
    )];

    let profil = [];
    if (petugasIds.length) {
      const profilRes = await denganHadMasa(
        db.from("profiles").select("*").in("id", petugasIds)
      );
      if (profilRes.error) throw profilRes.error;
      profil = profilRes.data || [];
    }

    const [checkinRes, checkoutRes, deviceRes] = await Promise.all([
      denganHadMasa(
        db.from("checkin").select("*").eq("tarikh", tarikh)
      ),
      denganHadMasa(
        db.from("checkout").select("*").eq("tarikh", tarikh)
      ),
      denganHadMasa(
        db.rpc("senarai_device_petugas", {
          p_petugas_ids: petugasIds
        })
      )
    ]);

    if (checkinRes.error) throw checkinRes.error;
    if (checkoutRes.error) throw checkoutRes.error;
    if (deviceRes.error) {
      throw new Error(
        `Status Device gagal dimuatkan: ${deviceRes.error.message}. Jalankan semula device-binding.sql.`
      );
    }

    const profilMap = new Map(profil.map(item => [item.id, item]));
    const checkinMap = new Map(
      (checkinRes.data || []).map(item => [item.penugasan_id, item])
    );
    const checkoutMap = new Map(
      (checkoutRes.data || []).map(item => [item.penugasan_id, item])
    );
    const deviceMap = new Map(
      (deviceRes.data || []).map(item => [item.profile_id, item])
    );

    dataDashboard = senaraiTugas.map(item => {
      const petugasId = item.petugas_id || item.profile_id;
      const pengguna = profilMap.get(petugasId) || {};
      const checkin = checkinMap.get(item.id) || null;
      const checkout = checkoutMap.get(item.id) || null;
      const ikatanDevice = deviceMap.get(petugasId) || null;
      const statusTugas = atas(item.status);
      const statusKehadiran = statusTugas === "DIGANTI"
        ? "DIGANTI"
        : checkin
          ? atas(checkin.status) || "MENUNGGU"
          : "BELUM HADIR";

      return {
        idPenugasan: item.id,
        petugasId,
        noBadan: pengguna.no_badan || "-",
        pangkat: pengguna.pangkat || "-",
        nama: pengguna.nama || "-",
        telefon: pengguna.telefon || "-",
        bahagian:
          pengguna.bahagian ||
          pengguna.balai ||
          pengguna.cawangan ||
          pengguna.unit ||
          pengguna.bahagian_unit ||
          "-",
        deviceId: ikatanDevice?.device_id || "",
        deviceDiikatPada: ikatanDevice?.diikat_pada || null,
        deviceKaliTerakhir: ikatanDevice?.kali_terakhir || null,
        callSign: item.call_sign || "-",
        jenisTugas: item.jenis_tugas || "-",
        tempatTugas: item.tempat_tugas || item.lokasi || "-",
        pemegangSet: nilaiBoolean(item.pemegang_set),
        penyelia: nilaiBoolean(item.penyelia),
        statusKehadiran,
        masaCheckin: checkin?.masa_checkin || null,
        masaCheckout: checkout?.masa_checkout || null,
        tempohMinit: checkout?.tempoh_minit,
        checkin,
        checkout
      };
    });

    if (kemasKiniPenapis) binaPilihanPenapis();
    papar();
    paparMesej(
      "status",
      `${dataDashboard.length} rekod berjaya dimuatkan.`,
      "success"
    );
  } catch (error) {
    console.error("Data dashboard gagal dimuatkan:", error);
    dataDashboard = [];
    papar();
    paparMesej(
      "status",
      `Ralat mendapatkan data: ${escapeHtml(error.message)}`,
      "error"
    );
  }
}

function binaPilihanPenapis() {
  isiPilihan(
    "jenisTugas",
    "SEMUA JENIS TUGAS",
    dataDashboard.map(item => item.jenisTugas)
  );

  isiPilihan(
    "tempatTugas",
    "SEMUA TEMPAT TUGAS",
    dataDashboard.map(item => item.tempatTugas)
  );

  isiPilihan(
    "pangkatPenapis",
    "SEMUA PANGKAT",
    dataDashboard.map(item => item.pangkat)
  );
}

function isiPilihan(id, labelSemua, nilai) {
  const pilih = el(id);
  const nilaiSemasa = pilih.value;
  const unik = [...new Set(nilai.filter(item => item && item !== "-"))]
    .sort((a, b) => a.localeCompare(b, "ms"));

  pilih.innerHTML = `<option value="">${escapeHtml(labelSemua)}</option>` +
    unik.map(item => (
      `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`
    )).join("");

  if (unik.includes(nilaiSemasa)) pilih.value = nilaiSemasa;
}

function papar() {
  const jenis = atas(el("jenisTugas")?.value);
  const tempat = atas(el("tempatTugas")?.value);
  const status = atas(el("statusPenapis")?.value);
  const pangkat = atas(el("pangkatPenapis")?.value);
  const carian = atas(el("carian")?.value);

  dataPaparan = dataDashboard.filter(item => {
    if (jenis && atas(item.jenisTugas) !== jenis) return false;
    if (tempat && atas(item.tempatTugas) !== tempat) return false;
    if (pangkat && atas(item.pangkat) !== pangkat) return false;
     
    if (status) {
      if (status === "CHECK-OUT" && !item.checkout) return false;
      if (status !== "CHECK-OUT" && item.statusKehadiran !== status) return false;
    }

    if (carian) {
      const gabung = atas([
        item.noBadan,
        item.pangkat,
        item.nama,
        item.telefon,
        item.callSign,
        item.jenisTugas,
        item.tempatTugas,
        item.pemegangSet ? "YA" : "TIDAK"
      ].join(" "));

      if (!gabung.includes(carian)) return false;
    }

    return true;
  });

  paparJadual();
  paparStatistik();
}

function paparJadual() {
  const tbody = el("tbody");

  if (!dataPaparan.length) {
    tbody.innerHTML = (
      '<tr><td colspan="15" class="empty-row">' +
      "Tiada rekod yang sepadan.</td></tr>"
    );
    return;
  }

  tbody.innerHTML = dataPaparan.map((item, index) => {
    const kelas = kelasBadge(item.statusKehadiran);
    const keadaan = item.checkout
      ? "SELESAI TUGAS"
      : item.statusKehadiran === "HADIR"
        ? "MASIH BERTUGAS"
        : "-";

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.noBadan)}</td>
        <td>
          <strong>${escapeHtml(item.pangkat)}</strong><br>
          ${escapeHtml(item.nama)}
        </td>
        <td>${escapeHtml(item.telefon)}</td>
        <td>${escapeHtml(item.callSign)}</td>
        <td>${escapeHtml(item.jenisTugas)}</td>
        <td>${escapeHtml(item.tempatTugas)}</td>
        <td>
          <span class="badge ${item.pemegangSet ? "badge-green" : "badge-gray"}">
            ${item.pemegangSet ? "YA" : "TIDAK"}
          </span>
        </td>
        <td>${escapeHtml(formatTarikhMasa(item.masaCheckin))}</td>
        <td><span class="badge ${kelas}">${escapeHtml(item.statusKehadiran)}</span></td>
        <td>${escapeHtml(formatTarikhMasa(item.masaCheckout))}</td>
        <td>${escapeHtml(formatTempoh(item.tempohMinit))}</td>
        <td>${escapeHtml(keadaan)}</td>
        <td>
          <span class="badge ${item.deviceId ? "badge-green" : "badge-gray"}">
            ${item.deviceId ? "BERDAFTAR" : "TIADA"}
          </span>
        </td>
        <td>
          <button
            class="reset-device"
            type="button"
            onclick="bukaModalResetDevice('${escapeHtml(item.petugasId)}')"
          >
            RESET DEVICE
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function kelasBadge(status) {
  if (status === "HADIR") return "badge-green";
  if (status === "MENUNGGU") return "badge-yellow";
  if (status === "DITOLAK" || status === "DIGANTI") return "badge-red";
  return "badge-gray";
}

function paparStatistik() {
  const jumlah = dataPaparan.length;
  const hadir = dataPaparan.filter(item => item.statusKehadiran === "HADIR").length;
  const menunggu = dataPaparan.filter(item => item.statusKehadiran === "MENUNGGU").length;
  const ditolak = dataPaparan.filter(item => item.statusKehadiran === "DITOLAK").length;
  const checkout = dataPaparan.filter(item => Boolean(item.checkout)).length;
  const bertugas = dataPaparan.filter(item => item.statusKehadiran === "HADIR" && !item.checkout).length;
  const belumHadir = dataPaparan.filter(item => item.statusKehadiran === "BELUM HADIR").length;
  const pemegangSet = dataPaparan.filter(item => item.pemegangSet).length;
  const peratus = jumlah ? Math.round((hadir / jumlah) * 100) : 0;

  el("jumlah").textContent = jumlah;
  el("hadir").textContent = hadir;
  el("menunggu").textContent = menunggu;
  el("ditolak").textContent = ditolak;
  el("checkout").textContent = checkout;
  el("bertugas").textContent = bertugas;
  el("belumHadir").textContent = belumHadir;
  el("jumlahPemegangSet").textContent = pemegangSet;
  el("progressPercent").textContent = `${peratus}%`;
  el("progressFill").style.width = `${peratus}%`;
  el("progressText").textContent = `${hadir} / ${jumlah} Petugas Hadir`;
  el("progressTrack").setAttribute("aria-valuenow", String(peratus));
}

/* ================================================================
   EXPORT
================================================================ */

function muatLaporanPdf() {
  window.print();
}

function exportExcel() {
  if (!dataPaparan.length) {
    alert("Tiada data untuk dieksport.");
    return;
  }

  const tajuk = [
    "BIL", "NO BADAN", "PANGKAT", "NAMA", "NO TELEFON", "CALL SIGN",
    "JENIS TUGAS", "TEMPAT TUGAS", "PEMEGANG SET",
    "CHECK-IN", "STATUS", "CHECK-OUT", "TEMPOH"
  ];

  const baris = dataPaparan.map((item, index) => [
    index + 1,
    item.noBadan,
    item.pangkat,
    item.nama,
    item.telefon,
    item.callSign,
    item.jenisTugas,
    item.tempatTugas,
    item.pemegangSet ? "YA" : "TIDAK",
    formatTarikhMasa(item.masaCheckin),
    item.statusKehadiran,
    formatTarikhMasa(item.masaCheckout),
    formatTempoh(item.tempohMinit)
  ]);

  const csv = [tajuk, ...baris]
    .map(item => item.map(csvSelamat).join(","))
    .join("\r\n");

  const fail = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8"
  });

  const pautan = document.createElement("a");
  pautan.href = URL.createObjectURL(fail);
  pautan.download = `SKPO_MOTOGP_${el("tarikh").value || hariIniMalaysia()}.csv`;
  pautan.click();
  URL.revokeObjectURL(pautan.href);
}

function csvSelamat(nilai) {
  const teksNilai = String(nilai ?? "").replace(/"/g, '""');
  return `"${teksNilai}"`;
}

/* ================================================================
   DAFTAR PENGGUNA
================================================================ */

async function daftarPenggunaBaharu() {
  const noBadan = atas(el("penggunaNoBadan").value);
  const pangkat = atas(el("penggunaPangkat").value);
  const nama = atas(el("penggunaNama").value);
  const peranan = atas(el("penggunaPeranan").value);
  const telefon = teks(el("penggunaTelefon").value);
  const bahagian = atas(el("penggunaBahagian").value);
  const daerah = atas(el("penggunaDaerah").value);
  const password = el("penggunaPassword").value;
  const passwordSah = el("penggunaPasswordSah").value;
  const butang = el("btnDaftarPengguna");

  if (!noBadan || !pangkat || !nama || !peranan || !password) {
    paparMesej("statusDaftarPengguna", "Sila lengkapkan semua ruangan wajib.", "error");
    return;
  }

  if (password.length < 8) {
    paparMesej("statusDaftarPengguna", "Kata laluan mestilah sekurang-kurangnya 8 aksara.", "error");
    return;
  }

  if (password !== passwordSah) {
    paparMesej("statusDaftarPengguna", "Pengesahan kata laluan tidak sepadan.", "error");
    return;
  }

  butang.disabled = true;
  butang.textContent = "SEDANG MENDAFTAR...";
  paparMesej("statusDaftarPengguna", "Sedang mencipta akaun...", "warning");

  try {
    const data = await panggilEdgeFunction(
      "tambah-petugas",
      {
        no_badan: noBadan,
        noBadan,
        pangkat,
        nama,
        peranan,
        telefon,
        bahagian,
        daerah,
        password
      }
    );

    if (data?.status === false || data?.success === false) {
      throw new Error(data.mesej || data.message || "Pendaftaran pengguna gagal.");
    }

    paparMesej("statusDaftarPengguna", "Pengguna baharu berjaya didaftarkan.", "success");

    [
      "penggunaNoBadan", "penggunaPangkat", "penggunaNama",
      "penggunaTelefon", "penggunaBahagian", "penggunaDaerah",
      "penggunaPassword", "penggunaPasswordSah"
    ].forEach(id => { el(id).value = ""; });

    el("penggunaPeranan").value = "PETUGAS";
  } catch (error) {
    console.error("Pendaftaran pengguna gagal:", error);
    paparMesej(
      "statusDaftarPengguna",
      `Pendaftaran gagal: ${escapeHtml(error.message)}`,
      "error"
    );
  } finally {
    butang.disabled = false;
    butang.textContent = "DAFTAR PENGGUNA";
  }
}

/* ================================================================
   IMPORT PENGGUNA CSV
================================================================ */

function binaRekodImportPenggunaCsv(barisCsv) {
  if (barisCsv.length < 2) {
    throw new Error("Fail CSV tidak mempunyai rekod pengguna.");
  }

  const alias = {
    NO_BADAN: ["NO_BADAN", "NOBADAN", "NO_POLIS", "BODY_NO"],
    PANGKAT: ["PANGKAT", "RANK"],
    NAMA: ["NAMA", "NAMA_PENUH", "NAME"],
    PERANAN: ["PERANAN", "ROLE"],
    TELEFON: ["TELEFON", "NO_TELEFON", "PHONE"],
    BAHAGIAN: ["BAHAGIAN", "BALAI", "CAWANGAN", "BAHAGIAN_BALAI_CAWANGAN"],
    DAERAH: ["DAERAH", "DISTRICT"],
    KATA_LALUAN: ["KATA_LALUAN", "KATALALUAN", "PASSWORD"],
    AKTIF: ["AKTIF", "ACTIVE"]
  };

  const header = barisCsv[0].map(normalisasiHeaderCsv);
  const indeks = {};
  Object.entries(alias).forEach(([nama, pilihan]) => {
    indeks[nama] = header.findIndex(item => pilihan.includes(item));
  });

  const wajib = ["NO_BADAN", "PANGKAT", "NAMA", "KATA_LALUAN"];
  const tiada = wajib.filter(nama => indeks[nama] < 0);
  if (tiada.length) {
    throw new Error(`Kolum wajib tidak dijumpai: ${tiada.join(", ")}. Gunakan templat pengguna yang disediakan.`);
  }

  const perananSah = ["PETUGAS", "PENYELIA", "URUSETIA", "PENTADBIR", "TSM", "PUSAT_KAWALAN"];
  const ambil = (baris, nama) => indeks[nama] >= 0 ? teks(baris[indeks[nama]]) : "";

  const rekod = barisCsv.slice(1).map((baris, kedudukan) => {
    const nomborBaris = kedudukan + 2;
    const ralat = [];
    const noBadan = atas(ambil(baris, "NO_BADAN"));
    const pangkat = atas(ambil(baris, "PANGKAT"));
    const nama = atas(ambil(baris, "NAMA"));
    const peranan = atas(ambil(baris, "PERANAN") || "PETUGAS");
    const password = ambil(baris, "KATA_LALUAN");
    const aktif = booleanCsv(ambil(baris, "AKTIF"), true);

    if (!noBadan) ralat.push("No Badan kosong");
    if (noBadan && !/^[A-Z0-9_-]+$/.test(noBadan)) {
      ralat.push("No Badan hanya boleh mengandungi huruf, nombor, _ atau -");
    }
    if (!pangkat) ralat.push("Pangkat kosong");
    if (!nama) ralat.push("Nama kosong");
    if (!perananSah.includes(peranan)) ralat.push("Peranan tidak sah");
    if (password.length < 8) ralat.push("Kata laluan kurang daripada 8 aksara");
    if (aktif === null) ralat.push("Aktif mesti YA atau TIDAK");

    return {
      baris: nomborBaris,
      ralat,
      sediaAda: false,
      diimport: false,
      data: {
        baris: nomborBaris,
        no_badan: noBadan,
        pangkat,
        nama,
        peranan,
        telefon: ambil(baris, "TELEFON") || null,
        bahagian: atas(ambil(baris, "BAHAGIAN")) || null,
        daerah: atas(ambil(baris, "DAERAH")) || null,
        password,
        aktif: aktif === true
      }
    };
  });

  const kekerapan = new Map();
  rekod.forEach(item => {
    if (!item.data.no_badan) return;
    kekerapan.set(item.data.no_badan, (kekerapan.get(item.data.no_badan) || 0) + 1);
  });
  rekod.forEach(item => {
    if (kekerapan.get(item.data.no_badan) > 1) {
      item.ralat.push("No Badan berganda dalam fail");
    }
  });

  return rekod;
}

async function semakPenggunaSediaAda(rekod) {
  const noBadan = [...new Set(
    rekod.filter(item => item.ralat.length === 0).map(item => item.data.no_badan)
  )];
  const sediaAda = new Set();

  for (const kumpulan of bahagiKumpulan(noBadan, 100)) {
    const { data, error } = await denganHadMasa(
      db.from("profiles").select("no_badan").in("no_badan", kumpulan)
    );
    if (error) throw error;
    (data || []).forEach(item => sediaAda.add(atas(item.no_badan)));
  }

  rekod.forEach(item => {
    item.sediaAda = sediaAda.has(item.data.no_badan);
    if (item.sediaAda) item.data.password = "";
  });
}

function paparPratontonImportPengguna() {
  const jumlah = rekodImportPengguna.length;
  const baharu = rekodImportPengguna.filter(
    item => item.ralat.length === 0 && !item.sediaAda && !item.diimport
  ).length;
  const siap = rekodImportPengguna.filter(item => item.sediaAda || item.diimport).length;
  const gagal = rekodImportPengguna.filter(item => item.ralat.length > 0).length;

  el("importPenggunaJumlah").textContent = String(jumlah);
  el("importPenggunaBaharu").textContent = String(baharu);
  el("importPenggunaSediaAda").textContent = String(siap);
  el("importPenggunaGagal").textContent = String(gagal);
  el("btnImportPengguna").disabled = baharu === 0 || importPenggunaSedangBerjalan;
  el("ruangPratontonImportPengguna").hidden = jumlah === 0;

  el("tbodyImportPengguna").innerHTML = rekodImportPengguna
    .slice(0, 100)
    .map(item => {
      const d = item.data;
      let semakan = '<span class="badge badge-green">SAH — BAHARU</span>';
      if (item.diimport) semakan = '<span class="badge badge-green">BERJAYA DIIMPORT</span>';
      else if (item.sediaAda) semakan = '<span class="badge badge-gray">SEDIA ADA — DILANGKAU</span>';
      else if (item.ralat.length) {
        semakan = `<span class="badge badge-red" title="${escapeHtml(item.ralat.join("; "))}">RALAT: ${escapeHtml(item.ralat.join("; "))}</span>`;
      }

      return `<tr>
        <td>${item.baris}</td>
        <td>${escapeHtml(d.no_badan || "-")}</td>
        <td>${escapeHtml(d.pangkat || "-")}</td>
        <td>${escapeHtml(d.nama || "-")}</td>
        <td>${escapeHtml(d.peranan || "-")}</td>
        <td>${escapeHtml(d.telefon || "-")}</td>
        <td>${escapeHtml(d.bahagian || "-")}</td>
        <td>${escapeHtml(d.daerah || "-")}</td>
        <td>${d.aktif ? "YA" : "TIDAK"}</td>
        <td>${semakan}</td>
      </tr>`;
    })
    .join("");

  el("notaPratontonImportPengguna").textContent = jumlah > 100
    ? `Memaparkan 100 daripada ${jumlah} baris. Kata laluan disembunyikan.`
    : `Memaparkan semua ${jumlah} baris. Kata laluan disembunyikan.`;
}

async function bacaFailPenggunaCsv(event) {
  const fail = event?.target?.files?.[0];
  if (!fail) return;

  rekodImportPengguna = [];
  el("importPenggunaFail").textContent = fail.name;
  el("btnImportPengguna").disabled = true;
  paparMesej("statusImportPengguna", "Sedang membaca dan menyemak pengguna...", "warning");

  try {
    if (!/\.csv$/i.test(fail.name)) throw new Error("Sila pilih fail berformat .csv.");
    if (fail.size > 5 * 1024 * 1024) throw new Error("Saiz fail melebihi had 5 MB.");

    rekodImportPengguna = binaRekodImportPenggunaCsv(parseCsv(await fail.text()));
    await semakPenggunaSediaAda(rekodImportPengguna);
    paparPratontonImportPengguna();

    const baharu = rekodImportPengguna.filter(
      item => item.ralat.length === 0 && !item.sediaAda
    ).length;
    const sediaAda = rekodImportPengguna.filter(item => item.sediaAda).length;
    const gagal = rekodImportPengguna.filter(item => item.ralat.length > 0).length;

    paparMesej(
      "statusImportPengguna",
      `${baharu} pengguna baharu sedia diimport. ${sediaAda} sedia ada akan dilangkau. ${gagal} baris bermasalah.`,
      gagal ? "warning" : "success"
    );
  } catch (error) {
    console.error("Bacaan CSV pengguna gagal:", error);
    rekodImportPengguna = [];
    paparPratontonImportPengguna();
    paparMesej("statusImportPengguna", escapeHtml(error.message), "error");
  }
}

function kosongkanImportPengguna() {
  if (importPenggunaSedangBerjalan) return;
  rekodImportPengguna = [];
  el("failPenggunaCsv").value = "";
  el("importPenggunaFail").textContent = "-";
  el("statusImportPengguna").className = "status-box";
  el("statusImportPengguna").innerHTML = "";
  paparPratontonImportPengguna();
}

function muatTurunTemplatPengguna() {
  const kandungan = [
    "NO_BADAN,PANGKAT,NAMA,PERANAN,TELEFON,BAHAGIAN,DAERAH,KATA_LALUAN,AKTIF",
    "197898,L/KPL,NORHISHAM BIN CHE MAT,PETUGAS,0193151615,BKDNKA,KLIA,Skpo@A7m2#1,YA",
    "199898,SJN,AHMAD BIN ALI,PENYELIA,0123456789,IPD KLIA,SEPANG,Skpo@B9n4#2,YA",
    "PUSATMGP,INSP,PUSAT KAWALAN MOTOGP,PUSAT_KAWALAN,0123456789,IPK,KUALA LUMPUR,Skpo@MotoGP2026#1,YA"
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", kandungan], { type: "text/csv;charset=utf-8" });
  const pautan = document.createElement("a");
  pautan.href = URL.createObjectURL(blob);
  pautan.download = "TEMPLAT_PENGGUNA_SKPO_MOTOGP.csv";
  document.body.appendChild(pautan);
  pautan.click();
  const alamat = pautan.href;
  pautan.remove();
  setTimeout(() => URL.revokeObjectURL(alamat), 1000);
}

async function importPenggunaCsv() {
  if (importPenggunaSedangBerjalan) return;

  const senarai = rekodImportPengguna.filter(
    item => item.ralat.length === 0 && !item.sediaAda && !item.diimport
  );

  if (!senarai.length) {
    paparMesej(
      "statusImportPengguna",
      "Tiada pengguna baharu yang sah untuk diimport.",
      "error"
    );
    return;
  }

  if (!confirm(
    `Import ${senarai.length} pengguna baharu? ` +
    "Akaun Authentication dan profil pengguna akan dicipta di Supabase."
  )) return;

  importPenggunaSedangBerjalan = true;

  const butang = el("btnImportPengguna");
  butang.disabled = true;

  let diproses = 0;
  let berjaya = 0;
  let sediaAda = 0;
  let gagal = 0;

  const semuaKeputusan = [];

  try {
    /*
      PENTING:
      Pendaftaran manual dalam sistem menggunakan Edge Function
      "tambah-petugas". Import CSV kini menggunakan fungsi yang sama
      supaya Auth user + public.profiles dicipta dengan aliran yang
      sama dan tidak memerlukan Edge Function "import-pengguna".
    */

    for (const item of senarai) {
      const d = item.data;

      butang.textContent =
        `MENGIMPORT ${diproses + 1} / ${senarai.length}...`;

      paparMesej(
        "statusImportPengguna",
        `Sedang mencipta pengguna ${diproses + 1} daripada ${senarai.length}: ` +
        `${escapeHtml(d.no_badan)} — ${escapeHtml(d.nama)}. ` +
        "Jangan tutup halaman ini.",
        "warning"
      );

      try {
        const hasil = await panggilEdgeFunction(
          "tambah-petugas",
          {
            no_badan: d.no_badan,
            noBadan: d.no_badan,
            pangkat: d.pangkat,
            nama: d.nama,
            peranan: d.peranan || "PETUGAS",
            telefon: d.telefon || "",
            bahagian: d.bahagian || "",
            daerah: d.daerah || "",
            password: d.password,
            aktif: d.aktif !== false
          },
          60000
        );

        if (hasil?.status === false || hasil?.success === false) {
          throw new Error(
            hasil?.mesej ||
            hasil?.message ||
            "Pendaftaran pengguna gagal."
          );
        }

        item.diimport = true;
        item.data.password = "";
        berjaya += 1;

        semuaKeputusan.push({
          baris: item.baris,
          no_badan: d.no_badan,
          status: "BERJAYA",
          mesej: "Pengguna berjaya didaftarkan."
        });

      } catch (error) {
        const mesejAsal = String(
          error?.message || "Pendaftaran pengguna gagal."
        );

        /*
          Jika profil sudah wujud / pengguna sudah didaftarkan,
          tandakan sebagai sedia ada dan jangan anggap sebagai
          kegagalan import keseluruhan.
        */
        if (
          /already registered|already exists|duplicate|sedia ada|sudah wujud|telah didaftarkan/i
            .test(mesejAsal)
        ) {
          item.sediaAda = true;
          item.data.password = "";
          sediaAda += 1;

          semuaKeputusan.push({
            baris: item.baris,
            no_badan: d.no_badan,
            status: "SEDIA_ADA",
            mesej: mesejAsal
          });

        } else {
          gagal += 1;

          const mesejPaparan =
            /Edge Function|Failed to send|404/i.test(mesejAsal)
              ? `${mesejAsal} Pastikan Edge Function "tambah-petugas" telah dideploy dan berfungsi.`
              : mesejAsal;

          if (
            !item.ralat.some(ralat =>
              String(ralat).includes(mesejPaparan)
            )
          ) {
            item.ralat.push(`Import: ${mesejPaparan}`);
          }

          semuaKeputusan.push({
            baris: item.baris,
            no_badan: d.no_badan,
            status: "GAGAL",
            mesej: mesejPaparan
          });
        }
      }

      diproses += 1;
      paparPratontonImportPengguna();

      /*
        Jeda kecil antara akaun untuk mengurangkan risiko terlalu
        banyak permintaan Auth dalam masa yang sangat singkat.
      */
      if (diproses < senarai.length) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    /*
      Semak semula table profiles selepas import supaya status sebenar
      di Supabase disahkan sebelum keputusan akhir dipaparkan.
    */
    try {
      await semakPenggunaSediaAda(rekodImportPengguna);

      rekodImportPengguna.forEach(item => {
        if (item.diimport) item.sediaAda = false;
      });

      paparPratontonImportPengguna();
    } catch (semakError) {
      console.warn(
        "Semakan semula profiles selepas import gagal:",
        semakError
      );
    }

    const ralat = semuaKeputusan.filter(
      item => item.status === "GAGAL"
    );

    const butiran = ralat.length
      ? `<br><details><summary>Lihat ${ralat.length} ralat</summary><ul>${
          ralat.slice(0, 100).map(item =>
            `<li>Baris ${escapeHtml(item.baris || "-")} — ` +
            `${escapeHtml(item.no_badan || "-")}: ` +
            `${escapeHtml(item.mesej || "Ralat")}</li>`
          ).join("")
        }</ul></details>`
      : "";

    paparMesej(
      "statusImportPengguna",
      `<strong>IMPORT PENGGUNA SELESAI</strong><br>` +
      `Berjaya: ${berjaya}<br>` +
      `Sedia ada/dilangkau: ${sediaAda}<br>` +
      `Gagal: ${gagal}${butiran}`,
      gagal ? "warning" : "success"
    );

    /*
      Muat semula dashboard jika fungsi tersedia.
    */
    if (berjaya > 0 && typeof muatData === "function") {
      try {
        await muatData(true);
      } catch (errorMuat) {
        console.warn(
          "Pengguna berjaya diimport tetapi dashboard gagal dimuat semula:",
          errorMuat
        );
      }
    }

  } catch (error) {
    console.error("Import pengguna gagal:", error);

    paparMesej(
      "statusImportPengguna",
      `Import gagal: ${escapeHtml(
        error?.message || "Ralat tidak diketahui."
      )}`,
      "error"
    );

  } finally {
    importPenggunaSedangBerjalan = false;
    butang.textContent = "IMPORT PENGGUNA KE SUPABASE";
    paparPratontonImportPengguna();
  }
}

/* ================================================================
   IMPORT PENUGASAN CSV
================================================================ */

function normalisasiHeaderCsv(nilai) {
  return atas(nilai)
    .replace(/^\uFEFF/, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function kesanPemisahCsv(kandungan) {
  const barisPertama = String(kandungan || "").split(/\r?\n/, 1)[0] || "";
  const calon = [",", ";", "\t"];
  let terbaik = ",";
  let jumlahTerbaik = -1;

  calon.forEach(pemisah => {
    let dalamPetikan = false;
    let jumlah = 0;

    for (let i = 0; i < barisPertama.length; i += 1) {
      const aksara = barisPertama[i];
      if (aksara === '"') dalamPetikan = !dalamPetikan;
      if (!dalamPetikan && aksara === pemisah) jumlah += 1;
    }

    if (jumlah > jumlahTerbaik) {
      terbaik = pemisah;
      jumlahTerbaik = jumlah;
    }
  });

  return terbaik;
}

function parseCsv(kandungan) {
  const teksCsv = String(kandungan || "").replace(/^\uFEFF/, "");
  const pemisah = kesanPemisahCsv(teksCsv);
  const baris = [];
  let rekod = [];
  let sel = "";
  let dalamPetikan = false;

  for (let i = 0; i < teksCsv.length; i += 1) {
    const aksara = teksCsv[i];

    if (aksara === '"') {
      if (dalamPetikan && teksCsv[i + 1] === '"') {
        sel += '"';
        i += 1;
      } else {
        dalamPetikan = !dalamPetikan;
      }
      continue;
    }

    if (!dalamPetikan && aksara === pemisah) {
      rekod.push(sel);
      sel = "";
      continue;
    }

    if (!dalamPetikan && (aksara === "\n" || aksara === "\r")) {
      if (aksara === "\r" && teksCsv[i + 1] === "\n") i += 1;
      rekod.push(sel);
      sel = "";

      if (rekod.some(item => teks(item) !== "")) baris.push(rekod);
      rekod = [];
      continue;
    }

    sel += aksara;
  }

  if (dalamPetikan) {
    throw new Error("Terdapat tanda petikan yang tidak ditutup dalam fail CSV.");
  }

  rekod.push(sel);
  if (rekod.some(item => teks(item) !== "")) baris.push(rekod);

  return baris;
}

function tarikhCsv(nilai) {
  const asal = teks(nilai);
  let tahun;
  let bulan;
  let hari;
  let padanan = asal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (padanan) {
    tahun = Number(padanan[1]);
    bulan = Number(padanan[2]);
    hari = Number(padanan[3]);
  } else {
    padanan = asal.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!padanan) return null;
    hari = Number(padanan[1]);
    bulan = Number(padanan[2]);
    tahun = Number(padanan[3]);
  }

  const semakan = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    semakan.getUTCFullYear() !== tahun ||
    semakan.getUTCMonth() !== bulan - 1 ||
    semakan.getUTCDate() !== hari
  ) return null;

  return `${String(tahun).padStart(4, "0")}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

function booleanCsv(nilai, nilaiAsal = false) {
  const bersih = atas(nilai);
  if (!bersih) return nilaiAsal;
  if (["YA", "YES", "Y", "1", "TRUE", "BENAR"].includes(bersih)) return true;
  if (["TIDAK", "NO", "N", "0", "FALSE", "PALSU"].includes(bersih)) return false;
  return null;
}

function nomborCsv(nilai) {
  const bersih = teks(nilai).replace(",", ".");
  if (!bersih) return null;
  const nombor = Number(bersih);
  return Number.isFinite(nombor) ? nombor : null;
}

function binaRekodImportCsv(barisCsv) {
  if (barisCsv.length < 2) {
    throw new Error("Fail CSV tidak mempunyai rekod penugasan.");
  }

  const alias = {
    TARIKH: ["TARIKH", "TARIKH_TUGAS", "DATE"],
    NO_BADAN: ["NO_BADAN", "NOBADAN", "NO_POLIS", "BODY_NO"],
    CALL_SIGN: ["CALL_SIGN", "CALLSIGN"],
    JENIS_TUGAS: ["JENIS_TUGAS", "TUGAS"],
    TEMPAT_TUGAS: ["TEMPAT_TUGAS", "LOKASI", "LOKASI_TUGAS"],
    PENYELIA: ["PENYELIA", "SUPERVISOR"],
    PEMEGANG_SET: ["PEMEGANG_SET", "PEMEGANGSET", "RADIO_HOLDER"],
    LATITUDE: ["LATITUDE", "LAT"],
    LONGITUDE: ["LONGITUDE", "LONG", "LNG"],
    RADIUS_METER: ["RADIUS_METER", "RADIUS", "RADIUS_METERS"],
    STATUS: ["STATUS", "STATUS_PENUGASAN"]
  };

  const header = barisCsv[0].map(normalisasiHeaderCsv);
  const indeks = {};

  Object.entries(alias).forEach(([nama, pilihan]) => {
    indeks[nama] = header.findIndex(item => pilihan.includes(item));
  });

  const wajib = [
    "TARIKH", "NO_BADAN", "JENIS_TUGAS", "TEMPAT_TUGAS",
    "LATITUDE", "LONGITUDE", "RADIUS_METER"
  ];
  const tiada = wajib.filter(nama => indeks[nama] < 0);

  if (tiada.length) {
    throw new Error(`Kolum wajib tidak dijumpai: ${tiada.join(", ")}. Gunakan templat yang disediakan.`);
  }

  const ambil = (baris, nama) => indeks[nama] >= 0 ? teks(baris[indeks[nama]]) : "";
  const rekod = barisCsv.slice(1).map((baris, kedudukan) => {
    const nomborBaris = kedudukan + 2;
    const ralat = [];
    const tarikh = tarikhCsv(ambil(baris, "TARIKH"));
    const noBadan = atas(ambil(baris, "NO_BADAN"));
    const jenisTugas = atas(ambil(baris, "JENIS_TUGAS"));
    const tempatTugas = atas(ambil(baris, "TEMPAT_TUGAS"));
    const penyelia = booleanCsv(ambil(baris, "PENYELIA"), false);
    const pemegangSet = booleanCsv(ambil(baris, "PEMEGANG_SET"), false);
    const latitude = nomborCsv(ambil(baris, "LATITUDE"));
    const longitude = nomborCsv(ambil(baris, "LONGITUDE"));
    const radius = nomborCsv(ambil(baris, "RADIUS_METER"));
    const status = atas(ambil(baris, "STATUS") || "AKTIF");

    if (!tarikh) ralat.push("Tarikh tidak sah");
    if (!noBadan) ralat.push("No Badan kosong");
    if (!jenisTugas) ralat.push("Jenis Tugas kosong");
    if (!tempatTugas) ralat.push("Tempat Tugas kosong");
    if (penyelia === null) ralat.push("Penyelia mesti YA atau TIDAK");
    if (pemegangSet === null) ralat.push("Pemegang Set mesti YA atau TIDAK");
    if (latitude === null || latitude < -90 || latitude > 90) ralat.push("Latitude tidak sah");
    if (longitude === null || longitude < -180 || longitude > 180) ralat.push("Longitude tidak sah");
    if (radius === null || !Number.isInteger(radius) || radius < 1 || radius > 5000) {
      ralat.push("Radius mesti nombor bulat 1 hingga 5000");
    }
    if (!["AKTIF", "DIGANTI"].includes(status)) ralat.push("Status mesti AKTIF atau DIGANTI");

    return {
      baris: nomborBaris,
      ralat,
      data: {
        baris: nomborBaris,
        tarikh,
        no_badan: noBadan,
        call_sign: atas(ambil(baris, "CALL_SIGN")) || null,
        jenis_tugas: jenisTugas,
        tempat_tugas: tempatTugas,
        penyelia: penyelia === true,
        pemegang_set: pemegangSet === true,
        latitude,
        longitude,
        radius_meter: radius,
        status
      }
    };
  });

  const kekerapan = new Map();
  rekod.forEach(item => {
    if (!item.data.tarikh || !item.data.no_badan) return;
    const kunci = `${item.data.tarikh}|${item.data.no_badan}`;
    kekerapan.set(kunci, (kekerapan.get(kunci) || 0) + 1);
  });

  rekod.forEach(item => {
    const kunci = `${item.data.tarikh}|${item.data.no_badan}`;
    if (kekerapan.get(kunci) > 1) item.ralat.push("No Badan dan tarikh berganda dalam fail");
  });

  return rekod;
}

async function semakPetugasUntukImport(rekod) {
  const noBadan = [...new Set(
    rekod.filter(item => item.ralat.length === 0).map(item => item.data.no_badan)
  )];
  const profil = new Map();

  for (const kumpulan of bahagiKumpulan(noBadan, 100)) {
    const { data, error } = await denganHadMasa(
      db.from("profiles").select("no_badan,aktif").in("no_badan", kumpulan)
    );
    if (error) throw error;
    (data || []).forEach(item => profil.set(atas(item.no_badan), item.aktif === true));
  }

  rekod.forEach(item => {
    if (item.ralat.length > 0) return;
    if (!profil.has(item.data.no_badan)) {
      item.ralat.push("No Badan belum didaftarkan");
    } else if (profil.get(item.data.no_badan) !== true) {
      item.ralat.push("Akaun petugas tidak aktif");
    }
  });
}

function paparPratontonImport() {
  const jumlah = rekodImportPenugasan.length;
  const sah = rekodImportPenugasan.filter(item => item.ralat.length === 0).length;
  const gagal = jumlah - sah;

  el("importJumlah").textContent = String(jumlah);
  el("importSah").textContent = String(sah);
  el("importGagal").textContent = String(gagal);
  el("btnImportPenugasan").disabled = sah === 0 || importSedangBerjalan;
  el("ruangPratontonImport").hidden = jumlah === 0;

  el("tbodyImportPenugasan").innerHTML = rekodImportPenugasan
    .slice(0, 100)
    .map(item => {
      const d = item.data;
      const semakan = item.ralat.length
        ? `<span class="badge badge-red" title="${escapeHtml(item.ralat.join("; "))}">RALAT: ${escapeHtml(item.ralat.join("; "))}</span>`
        : '<span class="badge badge-green">SAH</span>';

      return `<tr>
        <td>${item.baris}</td>
        <td>${escapeHtml(d.tarikh || "-")}</td>
        <td>${escapeHtml(d.no_badan || "-")}</td>
        <td>${escapeHtml(d.call_sign || "-")}</td>
        <td>${escapeHtml(d.jenis_tugas || "-")}</td>
        <td>${escapeHtml(d.tempat_tugas || "-")}</td>
        <td>${d.penyelia ? "YA" : "TIDAK"}</td>
        <td>${d.pemegang_set ? "YA" : "TIDAK"}</td>
        <td>${d.latitude ?? "-"}</td>
        <td>${d.longitude ?? "-"}</td>
        <td>${d.radius_meter ?? "-"}</td>
        <td>${semakan}</td>
      </tr>`;
    })
    .join("");

  el("notaPratontonImport").textContent = jumlah > 100
    ? `Memaparkan 100 daripada ${jumlah} baris. Semua baris tetap akan diproses.`
    : `Memaparkan semua ${jumlah} baris.`;
}

async function bacaFailPenugasanCsv(event) {
  const fail = event?.target?.files?.[0];
  if (!fail) return;

  rekodImportPenugasan = [];
  el("importFail").textContent = fail.name;
  el("btnImportPenugasan").disabled = true;
  paparMesej("statusImportPenugasan", "Sedang membaca dan menyemak fail CSV...", "warning");

  try {
    if (!/\.csv$/i.test(fail.name)) throw new Error("Sila pilih fail berformat .csv.");
    if (fail.size > 5 * 1024 * 1024) throw new Error("Saiz fail melebihi had 5 MB.");

    const kandungan = await fail.text();
    rekodImportPenugasan = binaRekodImportCsv(parseCsv(kandungan));
    await semakPetugasUntukImport(rekodImportPenugasan);
    paparPratontonImport();

    const sah = rekodImportPenugasan.filter(item => item.ralat.length === 0).length;
    const gagal = rekodImportPenugasan.length - sah;
    paparMesej(
      "statusImportPenugasan",
      gagal
        ? `${sah} baris sah. ${gagal} baris bermasalah dan tidak akan diimport.`
        : `Semua ${sah} baris sah dan sedia untuk diimport.`,
      gagal ? "warning" : "success"
    );
  } catch (error) {
    console.error("Bacaan CSV gagal:", error);
    rekodImportPenugasan = [];
    paparPratontonImport();
    paparMesej("statusImportPenugasan", escapeHtml(error.message), "error");
  }
}

function kosongkanImportPenugasan() {
  if (importSedangBerjalan) return;
  rekodImportPenugasan = [];
  el("failPenugasanCsv").value = "";
  el("importFail").textContent = "-";
  el("statusImportPenugasan").className = "status-box";
  el("statusImportPenugasan").innerHTML = "";
  paparPratontonImport();
}

function muatTurunTemplatPenugasan() {
  const tarikh = el("tarikh")?.value || hariIniMalaysia();
  const kandungan = [
    "TARIKH,NO_BADAN,CALL_SIGN,JENIS_TUGAS,TEMPAT_TUGAS,PENYELIA,PEMEGANG_SET,LATITUDE,LONGITUDE,RADIUS_METER,STATUS",
    `${tarikh},197898,VCC,URUSETIA,SUBTEK,YA,YA,2.7585826,101.7096481,30,AKTIF`,
    `${tarikh},199898,BRAVO 01,KAWALAN KESELAMATAN,PINTU UTAMA,TIDAK,YA,2.7591000,101.7102000,30,AKTIF`
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", kandungan], { type: "text/csv;charset=utf-8" });
  const pautan = document.createElement("a");
  pautan.href = URL.createObjectURL(blob);
  pautan.download = `TEMPLAT_PENUGASAN_${tarikh}.csv`;
  document.body.appendChild(pautan);
  pautan.click();
  pautan.remove();
  setTimeout(() => URL.revokeObjectURL(pautan.href), 1000);
}

async function importPenugasanCsv() {
  if (importSedangBerjalan) return;

  const sah = rekodImportPenugasan.filter(item => item.ralat.length === 0);
  if (!sah.length) {
    paparMesej("statusImportPenugasan", "Tiada baris sah untuk diimport.", "error");
    return;
  }

  if (!confirm(`Import ${sah.length} rekod penugasan ke Supabase? Rekod tarikh dan No Badan yang sama akan dikemas kini.`)) return;

  importSedangBerjalan = true;
  const butang = el("btnImportPenugasan");
  butang.disabled = true;
  let diproses = 0;
  let berjaya = 0;
  let baharu = 0;
  let dikemasKini = 0;
  let gagal = 0;
  const semuaRalat = [];

  try {
    const kumpulan = bahagiKumpulan(sah, 200);

    for (let i = 0; i < kumpulan.length; i += 1) {
      butang.textContent = `MENGIMPORT ${diproses} / ${sah.length}...`;
      paparMesej(
        "statusImportPenugasan",
        `Sedang memproses kumpulan ${i + 1} daripada ${kumpulan.length}...`,
        "warning"
      );

      const { data, error } = await denganHadMasa(
        db.rpc("import_penugasan_csv", {
          p_rekod: kumpulan[i].map(item => item.data)
        }),
        60000
      );

      if (error) {
        const mesej = `${error.code || ""} ${error.message || ""}`;
        if (/PGRST202|does not exist|schema cache|Could not find/i.test(mesej)) {
          throw new Error("Fungsi import belum dipasang. Jalankan fail 03_import_penugasan_csv.sql dalam Supabase SQL Editor, kemudian cuba semula.");
        }
        throw error;
      }

      const hasil = typeof data === "string" ? JSON.parse(data) : (data || {});
      berjaya += Number(hasil.berjaya || 0);
      baharu += Number(hasil.baharu || 0);
      dikemasKini += Number(hasil.dikemas_kini || 0);
      gagal += Number(hasil.gagal || 0);
      if (Array.isArray(hasil.ralat)) semuaRalat.push(...hasil.ralat);
      diproses += kumpulan[i].length;
    }

    const butiranRalat = semuaRalat.length
      ? `<br><details><summary>Lihat ${semuaRalat.length} ralat import</summary><ul>${semuaRalat.slice(0, 100).map(item => `<li>Baris ${escapeHtml(item.baris || "-")}: ${escapeHtml(item.mesej || "Ralat")}</li>`).join("")}</ul></details>`
      : "";

    paparMesej(
      "statusImportPenugasan",
      `<strong>IMPORT SELESAI</strong><br>Berjaya: ${berjaya} (Baharu: ${baharu}, Dikemas kini: ${dikemasKini})<br>Gagal: ${gagal}${butiranRalat}`,
      gagal ? "warning" : "success"
    );

    if (sah[0]?.data?.tarikh) el("tarikh").value = sah[0].data.tarikh;
    await muatData(true);
  } catch (error) {
    console.error("Import penugasan gagal:", error);
    paparMesej("statusImportPenugasan", `Import gagal: ${escapeHtml(error.message)}`, "error");
  } finally {
    importSedangBerjalan = false;
    butang.textContent = "IMPORT PENUGASAN KE SUPABASE";
    butang.disabled = sah.length === 0;
  }
}

/* ================================================================
   RESET DEVICE
================================================================ */

function bukaModalResetDevice(petugasId) {
  const rekod = dataDashboard.find(item => item.petugasId === petugasId);
  if (!rekod) return;

  rekodResetDevice = rekod;
  el("maklumatResetDevice").innerHTML = `
    <strong>${escapeHtml(rekod.pangkat)} ${escapeHtml(rekod.nama)}</strong><br>
    No Badan: ${escapeHtml(rekod.noBadan)}<br>
    Device ID Terikat: ${escapeHtml(rekod.deviceId || "TIADA")}<br><br>

    <strong>Fungsi Reset:</strong><br>
    Sebarang ikatan peranti petugas ini akan dibuang.
    Rekod Check-In, Check-Out dan status kehadiran akan <strong>DIKEKALKAN</strong>.<br><br>

    Selepas reset, petugas boleh login menggunakan telefon mereka sendiri
    dan telefon tersebut akan didaftarkan sebagai peranti petugas.
  `;
  el("statusModalResetDevice").innerHTML = "";
  el("modalResetDevice").style.display = "block";
}

function tutupModalResetDevice() {
  rekodResetDevice = null;
  el("modalResetDevice").style.display = "none";
}

async function hantarResetDevice() {
  if (!rekodResetDevice) return;

  const butang = el("btnSahkanResetDevice");

  if (!confirm(
    `Sahkan RESET DEVICE untuk ${rekodResetDevice.noBadan}? ` +
    "Rekod Check-In, Check-Out dan status kehadiran akan dikekalkan."
  )) return;

  butang.disabled = true;
  butang.textContent = "SEDANG RESET...";

  try {
    /*
      RPC ini hanya membuang device_bindings petugas.
      Ia TIDAK menyentuh:
      - checkin
      - checkout
      - penugasan
      - device_whitelist / Peranti Khas Admin
    */
    const hasil = await denganHadMasa(
      db.rpc("nyahikat_peranti_petugas", {
        p_no_badan: rekodResetDevice.noBadan
      })
    );

    if (hasil.error) {
      if (/PGRST202|schema cache|does not exist/i.test(
        `${hasil.error.code || ""} ${hasil.error.message || ""}`
      )) {
        throw new Error(
          "Fungsi nyahikat_peranti_petugas belum dipasang atau belum dikemas kini dalam Supabase."
        );
      }

      throw hasil.error;
    }

    if (!hasil.data || hasil.data.success !== true) {
      throw new Error(
        hasil.data?.message ||
        "Reset Device gagal."
      );
    }

    paparMesej(
      "statusModalResetDevice",
      `<strong>RESET DEVICE BERJAYA.</strong><br>` +
      `${escapeHtml(hasil.data.message || "Ikatan peranti telah dibuang.")}<br><br>` +
      `Rekod kehadiran dikekalkan. Petugas kini boleh login menggunakan telefon mereka sendiri.`,
      "success"
    );

    /*
      Kemas kini data tempatan terus supaya butang/status tidak
      bergantung kepada cache lama.
    */
    const idPetugas = rekodResetDevice.petugasId;

    dataDashboard.forEach(item => {
      if (item.petugasId === idPetugas) {
        item.deviceId = "";
        item.deviceDiikatPada = null;
        item.deviceKaliTerakhir = null;
      }
    });

    setTimeout(async () => {
      tutupModalResetDevice();
      await muatData(false);
    }, 1300);

  } catch (error) {
    console.error("Reset Device gagal:", error);

    paparMesej(
      "statusModalResetDevice",
      `Reset Device gagal: ${escapeHtml(error.message)}`,
      "error"
    );

  } finally {
    butang.disabled = false;
    butang.textContent = "SAHKAN RESET DEVICE";
  }
}

/* ================================================================
   NAVIGASI MODUL PENTADBIR
================================================================ */

/*
  Menutup semua modul tambahan supaya hanya satu modul
  dipaparkan pada satu masa.
*/
function tutupSemuaModulPentadbir() {
  const senaraiModul = [
    {
      idModul: "modulPerantiKhasAdmin",
      idKandungan: "",
      idButang: "",
      teksButang: ""
    },
    {
      idModul: "modulImportPengguna",
      idKandungan: "kandunganImportPengguna",
      idButang: "btnToggleImportPengguna",
      teksButang: "PAPARKAN IMPORT"
    },
    {
      idModul: "modulImportPenugasan",
      idKandungan: "kandunganImportPenugasan",
      idButang: "btnToggleImportPenugasan",
      teksButang: "PAPARKAN IMPORT"
    },
    {
      idModul: "modulDaftarPengguna",
      idKandungan: "borangDaftarPengguna",
      idButang: "btnToggleDaftarPengguna",
      teksButang: "PAPARKAN BORANG"
    },
    {
      idModul: "modulLaporanPentadbir",
      idKandungan: "",
      idButang: "",
      teksButang: ""
    },
    {
      idModul: "modulCartaPentadbir",
      idKandungan: "",
      idButang: "btnBukaCartaPentadbir",
      teksButang: "CARTA"
    }
  ];

  senaraiModul.forEach(item => {
    const modul = el(item.idModul);
    const kandungan = el(item.idKandungan);
    const butang = el(item.idButang);

    if (modul) {
      modul.hidden = true;
      modul.setAttribute("hidden", "");
      modul.style.display = "none";
      modul.classList.remove("modul-disorot");
    }

    if (kandungan) {
      kandungan.hidden = true;
      kandungan.setAttribute("hidden", "");
    }

    if (butang) {
      butang.setAttribute("aria-expanded", "false");
      butang.textContent = item.teksButang;
    }
  });
}


/*
  Membuka modul yang dipilih dan membawa paparan
  ke bahagian modul tersebut.
*/
function bukaDanSkrolModul(
  idModul,
  idKandungan,
  idButangToggle,
  teksButangBuka
) {
  const modul = el(idModul);
  const kandungan = el(idKandungan);
  const butangToggle = el(idButangToggle);

  if (!modul) {
    console.error(`Modul tidak ditemui: ${idModul}`);
    alert("Modul tidak ditemui. Sila semak ID modul dalam admin.html.");
    return;
  }

  /*
    Tutup modul lain terlebih dahulu.
  */
  tutupSemuaModulPentadbir();

  /*
    Paparkan section utama.
  */
  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");

  /*
    Paparkan kandungan di dalam section.
  */
  if (kandungan) {
    kandungan.hidden = false;
    kandungan.removeAttribute("hidden");
    kandungan.style.removeProperty("display");
  }

  /*
    Kemas kini butang Paparkan/Sembunyikan.
  */
  if (butangToggle) {
    butangToggle.setAttribute("aria-expanded", "true");
    butangToggle.textContent = teksButangBuka;
  }

  /*
    Beri masa kepada browser untuk melukis modul,
    kemudian scroll ke modul.
  */
  window.setTimeout(() => {
    modul.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest"
    });

    modul.classList.remove("modul-disorot");

    void modul.offsetWidth;

    modul.classList.add("modul-disorot");

    window.setTimeout(() => {
      modul.classList.remove("modul-disorot");
    }, 1800);
  }, 100);
}


function tutupPerantiKhasAdmin() {
  const modul = el("modulPerantiKhasAdmin");
  if (!modul) return;

  modul.hidden = true;
  modul.style.display = "none";
  modul.classList.remove("modul-disorot");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function bukaPerantiKhasAdmin() {
  tutupSemuaModulPentadbir();

  const modul = el("modulPerantiKhasAdmin");
  if (!modul) {
    alert("Modul Peranti Khas Pentadbir tidak dijumpai.");
    return;
  }

  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");
  modul.classList.add("modul-disorot");

  muatPerantiKhasAdmin();

  modul.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function bukaImportPengguna() {
  bukaDanSkrolModul(
    "modulImportPengguna",
    "kandunganImportPengguna",
    "btnToggleImportPengguna",
    "SEMBUNYIKAN IMPORT"
  );
}


function bukaImportPenugasan() {
  bukaDanSkrolModul(
    "modulImportPenugasan",
    "kandunganImportPenugasan",
    "btnToggleImportPenugasan",
    "SEMBUNYIKAN IMPORT"
  );
}


function bukaDaftarPengguna() {
  bukaDanSkrolModul(
    "modulDaftarPengguna",
    "borangDaftarPengguna",
    "btnToggleDaftarPengguna",
    "SEMBUNYIKAN BORANG"
  );
}

function bukaModulLaporanPentadbir() {
  tutupSemuaModulPentadbir();

  const modul = el("modulLaporanPentadbir");
  if (!modul) return;

  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");

  const inputTarikh = el("tarikhLaporanPentadbir");
  if (inputTarikh && !inputTarikh.value) {
    inputTarikh.value = el("tarikh")?.value || hariIniMalaysia();
  }

  tukarTabLaporanPentadbir(tabLaporanAdminAktif, false);
  muatLaporanPentadbir();
  modul.scrollIntoView({ behavior: "smooth", block: "start" });
}

function tutupModulLaporanPentadbir() {
  const modul = el("modulLaporanPentadbir");
  if (!modul) return;
  modul.hidden = true;
  modul.setAttribute("hidden", "");
  modul.style.display = "none";
}


/* ================================================================
   TOGGLE MODUL
================================================================ */

function toggleDaftarPengguna() {
  const modul = el("modulDaftarPengguna");
  const kandungan = el("borangDaftarPengguna");
  const butang = el("btnToggleDaftarPengguna");

  if (!modul || !kandungan || !butang) return;

  const sedangTerbuka = !kandungan.hidden;

  if (sedangTerbuka) {
    kandungan.hidden = true;
    kandungan.setAttribute("hidden", "");

    modul.hidden = true;
    modul.setAttribute("hidden", "");
    modul.style.display = "none";

    butang.setAttribute("aria-expanded", "false");
    butang.textContent = "PAPARKAN BORANG";
  } else {
    modul.hidden = false;
    modul.removeAttribute("hidden");
    modul.style.removeProperty("display");

    kandungan.hidden = false;
    kandungan.removeAttribute("hidden");

    butang.setAttribute("aria-expanded", "true");
    butang.textContent = "SEMBUNYIKAN BORANG";
  }
}


function toggleBahagianImport(
  idModul,
  idKandungan,
  idButang
) {
  const modul = el(idModul);
  const kandungan = el(idKandungan);
  const butang = el(idButang);

  if (!modul || !kandungan || !butang) return;

  const sedangTerbuka = !kandungan.hidden;

  if (sedangTerbuka) {
    kandungan.hidden = true;
    kandungan.setAttribute("hidden", "");

    modul.hidden = true;
    modul.setAttribute("hidden", "");
    modul.style.display = "none";

    butang.setAttribute("aria-expanded", "false");
    butang.textContent = "PAPARKAN IMPORT";
  } else {
    modul.hidden = false;
    modul.removeAttribute("hidden");
    modul.style.removeProperty("display");

    kandungan.hidden = false;
    kandungan.removeAttribute("hidden");

    butang.setAttribute("aria-expanded", "true");
    butang.textContent = "SEMBUNYIKAN IMPORT";
  }
}


function toggleImportPengguna() {
  toggleBahagianImport(
    "modulImportPengguna",
    "kandunganImportPengguna",
    "btnToggleImportPengguna"
  );
}


function toggleImportPenugasan() {
  toggleBahagianImport(
    "modulImportPenugasan",
    "kandunganImportPenugasan",
    "btnToggleImportPenugasan"
  );
}

/* ================================================================
   MODUL LAPORAN PENTADBIR
================================================================ */

function tukarTabLaporanPentadbir(tab, perluPapar = true) {
  tabLaporanAdminAktif = tab === "sitrep" ? "sitrep" : "petugas";

  const petugasAktif = tabLaporanAdminAktif === "petugas";
  const tabPetugas = el("tabAdminLaporanPetugas");
  const tabSitrep = el("tabAdminSitrep");

  tabPetugas?.classList.toggle("active", petugasAktif);
  tabSitrep?.classList.toggle("active", !petugasAktif);
  tabPetugas?.setAttribute("aria-selected", String(petugasAktif));
  tabSitrep?.setAttribute("aria-selected", String(!petugasAktif));

  if (el("panelAdminLaporanPetugas")) {
    el("panelAdminLaporanPetugas").hidden = !petugasAktif;
  }
  if (el("panelAdminSitrep")) {
    el("panelAdminSitrep").hidden = petugasAktif;
  }

  if (perluPapar) paparLaporanPentadbir();
}

function tarikhMalaysiaDaripadaMasa(nilai) {
  if (!nilai) return "";
  const masa = new Date(nilai);
  if (Number.isNaN(masa.getTime())) return teks(nilai).slice(0, 10);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(masa);
}

function formatMasaLaporanAdmin(nilai) {
  if (!nilai) return "-";
  const masa = new Date(nilai);
  if (Number.isNaN(masa.getTime())) return teks(nilai) || "-";

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(masa);
}

async function muatLaporanPentadbir() {
  const tarikh = el("tarikhLaporanPentadbir")?.value || hariIniMalaysia();
  const status = el("statusLaporanPentadbir");

  if (status) {
    status.className = "status warning";
    status.textContent = "Sedang mendapatkan laporan...";
  }

  try {
    const [laporanRes, sitrepRes, profilRes, tugasRes] = await Promise.all([
      db.from("pelaporan")
        .select("*")
        .order("tarikh_masa", { ascending: false })
        .limit(500),
      db.from("sitrep")
        .select("*")
        .eq("tarikh", tarikh)
        .order("created_at", { ascending: false })
        .limit(500),
      db.from("profiles")
        .select("id,no_badan,pangkat,nama")
        .limit(2000),
      db.from("penugasan")
        .select("*")
        .eq("tarikh", tarikh)
        .limit(2000)
    ]);

    if (laporanRes.error) throw laporanRes.error;
    if (sitrepRes.error) throw sitrepRes.error;
    if (profilRes.error) throw profilRes.error;
    if (tugasRes.error) throw tugasRes.error;

    const profilMap = new Map((profilRes.data || []).map(item => [item.id, item]));
    const tugasMap = new Map((tugasRes.data || []).map(item => [item.id, item]));

    dataLaporanPetugasAdmin = (laporanRes.data || [])
      .filter(item => {
        const sudahDibaca = item.dibaca === true || Boolean(item.dibaca_pada);
        return sudahDibaca && tarikhMalaysiaDaripadaMasa(item.tarikh_masa) === tarikh;
      })
      .map(item => ({
        ...item,
        profil: profilMap.get(item.petugas_id) || null,
        penugasan: tugasMap.get(item.penugasan_id) || null
      }));

    dataSitrepAdmin = (sitrepRes.data || []).map(item => ({
      ...item,
      profil: profilMap.get(item.pengirim_id || item.dicipta_oleh || item.profile_id) || null
    }));

    if (status) {
      status.className = "status success";
      status.textContent =
        `${dataLaporanPetugasAdmin.length} laporan telah dibaca dan ` +
        `${dataSitrepAdmin.length} rekod SITREP ditemui.`;
    }

    paparLaporanPentadbir();
  } catch (error) {
    console.error("Muat laporan Pentadbir gagal:", error);
    dataLaporanPetugasAdmin = [];
    dataSitrepAdmin = [];

    if (status) {
      status.className = "status error";
      status.textContent = `Laporan gagal dimuatkan: ${error.message || "Ralat tidak diketahui."}`;
    }
    paparLaporanPentadbir();
  }
}

function paparLaporanPentadbir() {
  const carian = atas(el("carianLaporanPentadbir")?.value);
  const tbodyLaporan = el("tbodyLaporanPetugasAdmin");
  const tbodySitrep = el("tbodySitrepAdmin");

  const laporanDitapis = dataLaporanPetugasAdmin.filter(item => {
    const profil = item.profil || {};
    const tugasItem = item.penugasan || {};
    return !carian || atas([
      profil.no_badan, profil.pangkat, profil.nama,
      tugasItem.call_sign, tugasItem.tempat_tugas, tugasItem.lokasi,
      item.vvip_vip, item.perkara_menarik
    ].join(" ")).includes(carian);
  });

  if (tbodyLaporan) {
    tbodyLaporan.innerHTML = laporanDitapis.length
      ? laporanDitapis.map((item, index) => {
          const profil = item.profil || {};
          const tugasItem = item.penugasan || {};
          const nama = [profil.pangkat, profil.nama].filter(Boolean).join(" ") || "-";
          const lokasi = tugasItem.call_sign || tugasItem.tempat_tugas || tugasItem.lokasi || "-";
          return `
            <tr>
              <td>${index + 1}</td>
              <td><strong>${escapeHtml(nama)}</strong><br>${escapeHtml(profil.no_badan || "-")}</td>
              <td>${escapeHtml(lokasi)}</td>
              <td>${escapeHtml(formatMasaLaporanAdmin(item.tarikh_masa))}</td>
              <td><button class="gray compact-print" type="button" onclick="cetakLaporanPetugasAdmin('${escapeHtml(item.id)}')">CETAK</button></td>
            </tr>`;
        }).join("")
      : '<tr><td colspan="5" class="empty-row">Tiada laporan yang telah dibaca untuk tarikh ini.</td></tr>';
  }

  const sitrepDitapis = dataSitrepAdmin.filter(item => {
    const profil = item.profil || {};
    return !carian || atas([
      item.tajuk, item.musuh, item.kedudukan, item.tugas, item.tadbir,
      item.perancangan_hadapan, item.kekuatan, item.pegawai_pemerintah_medan,
      item.keselamatan, item.keutamaan, profil.nama, profil.no_badan
    ].join(" ")).includes(carian);
  });

  if (tbodySitrep) {
    tbodySitrep.innerHTML = sitrepDitapis.length
      ? sitrepDitapis.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.tadbir || "-")}</td>
            <td>${escapeHtml(formatMasaLaporanAdmin(item.created_at || item.tarikh_masa))}</td>
            <td>
              <div
                style="
                  display:grid;
                  grid-template-columns:190px 130px;
                  gap:8px;
                  justify-content:center;
                  align-items:center;
                  width:100%;
                "
              >
                ${
                  item.lampiran_path
                    ? `
                      <button
                        class="compact-print"
                        type="button"
                        style="
                          width:190px;
                          min-width:190px;
                          max-width:190px;
                          height:42px;
                          min-height:42px;
                          max-height:42px;
                          margin:0;
                          padding:0 14px;
                          background:#2e7d32;
                          color:#ffffff;
                          border:0;
                          border-radius:8px;
                          font-weight:700;
                          box-sizing:border-box;
                        "
                        onclick="muatTurunLampiranSitrepAdmin(
                          '${escapeHtml(item.lampiran_path)}',
                          '${escapeHtml(item.lampiran_nama || "lampiran")}'
                        )"
                      >
                        MUAT TURUN LAMPIRAN
                      </button>
                    `
                    : ""
                }

                <button
                  class="gray compact-print"
                  type="button"
                  style="
                    width:130px;
                    min-width:130px;
                    max-width:130px;
                    height:42px;
                    min-height:42px;
                    max-height:42px;
                    margin:0;
                    box-sizing:border-box;
                  "
                  onclick="cetakSitrepAdmin('${escapeHtml(item.id)}')"
                >
                  CETAK
                </button>
              </div>
            </td>
          </tr>`).join("")
      : '<tr><td colspan="4" class="empty-row">Tiada rekod SITREP untuk tarikh ini.</td></tr>';

    const jadualSitrep = tbodySitrep.closest("table");

    if (jadualSitrep) {
      const kepala = jadualSitrep.querySelectorAll("thead th");

      if (kepala[2]) {
        kepala[2].style.textAlign = "center";
        kepala[2].style.width = "220px";
      }

      if (kepala[3]) {
        kepala[3].style.textAlign = "center";
        kepala[3].style.width = "340px";
      }

      jadualSitrep
        .querySelectorAll("tbody td:nth-child(3)")
        .forEach(td => {
          td.style.textAlign = "center";
          td.style.verticalAlign = "middle";
          td.style.whiteSpace = "nowrap";
        });

      jadualSitrep
        .querySelectorAll("tbody td:nth-child(4)")
        .forEach(td => {
          td.style.textAlign = "center";
          td.style.verticalAlign = "middle";
          td.style.width = "340px";
        });
    }
  }
}

function bukaCetakanAdmin(tajuk, kandungan) {
  const tetingkap = window.open("", "_blank", "width=900,height=700");
  if (!tetingkap) {
    alert("Paparan cetak disekat oleh pelayar. Benarkan pop-up dan cuba semula.");
    return;
  }

  tetingkap.document.write(`<!doctype html>
    <html lang="ms"><head><meta charset="utf-8"><title>${escapeHtml(tajuk)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;margin:32px;line-height:1.5}
      h1{font-size:22px;text-align:center;margin:0 0 8px}
      .subtitle{text-align:center;margin:0 0 24px;color:#444}
      .meta{border:1px solid #bbb;padding:12px;margin-bottom:18px}
      .field{margin:0 0 14px;page-break-inside:avoid;white-space:pre-wrap}
      .field strong{display:block;margin-bottom:4px}
      .attachment{max-width:100%;max-height:520px}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${escapeHtml(tajuk)}</h1>
    <p class="subtitle">SKPO MOTOGP</p>
    ${kandungan}
    <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script>
    </body></html>`);
  tetingkap.document.close();
}

function normalisasiJenisTugasCetakAdmin(nilai) {
  const jenis = atas(nilai)
    .replace(/\s+/g, " ")
    .trim();

  if (jenis.includes("KAWALAN KESELAMATAN")) {
    return "KAWALAN KESELAMATAN";
  }

  if (
    jenis.includes("KAWALAN LALULINTAS") ||
    jenis.includes("KAWALAN LALU LINTAS")
  ) {
    return "KAWALAN LALULINTAS";
  }

  if (jenis.includes("RONDAAN PENCEGAHAN JENAYAH NARKOTIK")) {
    return "RONDAAN PENCEGAHAN JENAYAH NARKOTIK";
  }

  if (jenis.includes("RONDAAN PENCEGAHAN JENAYAH KOMERSIL")) {
    return "RONDAAN PENCEGAHAN JENAYAH KOMERSIL";
  }

  if (jenis.includes("RONDAAN PENCEGAHAN JENAYAH")) {
    return "RONDAAN PENCEGAHAN JENAYAH";
  }

  if (jenis.includes("BALAI POLIS BERGERAK")) {
    return "BALAI POLIS BERGERAK";
  }

  if (jenis.includes("PONDOK POLIS")) {
    return "PONDOK POLIS";
  }

  if (
    jenis.includes("UNIT PEMUSNAH BOM") ||
    jenis === "UPB"
  ) {
    return "UNIT PEMUSNAH BOM";
  }

  return jenis;
}


function nilaiAdaTiadaCetakAdmin(objek) {
  if (!objek || typeof objek !== "object") {
    return teks(objek) || "TIADA";
  }

  const status = atas(objek.status);
  const butiran = teks(objek.butiran);

  if (status === "ADA") {
    return butiran || "ADA";
  }

  return "TIADA";
}


function medanDinamikCetakLaporanAdmin(item) {
  const tugasItem = item.penugasan || {};

  const jenis = normalisasiJenisTugasCetakAdmin(
    item.jenis_tugas ||
    tugasItem.jenis_tugas ||
    "-"
  );

  const data =
    item.data_laporan &&
    typeof item.data_laporan === "object"
      ? item.data_laporan
      : {};

  /*
    Laporan lama: kekalkan paparan asal jika data_laporan kosong.
  */
  if (!Object.keys(data).length) {
    return [
      ["Jumlah Pengunjung", item.jumlah_pengunjung ?? "-"],
      ["Jumlah Kenderaan", item.jumlah_kenderaan ?? "-"],
      ["VVIP / VIP", item.vvip_vip || "TIADA"],
      ["Perkara Menarik", item.perkara_menarik || "TIADA"]
    ];
  }


  if (jenis === "KAWALAN KESELAMATAN") {
    const kenderaan =
      data.kenderaan &&
      typeof data.kenderaan === "object"
        ? data.kenderaan
        : {};

    return [
      ["Keadaan Keselamatan", data.keadaan_keselamatan || "-"],
      ["Jumlah Pengunjung", data.jumlah_pengunjung ?? item.jumlah_pengunjung ?? 0],
      ["Jumlah Kenderaan", kenderaan.jumlah ?? item.jumlah_kenderaan ?? 0],
      ["Bas", kenderaan.bas ?? 0],
      ["Motosikal", kenderaan.motosikal ?? 0],
      ["Motokar", kenderaan.motokar ?? 0],
      ["VVIP / VIP", nilaiAdaTiadaCetakAdmin(data.vvip_vip)],
      ["Catatan", data.catatan || item.perkara_menarik || "TIADA"]
    ];
  }


  if (jenis === "KAWALAN LALULINTAS") {
    return [
      ["Keadaan Trafik", data.keadaan_trafik || "-"],
      ["Jumlah Kenderaan", data.jumlah_kenderaan ?? item.jumlah_kenderaan ?? 0],
      ["Kemalangan", nilaiAdaTiadaCetakAdmin(data.kemalangan)],
      ["Catatan / Tindakan", data.catatan_tindakan || item.perkara_menarik || "TIADA"]
    ];
  }


  if (
    jenis === "RONDAAN PENCEGAHAN JENAYAH" ||
    jenis === "RONDAAN PENCEGAHAN JENAYAH NARKOTIK" ||
    jenis === "RONDAAN PENCEGAHAN JENAYAH KOMERSIL"
  ) {
    const pemeriksaan =
      data.pemeriksaan &&
      typeof data.pemeriksaan === "object"
        ? data.pemeriksaan
        : {};

    return [
      ["Lokasi Rondaan", data.lokasi_rondaan || "-"],
      ["Jumlah Pemeriksaan", pemeriksaan.jumlah ?? 0],
      ["Lelaki", pemeriksaan.lelaki ?? 0],
      ["Perempuan", pemeriksaan.perempuan ?? 0],
      ["Tangkapan", nilaiAdaTiadaCetakAdmin(data.tangkapan)],
      ["Rampasan", nilaiAdaTiadaCetakAdmin(data.rampasan)],
      ["Catatan / No. Repot", data.catatan_no_repot || item.perkara_menarik || "TIADA"]
    ];
  }


  if (
    jenis === "BALAI POLIS BERGERAK" ||
    jenis === "PONDOK POLIS"
  ) {
    return [
      ["No. Repot", data.no_repot || "TIADA"],
      ["Catatan", data.catatan || item.perkara_menarik || "TIADA"]
    ];
  }


  if (jenis === "UNIT PEMUSNAH BOM") {
    return [
      ["Lokasi", data.lokasi || "-"],
      ["VVIP / VIP", nilaiAdaTiadaCetakAdmin(data.vvip_vip)],
      ["Jenis Ancaman", nilaiAdaTiadaCetakAdmin(data.jenis_ancaman)],
      ["Catatan", data.catatan || item.perkara_menarik || "TIADA"]
    ];
  }


  return [
    ["Jumlah Pengunjung", item.jumlah_pengunjung ?? "-"],
    ["Jumlah Kenderaan", item.jumlah_kenderaan ?? "-"],
    ["VVIP / VIP", item.vvip_vip || "TIADA"],
    ["Perkara Menarik", item.perkara_menarik || "TIADA"]
  ];
}


function cetakLaporanPetugasAdmin(id) {
  const item = dataLaporanPetugasAdmin.find(
    rekod => String(rekod.id) === String(id)
  );

  if (!item) {
    return alert("Rekod laporan tidak ditemui.");
  }

  const profil = item.profil || {};
  const tugasItem = item.penugasan || {};

  const nama =
    [profil.pangkat, profil.nama]
      .filter(Boolean)
      .join(" ") || "-";

  const jenisTugas =
    item.jenis_tugas ||
    tugasItem.jenis_tugas ||
    "-";

  const medan = [
    ["Petugas", nama],
    ["No Badan", profil.no_badan || "-"],
    ["Call Sign", tugasItem.call_sign || "-"],
    ["Jenis Tugas", jenisTugas],
    ["Tempat Tugas", tugasItem.tempat_tugas || tugasItem.lokasi || "-"],
    ["Tarikh / Masa", formatMasaLaporanAdmin(item.tarikh_masa)],

    ...medanDinamikCetakLaporanAdmin(item),

    ["Dibaca Pada", formatMasaLaporanAdmin(item.dibaca_pada)]
  ];

  bukaCetakanAdmin(
    "LAPORAN PETUGAS",
    medan.map(([label, nilai]) =>
      `<div class="field">` +
        `<strong>${escapeHtml(label)}</strong>` +
        `${escapeHtml(nilai ?? "-")}` +
      `</div>`
    ).join("")
  );
}



async function muatTurunLampiranSitrepAdmin(laluan, namaFail = "lampiran") {
  if (!laluan) {
    alert("Lampiran SITREP tidak ditemui.");
    return;
  }

  try {
    const { data, error } = await db.storage
      .from(BUCKET_SITREP_ADMIN)
      .download(laluan);

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Fail lampiran tidak ditemui.");
    }

    const url = URL.createObjectURL(data);
    const pautan = document.createElement("a");

    pautan.href = url;
    pautan.download = namaFail || "lampiran";
    pautan.style.display = "none";

    document.body.appendChild(pautan);
    pautan.click();
    pautan.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);

  } catch (error) {
    console.error("Muat turun lampiran SITREP Admin gagal:", error);

    alert(
      "Lampiran gagal dimuat turun: " +
      (error.message || "Ralat tidak diketahui.")
    );
  }
}


function cetakSitrepAdmin(id) {
  const item = dataSitrepAdmin.find(rekod => String(rekod.id) === String(id));
  if (!item) return alert("Rekod SITREP tidak ditemui.");

  const profil = item.profil || {};
  const medan = [
    ["1. Tajuk", item.tajuk],
    ["2. Musuh", item.musuh],
    ["3. Kedudukan", item.kedudukan],
    ["4. Tugas", item.tugas],
    ["5. Tadbir", item.tadbir],
    ["6. Perancangan Hadapan", item.perancangan_hadapan],
    ["7. Kekuatan", item.kekuatan],
    ["8. Pegawai Pemerintah Medan", item.pegawai_pemerintah_medan],
    ["9. Keselamatan", item.keselamatan],
    ["10. Keutamaan", item.keutamaan],
    ["11. Lampiran", item.lampiran_url || item.lampiran_nama || "TIADA"]
  ];

  const pengirim = [profil.pangkat, profil.nama].filter(Boolean).join(" ") || item.pengirim_nama || "-";
  const meta = `
    <div class="meta">
      <strong>Pengirim:</strong> ${escapeHtml(pengirim)}
      &nbsp; | &nbsp; <strong>No Badan:</strong> ${escapeHtml(profil.no_badan || item.pengirim_no_badan || "-")}
      <br><strong>Masa dihantar:</strong> ${escapeHtml(formatMasaLaporanAdmin(item.created_at || item.tarikh_masa))}
    </div>`;

  bukaCetakanAdmin("SITUATION REPORT (SITREP)", meta + medan.map(([label, nilai]) => {
    const teksNilai = nilai || "-";
    const lampiranImej = label.startsWith("11.") && /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(teksNilai)
      ? `<br><img class="attachment" src="${escapeHtml(teksNilai)}" alt="Lampiran SITREP">`
      : "";
    return `<div class="field"><strong>${escapeHtml(label)}</strong>${escapeHtml(teksNilai)}${lampiranImej}</div>`;
  }).join(""));
}


/* ================================================================
   PERMULAAN HALAMAN
================================================================ */


/* ================================================================
   CARTA OPERASI PENTADBIR
================================================================ */

function nomborCarta(nilai, fallback = 0) {
  const nombor = Number(nilai);
  return Number.isFinite(nombor) ? nombor : fallback;
}


function dataLaporanCarta(item) {
  return item?.data_laporan &&
    typeof item.data_laporan === "object" &&
    !Array.isArray(item.data_laporan)
      ? item.data_laporan
      : {};
}


function jenisTugasCarta(item) {
  return atas(
    item?.jenis_tugas ||
    item?.penugasan?.jenis_tugas ||
    ""
  );
}


function nilaiAdaCarta(nilai) {
  if (nilai === null || nilai === undefined) return false;

  if (typeof nilai === "object") {
    if (Array.isArray(nilai)) {
      return nilai.some(item => nilaiAdaCarta(item));
    }

    if ("ada" in nilai) {
      return nilaiBoolean(nilai.ada);
    }

    if ("status" in nilai) {
      const status = atas(nilai.status);
      if (["TIADA", "TIDAK", "NONE", "FALSE", "0", "-"].includes(status)) {
        return false;
      }
    }

    return Object.values(nilai).some(item => nilaiAdaCarta(item));
  }

  const teksNilai = atas(nilai);

  return Boolean(
    teksNilai &&
    ![
      "TIADA",
      "TIDAK",
      "NONE",
      "N/A",
      "NA",
      "NIL",
      "-",
      "0",
      "FALSE"
    ].includes(teksNilai)
  );
}


function teksNilaiCarta(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") {
    return "";
  }

  if (Array.isArray(nilai)) {
    return nilai
      .map(item => teksNilaiCarta(item))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof nilai === "object") {
    const calon =
      nilai.nama ||
      nilai.butiran ||
      nilai.catatan ||
      nilai.keterangan ||
      nilai.nilai ||
      nilai.teks;

    if (calon) {
      return teksNilaiCarta(calon);
    }

    return Object.entries(nilai)
      .filter(([kunci]) => !["ada", "status"].includes(kunci))
      .map(([kunci, value]) => `${kunci}: ${teksNilaiCarta(value)}`)
      .filter(item => !item.endsWith(": "))
      .join("\n");
  }

  return teks(nilai);
}


function masaCartaLabel(nilai) {
  if (!nilai) return "-";

  const tarikh = new Date(nilai);

  if (Number.isNaN(tarikh.getTime())) {
    return teks(nilai);
  }

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(tarikh);
}


function kemusnahkanCartaPentadbir(carta) {
  if (carta && typeof carta.destroy === "function") {
    carta.destroy();
  }
}


function pastikanChartJsPentadbir() {
  if (typeof window.Chart !== "function") {
    throw new Error(
      "Chart.js tidak dimuatkan. Pastikan script Chart.js berada sebelum js/admin.js dalam admin.html."
    );
  }
}


function bukaModulCartaPentadbir() {
  tutupSemuaModulPentadbir();

  const modul = el("modulCartaPentadbir");

  if (!modul) {
    alert(
      "Modul CARTA belum terdapat dalam admin.html. Gunakan admin.html yang telah ditambah Modul Carta."
    );
    return;
  }

  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");

  const butang = el("btnBukaCartaPentadbir");
  if (butang) {
    butang.setAttribute("aria-expanded", "true");
  }

  const inputTarikh = el("tarikhCartaPentadbir");

  if (inputTarikh && !inputTarikh.value) {
    inputTarikh.value =
      el("tarikh")?.value ||
      hariIniMalaysia();
  }

  muatDataCartaPentadbir();

  setTimeout(() => {
    modul.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 40);
}


function tutupModulCartaPentadbir() {
  const modul = el("modulCartaPentadbir");

  if (!modul) return;

  modul.hidden = true;
  modul.setAttribute("hidden", "");
  modul.style.display = "none";

  const butang = el("btnBukaCartaPentadbir");

  if (butang) {
    butang.setAttribute("aria-expanded", "false");
  }
}


async function muatDataCartaPentadbir() {
  if (!adminLogin) return;

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  if (el("tarikhCartaPentadbir")) {
    el("tarikhCartaPentadbir").value = tarikh;
  }

  paparMesej(
    "statusCartaPentadbir",
    "Sedang menyediakan carta operasi...",
    "warning"
  );

  try {
    /*
      Dashboard petugas digunakan oleh Carta Kehadiran dan Peta.
      Jika tarikh carta berbeza daripada dashboard semasa,
      muat semula dashboard untuk tarikh tersebut.
    */
    if (el("tarikh")) {
      const tarikhDashboard = el("tarikh").value;

      if (tarikhDashboard !== tarikh) {
        el("tarikh").value = tarikh;
        await muatData(true);
      } else if (!dataDashboard.length) {
        await muatData(true);
      }
    }

    const laporanRes = await denganHadMasa(
      db.from("pelaporan")
        .select("*")
        .order("tarikh_masa", { ascending: true })
        .limit(1000)
    );

    if (laporanRes.error) {
      throw laporanRes.error;
    }

    dataCartaLaporanPentadbir =
      (laporanRes.data || [])
        .filter(item =>
          tarikhMalaysiaDaripadaMasa(item.tarikh_masa) === tarikh
        );

    await Promise.all([
      muatJawatankuasaOperasiPentadbir(
        tarikh,
        false
      ),
      muatVvipVipOperasiPentadbir(
        tarikh,
        false
      )
    ]);

    paparRingkasanCartaPentadbir();
    paparCartaPengunjungPentadbir();
    paparCartaKenderaanPentadbir();
    paparCartaKehadiranPentadbir();
    paparCartaInsidenPentadbir();
    paparCartaVvipVipPentadbir();
    paparCartaJawatankuasaPentadbir();

    muatPetaCartaPentadbir();
    paparKronologiPentadbir();

    paparMesej(
      "statusCartaPentadbir",
      `${dataCartaLaporanPentadbir.length} laporan dan ${dataDashboard.length} rekod penugasan diproses untuk carta.`,
      "success"
    );

  } catch (error) {
    console.error(
      "Muat Carta Pentadbir gagal:",
      error
    );

    paparMesej(
      "statusCartaPentadbir",
      `Ralat memuatkan carta: ${escapeHtml(error.message || "Ralat tidak diketahui.")}`,
      "error"
    );
  }
}


function laporanKeselamatanCarta() {
  return dataCartaLaporanPentadbir.filter(
    item => jenisTugasCarta(item) === "KAWALAN KESELAMATAN"
  );
}


function laporanTerkiniKeselamatanCarta() {
  const senarai = laporanKeselamatanCarta();

  return senarai.length
    ? senarai[senarai.length - 1]
    : null;
}


function jumlahPengunjungSemasaCarta() {
  const item = laporanTerkiniKeselamatanCarta();

  if (!item) return 0;

  const data = dataLaporanCarta(item);

  return nomborCarta(
    data.jumlah_pengunjung ??
    item.jumlah_pengunjung,
    0
  );
}


function pecahanKenderaanSemasaCarta() {
  const item = laporanTerkiniKeselamatanCarta();

  if (!item) {
    return {
      bas: 0,
      motosikal: 0,
      motokar: 0,
      jumlah: 0
    };
  }

  const data = dataLaporanCarta(item);

  const kenderaan =
    data.kenderaan &&
    typeof data.kenderaan === "object"
      ? data.kenderaan
      : {};

  const bas = nomborCarta(kenderaan.bas, 0);
  const motosikal = nomborCarta(kenderaan.motosikal, 0);
  const motokar = nomborCarta(kenderaan.motokar, 0);

  const jumlah =
    nomborCarta(
      kenderaan.jumlah ??
      item.jumlah_kenderaan,
      bas + motosikal + motokar
    );

  return {
    bas,
    motosikal,
    motokar,
    jumlah
  };
}



function rekodPetugasVvipVipPentadbir(item) {
  const penugasanId =
    item?.penugasan_id ||
    item?.tugas_id ||
    "";

  if (penugasanId) {
    const ikutPenugasan =
      dataDashboard.find(
        rekod =>
          teks(rekod.idPenugasan) ===
          teks(penugasanId)
      );

    if (ikutPenugasan) {
      return ikutPenugasan;
    }
  }

  const petugasId =
    item?.petugas_id ||
    item?.profile_id ||
    "";

  if (petugasId) {
    const ikutPetugas =
      dataDashboard.find(
        rekod =>
          teks(rekod.petugasId) ===
          teks(petugasId)
      );

    if (ikutPetugas) {
      return ikutPetugas;
    }
  }

  return null;
}


function kumpulanVvipVipCarta() {
  const hasil = [];

  /*
    A. Rekod daripada laporan petugas
  */
  dataCartaLaporanPentadbir.forEach(item => {
    const data = dataLaporanCarta(item);

    const petugas =
      rekodPetugasVvipVipPentadbir(item);

    const nilai =
      data.vvip_vip ??
      item.vvip_vip;

    if (!nilaiAdaCarta(nilai)) return;

    const butiran = teksNilaiCarta(nilai);

    if (!butiran) return;

    butiran
      .split(/\n+/)
      .map(item => teks(item))
      .filter(Boolean)
      .forEach(teksItem => {
        hasil.push({
          id: `LAPORAN-${item.id || `${teks(item.tarikh_masa)}-${teksItem}`}`,
          jenisRekod: "LAPORAN",
          kategori: "VVIP / VIP",
          nama: teksItem,
          jawatan: "",
          agensi: "",
          masaTiba: item.tarikh_masa || null,
          masaBeredar: null,
          lokasi:
            petugas?.tempatTugas ||
            item.tempat_tugas ||
            item.lokasi ||
            data.lokasi ||
            "",
          tempatTugas:
            petugas?.tempatTugas ||
            item.tempat_tugas ||
            item.lokasi ||
            data.lokasi ||
            "",
          petugasNama:
            petugas
              ? `${petugas.pangkat || ""} ${petugas.nama || ""}`.trim()
              : (
                  item.nama_petugas ||
                  item.nama ||
                  "-"
                ),
          noBadan:
            petugas?.noBadan ||
            item.no_badan ||
            "-",
          jenisTugasPetugas:
            petugas?.jenisTugas ||
            item.jenis_tugas ||
            jenisTugasCarta(item) ||
            "-",
          callSign:
            petugas?.callSign ||
            item.call_sign ||
            "-",
          tujuan: "",
          catatan: "",
          sumber:
            jenisTugasCarta(item) ||
            "LAPORAN PETUGAS"
        });
      });
  });

  /*
    B. Rekod manual daripada Urusetia / Pentadbir
  */
  dataVvipVipOperasiPentadbir.forEach(item => {
    hasil.push({
      id: item.id,
      jenisRekod: "MANUAL",
      kategori: atas(item.kategori) || "VIP",
      nama: item.nama || "-",
      jawatan: item.jawatan || "",
      agensi: item.agensi || "",
      masaTiba: item.masa_tiba || null,
      masaBeredar: item.masa_beredar || null,
      lokasi: item.lokasi || "",
      tempatTugas: item.lokasi || "",
      petugasNama: "URUSETIA / PENTADBIR",
      noBadan: "-",
      jenisTugasPetugas: "-",
      callSign: "-",
      tujuan: item.tujuan || "",
      catatan: item.catatan || "",
      sumber: "URUSETIA / PENTADBIR"
    });
  });

  return hasil.sort((a, b) => {
    const masaA = teks(a.masaTiba);
    const masaB = teks(b.masaTiba);

    return masaA.localeCompare(masaB, "ms");
  });
}


function kiraInsidenCarta() {
  let tangkapan = 0;
  let rampasan = 0;
  let kemalangan = 0;
  let ancaman = 0;

  dataCartaLaporanPentadbir.forEach(item => {
    const data = dataLaporanCarta(item);

    if (nilaiAdaCarta(data.tangkapan)) tangkapan += 1;
    if (nilaiAdaCarta(data.rampasan)) rampasan += 1;
    if (nilaiAdaCarta(data.kemalangan)) kemalangan += 1;

    if (
      nilaiAdaCarta(
        data.jenis_ancaman ??
        data.ancaman
      )
    ) {
      ancaman += 1;
    }
  });

  return {
    tangkapan,
    rampasan,
    kemalangan,
    ancaman,
    jumlah:
      tangkapan +
      rampasan +
      kemalangan +
      ancaman
  };
}


function paparRingkasanCartaPentadbir() {
  const kenderaan =
    pecahanKenderaanSemasaCarta();

  const vvipVip =
    kumpulanVvipVipCarta();

  const insiden =
    kiraInsidenCarta();

  const sedangBertugas =
    dataDashboard.filter(item =>
      item.statusKehadiran === "HADIR" &&
      !item.checkout
    ).length;

  if (el("cartaJumlahPengunjung")) {
    el("cartaJumlahPengunjung").textContent =
      jumlahPengunjungSemasaCarta().toLocaleString("ms-MY");
  }

  if (el("cartaJumlahKenderaan")) {
    el("cartaJumlahKenderaan").textContent =
      kenderaan.jumlah.toLocaleString("ms-MY");
  }

  if (el("cartaJumlahVvipVip")) {
    el("cartaJumlahVvipVip").textContent =
      vvipVip.length.toLocaleString("ms-MY");
  }

  if (el("cartaJumlahBertugas")) {
    el("cartaJumlahBertugas").textContent =
      sedangBertugas.toLocaleString("ms-MY");
  }

  if (el("cartaJumlahInsiden")) {
    el("cartaJumlahInsiden").textContent =
      insiden.jumlah.toLocaleString("ms-MY");
  }

  if (el("cartaJumlahTangkapan")) {
    el("cartaJumlahTangkapan").textContent =
      insiden.tangkapan.toLocaleString("ms-MY");
  }
}


function binaPanelPengunjungPentadbir() {
  const kanvas =
    el("canvasCartaPengunjung");

  if (!kanvas) return null;

  const kad =
    kanvas.closest(
      '[data-chart-section="PENGUNJUNG"]'
    );

  if (!kad) return null;

  let layout =
    kad.querySelector(
      ".admin-visitor-layout"
    );

  if (!layout) {
    const bungkusAsal =
      kanvas.parentElement;

    layout =
      document.createElement("div");

    layout.className =
      "admin-visitor-layout";

    const panelCarta =
      document.createElement("div");

    panelCarta.className =
      "admin-visitor-chart-panel";

    bungkusAsal.parentNode.insertBefore(
      layout,
      bungkusAsal
    );

    layout.appendChild(
      panelCarta
    );

    panelCarta.appendChild(
      bungkusAsal
    );

    const panelButiran =
      document.createElement("aside");

    panelButiran.className =
      "admin-visitor-detail-panel";

    panelButiran.innerHTML = `
      <div class="admin-visitor-detail-heading">
        <div>
          <span>BUTIRAN PENGUNJUNG</span>
          <strong>SEMUA LAPORAN</strong>
        </div>
        <div
          class="admin-visitor-detail-count"
          id="jumlahButiranPengunjungPentadbir"
        >0</div>
      </div>

      <div
        class="admin-visitor-detail-list"
        id="senaraiButiranPengunjungPentadbir"
      >
        <div class="empty-row">
          Tiada laporan pengunjung.
        </div>
      </div>
    `;

    layout.appendChild(
      panelButiran
    );

    if (!el("gayaCartaPengunjungPentadbir")) {
      const gaya =
        document.createElement("style");

      gaya.id =
        "gayaCartaPengunjungPentadbir";

      gaya.textContent = `
        .admin-visitor-layout{
          display:grid;
          grid-template-columns:minmax(420px,.95fr) minmax(420px,1.05fr);
          gap:16px;
          align-items:stretch;
          margin-top:14px;
        }

        .admin-visitor-chart-panel,
        .admin-visitor-detail-panel{
          min-width:0;
          border:1px solid #303030;
          border-radius:12px;
          background:#121212;
        }

        .admin-visitor-chart-panel{
          display:flex;
          min-height:390px;
          flex-direction:column;
          justify-content:center;
          padding:12px;
        }

        .admin-visitor-chart-panel .admin-chart-canvas-wrap{
          height:330px;
          margin-top:0;
        }

        .admin-visitor-detail-panel{
          display:flex;
          min-height:390px;
          flex-direction:column;
          overflow:hidden;
        }

        .admin-visitor-detail-heading{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:14px 15px;
          border-bottom:1px solid #303030;
          background:#171717;
        }

        .admin-visitor-detail-heading span{
          display:block;
          color:#9f9f9f;
          font-size:10px;
          font-weight:800;
          letter-spacing:.04em;
        }

        .admin-visitor-detail-heading strong{
          display:block;
          margin-top:4px;
          color:#d4af37;
          font-size:18px;
        }

        .admin-visitor-detail-count{
          display:flex;
          width:52px;
          height:52px;
          flex:0 0 52px;
          align-items:center;
          justify-content:center;
          border-radius:50%;
          background:#d4af37;
          color:#111;
          font-size:17px;
          font-weight:900;
        }

        .admin-visitor-detail-list{
          display:grid;
          gap:9px;
          max-height:430px;
          padding:12px;
          overflow:auto;
        }

        .admin-visitor-detail-item{
          display:grid;
          grid-template-columns:34px minmax(0,1fr);
          gap:10px;
          padding:12px;
          border:1px solid #303030;
          border-radius:10px;
          background:#181818;
          transition:border-color .18s ease, box-shadow .18s ease, transform .18s ease;
        }

        .admin-visitor-detail-item.aktif{
          border-color:#d4af37;
          box-shadow:0 0 0 1px rgba(212,175,55,.28);
          transform:translateY(-1px);
        }

        .admin-visitor-detail-number{
          display:flex;
          width:30px;
          height:30px;
          align-items:center;
          justify-content:center;
          border-radius:50%;
          background:#303030;
          color:#d4af37;
          font-size:12px;
          font-weight:900;
        }

        .admin-visitor-detail-main{
          min-width:0;
        }

        .admin-visitor-detail-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
        }

        .admin-visitor-detail-top strong{
          color:#fff;
          font-size:14px;
        }

        .admin-visitor-detail-top time{
          color:#9f9f9f;
          font-size:11px;
          white-space:nowrap;
        }

        .admin-visitor-detail-body{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:8px 14px;
          margin-top:10px;
        }

        .admin-visitor-detail-body div{
          min-width:0;
        }

        .admin-visitor-detail-body span,
        .admin-visitor-note span{
          display:block;
          margin-bottom:3px;
          color:#9f9f9f;
          font-size:10px;
          font-weight:800;
          text-transform:uppercase;
        }

        .admin-visitor-detail-body b{
          display:block;
          color:#fff;
          font-size:12px;
          font-weight:700;
          line-height:1.45;
          overflow-wrap:anywhere;
        }

        .admin-visitor-detail-wide{
          grid-column:1 / -1;
        }

        .admin-visitor-note{
          margin-top:10px;
          padding:9px 10px;
          border-left:3px solid #d4af37;
          border-radius:6px;
          background:#111;
        }

        .admin-visitor-note p{
          margin:0;
          color:#ddd;
          font-size:12px;
          line-height:1.5;
          white-space:pre-wrap;
        }

        #canvasCartaPengunjung{
          cursor:pointer !important;
        }

        @media(max-width:1050px){
          .admin-visitor-layout{
            grid-template-columns:1fr;
          }
        }

        @media(max-width:620px){
          .admin-visitor-detail-body{
            grid-template-columns:1fr;
          }

          .admin-visitor-detail-wide{
            grid-column:auto;
          }

          .admin-visitor-detail-top{
            flex-direction:column;
          }
        }
      `;

      document.head.appendChild(gaya);
    }
  }

  return layout;
}


function rekodPetugasUntukLaporanPengunjungPentadbir(item) {
  const petugasId =
    item.petugas_id ||
    item.profile_id ||
    "";

  if (!petugasId) return null;

  return (
    dataDashboard.find(
      rekod =>
        rekod.petugasId === petugasId
    ) || null
  );
}


function nilaiJumlahPengunjungPentadbir(item) {
  const data =
    dataLaporanCarta(item);

  return nomborCarta(
    data.jumlah_pengunjung ??
    item.jumlah_pengunjung,
    0
  );
}


function jumlahKenderaanPengunjungPentadbir(item) {
  const data =
    dataLaporanCarta(item);

  const kenderaan =
    data.kenderaan &&
    typeof data.kenderaan === "object"
      ? data.kenderaan
      : {};

  const bas =
    nomborCarta(
      kenderaan.bas ?? data.bas,
      0
    );

  const motosikal =
    nomborCarta(
      kenderaan.motosikal ?? data.motosikal,
      0
    );

  const motokar =
    nomborCarta(
      kenderaan.motokar ?? data.motokar,
      0
    );

  return nomborCarta(
    kenderaan.jumlah ??
    item.jumlah_kenderaan,
    bas + motosikal + motokar
  );
}


function paparButiranPengunjungPentadbir(indexDipilih = -1) {
  binaPanelPengunjungPentadbir();

  const senarai =
    laporanKeselamatanCarta();

  const ruang =
    el("senaraiButiranPengunjungPentadbir");

  const jumlahBox =
    el("jumlahButiranPengunjungPentadbir");

  if (jumlahBox) {
    jumlahBox.textContent =
      senarai.length.toLocaleString("ms-MY");
  }

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML = `
      <div class="empty-row">
        Tiada laporan pengunjung untuk tarikh ini.
      </div>
    `;
    return;
  }

  ruang.innerHTML =
    senarai.map((item, index) => {
      const data =
        dataLaporanCarta(item);

      const petugas =
        rekodPetugasUntukLaporanPengunjungPentadbir(
          item
        );

      const jumlahPengunjung =
        nilaiJumlahPengunjungPentadbir(
          item
        );

      const jumlahKenderaan =
        jumlahKenderaanPengunjungPentadbir(
          item
        );

      const namaPetugas =
        petugas
          ? `${teks(petugas.pangkat)} ${teks(petugas.nama)}`.trim()
          : teks(
              item.nama_petugas ||
              item.nama
            ) || "-";

      const noBadan =
        teks(petugas?.noBadan) ||
        teks(item.no_badan) ||
        "-";

      const telefon =
        teks(petugas?.telefon) ||
        teks(item.no_telefon) ||
        teks(item.telefon) ||
        "-";

      const callSign =
        teks(petugas?.callSign) ||
        teks(item.call_sign) ||
        "-";

      const lokasi =
        teks(
          data.lokasi ??
          data.tempat_tugas ??
          item.tempat_tugas ??
          petugas?.tempatTugas
        ) || "-";

      const jenisTugas =
        jenisTugasCarta(item) ||
        petugas?.jenisTugas ||
        "KAWALAN KESELAMATAN";

      const vvipVip =
        teksNilaiCarta(
          data.vvip_vip ??
          item.vvip_vip
        ) || "TIADA";

      const perkaraMenarik =
        teksNilaiCarta(
          data.perkara_menarik ??
          data.catatan ??
          item.perkara_menarik
        );

      return `
        <article
          class="admin-visitor-detail-item ${index === indexDipilih ? "aktif" : ""}"
          data-index-pengunjung="${index}"
        >
          <div class="admin-visitor-detail-number">
            ${index + 1}
          </div>

          <div class="admin-visitor-detail-main">
            <div class="admin-visitor-detail-top">
              <strong>
                ${jumlahPengunjung.toLocaleString("ms-MY")} PENGUNJUNG
              </strong>

              <time>
                ${escapeHtml(
                  formatMasaLaporanAdmin(
                    item.tarikh_masa
                  )
                )}
              </time>
            </div>

            <div class="admin-visitor-detail-body">
              <div>
                <span>Jumlah Pengunjung</span>
                <b>${jumlahPengunjung.toLocaleString("ms-MY")}</b>
              </div>

              <div>
                <span>Jumlah Kenderaan</span>
                <b>${jumlahKenderaan.toLocaleString("ms-MY")}</b>
              </div>

              <div>
                <span>Lokasi</span>
                <b>${escapeHtml(lokasi)}</b>
              </div>

              <div>
                <span>Call Sign</span>
                <b>${escapeHtml(callSign)}</b>
              </div>

              <div>
                <span>Petugas</span>
                <b>${escapeHtml(namaPetugas)}</b>
              </div>

              <div>
                <span>No Badan</span>
                <b>${escapeHtml(noBadan)}</b>
              </div>

              <div>
                <span>No. Telefon</span>
                <b>${escapeHtml(telefon)}</b>
              </div>

              <div>
                <span>VVIP / VIP</span>
                <b>${escapeHtml(vvipVip)}</b>
              </div>

              <div class="admin-visitor-detail-wide">
                <span>Jenis Tugas</span>
                <b>${escapeHtml(jenisTugas)}</b>
              </div>
            </div>

            ${
              perkaraMenarik
                ? `
                  <div class="admin-visitor-note">
                    <span>Perkara Menarik / Catatan</span>
                    <p>${escapeHtml(perkaraMenarik)}</p>
                  </div>
                `
                : ""
            }
          </div>
        </article>
      `;
    }).join("");

  if (indexDipilih >= 0) {
    const aktif =
      ruang.querySelector(
        `[data-index-pengunjung="${indexDipilih}"]`
      );

    aktif?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }
}


function pilihRekodPengunjungPentadbir(index) {
  const senarai =
    laporanKeselamatanCarta();

  if (
    index < 0 ||
    index >= senarai.length
  ) {
    return;
  }

  paparButiranPengunjungPentadbir(
    index
  );
}


function paparCartaPengunjungPentadbir() {
  const kanvas =
    el("canvasCartaPengunjung");

  if (!kanvas) return;

  binaPanelPengunjungPentadbir();

  try {
    pastikanChartJsPentadbir();
  } catch (error) {
    return;
  }

  const senarai =
    laporanKeselamatanCarta();

  const labels =
    senarai.map(item =>
      masaCartaLabel(item.tarikh_masa)
    );

  const nilai =
    senarai.map(item =>
      nilaiJumlahPengunjungPentadbir(
        item
      )
    );

  kemusnahkanCartaPentadbir(
    cartaPengunjungPentadbir
  );

  cartaPengunjungPentadbir =
    new Chart(kanvas, {
      type: "line",

      data: {
        labels,
        datasets: [
          {
            label: "Jumlah Pengunjung",
            data: nilai,
            tension: 0.28,
            fill: false,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointHitRadius: 18
          }
        ]
      },

      options: {
        ...pilihanCartaPentadbir(
          "Jumlah Pengunjung"
        ),

        onClick(event) {
          const elemen =
            cartaPengunjungPentadbir
              ?.getElementsAtEventForMode(
                event,
                "nearest",
                {
                  intersect: false,
                  axis: "x"
                },
                true
              ) || [];

          if (!elemen.length) return;

          pilihRekodPengunjungPentadbir(
            elemen[0].index
          );
        },

        onHover(event) {
          const sasaran =
            event?.native?.target;

          if (sasaran) {
            sasaran.style.cursor =
              "pointer";
          }
        },

        plugins: {
          ...pilihanCartaPentadbir(
            "Jumlah Pengunjung"
          ).plugins,

          legend: {
            labels: {
              color: "#ffffff",
              font: {
                weight: "700"
              }
            }
          },

          tooltip: {
            enabled: true,
            callbacks: {
              label(context) {
                return `Jumlah Pengunjung: ${(Number(context.raw) || 0).toLocaleString("ms-MY")}`;
              },

              afterLabel() {
                return "Klik untuk sorot butiran di sebelah kanan";
              }
            }
          }
        }
      }
    });

  /*
    Semua butiran terus dipaparkan,
    walaupun pengguna belum klik carta.
  */
  paparButiranPengunjungPentadbir();
}


function labelKategoriKenderaanPentadbir(kategori) {
  const peta = {
    BAS: "BAS",
    MOTOSIKAL: "MOTOSIKAL",
    MOTOKAR: "MOTOKAR"
  };

  return peta[kategori] || kategori;
}


function nilaiKenderaanDaripadaLaporanPentadbir(item, kategori) {
  const data = dataLaporanCarta(item);

  const kenderaan =
    data.kenderaan &&
    typeof data.kenderaan === "object"
      ? data.kenderaan
      : {};

  if (kategori === "BAS") {
    return nomborCarta(
      kenderaan.bas ??
      data.bas,
      0
    );
  }

  if (kategori === "MOTOSIKAL") {
    return nomborCarta(
      kenderaan.motosikal ??
      data.motosikal,
      0
    );
  }

  if (kategori === "MOTOKAR") {
    return nomborCarta(
      kenderaan.motokar ??
      data.motokar,
      0
    );
  }

  return 0;
}


function jumlahKeseluruhanKenderaanLaporanPentadbir(item) {
  const data = dataLaporanCarta(item);

  const kenderaan =
    data.kenderaan &&
    typeof data.kenderaan === "object"
      ? data.kenderaan
      : {};

  const bas =
    nomborCarta(
      kenderaan.bas ??
      data.bas,
      0
    );

  const motosikal =
    nomborCarta(
      kenderaan.motosikal ??
      data.motosikal,
      0
    );

  const motokar =
    nomborCarta(
      kenderaan.motokar ??
      data.motokar,
      0
    );

  return nomborCarta(
    kenderaan.jumlah ??
    item.jumlah_kenderaan,
    bas + motosikal + motokar
  );
}


function senaraiKenderaanMengikutKategoriPentadbir(kategori) {
  return laporanKeselamatanCarta()
    .filter(item =>
      nilaiKenderaanDaripadaLaporanPentadbir(
        item,
        kategori
      ) > 0
    )
    .sort((a, b) => {
      const masaA =
        new Date(
          a.tarikh_masa || 0
        ).getTime();

      const masaB =
        new Date(
          b.tarikh_masa || 0
        ).getTime();

      return masaB - masaA;
    });
}


function rekodPetugasUntukLaporanKenderaanPentadbir(item) {
  const petugasId =
    item.petugas_id ||
    item.profile_id ||
    "";

  if (!petugasId) return null;

  return (
    dataDashboard.find(
      rekod =>
        rekod.petugasId === petugasId
    ) ||
    null
  );
}


function paparButiranKenderaanPentadbir(kategori) {
  kategoriKenderaanDipilihPentadbir =
    kategori;

  const label =
    labelKategoriKenderaanPentadbir(
      kategori
    );

  const senarai =
    senaraiKenderaanMengikutKategoriPentadbir(
      kategori
    );

  const jumlahKategori =
    senarai.reduce(
      (jumlah, item) =>
        jumlah +
        nilaiKenderaanDaripadaLaporanPentadbir(
          item,
          kategori
        ),
      0
    );

  if (el("tajukButiranKenderaanPentadbir")) {
    el("tajukButiranKenderaanPentadbir").textContent =
      label;
  }

  if (el("jumlahButiranKenderaanPentadbir")) {
    el("jumlahButiranKenderaanPentadbir").textContent =
      jumlahKategori.toLocaleString("ms-MY");
  }

  const ruang =
    el("senaraiButiranKenderaanPentadbir");

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML = `
      <div class="empty-row">
        Tiada rekod ${escapeHtml(label)} untuk tarikh ini.
      </div>
    `;
    return;
  }

  ruang.innerHTML =
    senarai.map((item, index) => {
      const data =
        dataLaporanCarta(item);

      const petugas =
        rekodPetugasUntukLaporanKenderaanPentadbir(
          item
        );

      const nilaiKategori =
        nilaiKenderaanDaripadaLaporanPentadbir(
          item,
          kategori
        );

      const jumlahKenderaan =
        jumlahKeseluruhanKenderaanLaporanPentadbir(
          item
        );

      const lokasi =
        teks(
          data.lokasi ??
          data.tempat_tugas ??
          item.tempat_tugas ??
          petugas?.tempatTugas
        ) || "-";

      const namaPetugas =
        petugas
          ? `${teks(petugas.pangkat)} ${teks(petugas.nama)}`.trim()
          : teks(
              item.nama_petugas ||
              item.nama
            ) || "-";

      const noBadan =
        teks(petugas?.noBadan) ||
        teks(item.no_badan) ||
        "-";

      const callSign =
        teks(petugas?.callSign) ||
        teks(item.call_sign) ||
        "-";

      const jenisTugas =
        jenisTugasCarta(item) ||
        petugas?.jenisTugas ||
        "-";

      return `
        <article class="admin-vehicle-detail-item">
          <div class="admin-vehicle-detail-number">
            ${index + 1}
          </div>

          <div class="admin-vehicle-detail-main">

            <div class="admin-vehicle-detail-top">
              <strong>
                ${escapeHtml(label)}
                :
                ${nilaiKategori.toLocaleString("ms-MY")}
              </strong>

              <time>
                ${escapeHtml(
                  formatMasaLaporanAdmin(
                    item.tarikh_masa
                  )
                )}
              </time>
            </div>

            <div class="admin-vehicle-detail-body">

              <div>
                <span>Jumlah ${escapeHtml(label)}</span>
                <b>
                  ${nilaiKategori.toLocaleString("ms-MY")}
                </b>
              </div>

              <div>
                <span>Jumlah Kenderaan</span>
                <b>
                  ${jumlahKenderaan.toLocaleString("ms-MY")}
                </b>
              </div>

              <div>
                <span>Lokasi</span>
                <b>${escapeHtml(lokasi)}</b>
              </div>

              <div>
                <span>Call Sign</span>
                <b>${escapeHtml(callSign)}</b>
              </div>

              <div>
                <span>Petugas</span>
                <b>${escapeHtml(namaPetugas)}</b>
              </div>

              <div>
                <span>No Badan</span>
                <b>${escapeHtml(noBadan)}</b>
              </div>

              <div class="admin-vehicle-detail-wide">
                <span>Jenis Tugas</span>
                <b>${escapeHtml(jenisTugas)}</b>
              </div>

            </div>
          </div>
        </article>
      `;
    }).join("");
}


function pilihKategoriCartaKenderaanPentadbir(index) {
  const kategori = [
    "BAS",
    "MOTOSIKAL",
    "MOTOKAR"
  ][index];

  if (!kategori) return;

  paparButiranKenderaanPentadbir(
    kategori
  );

  sorotBarKenderaanPentadbir(
    index
  );
}


function sorotBarKenderaanPentadbir(indexDipilih) {
  const carta =
    cartaKenderaanPentadbir;

  if (!carta) return;

  const dataset =
    carta.data.datasets?.[0];

  if (!dataset) return;

  dataset.backgroundColor =
    carta.data.labels.map(
      (_, index) =>
        index === indexDipilih
          ? "rgba(212,175,55,.95)"
          : "rgba(54,162,235,.48)"
    );

  dataset.borderColor =
    carta.data.labels.map(
      (_, index) =>
        index === indexDipilih
          ? "#ffffff"
          : "rgba(255,255,255,.25)"
    );

  dataset.borderWidth =
    carta.data.labels.map(
      (_, index) =>
        index === indexDipilih
          ? 2
          : 1
    );

  carta.update();
}


function paparCartaKenderaanPentadbir() {
  const kanvas =
    el("canvasCartaKenderaan");

  if (!kanvas) return;

  try {
    pastikanChartJsPentadbir();
  } catch (_) {
    return;
  }

  const data =
    pecahanKenderaanSemasaCarta();

  const nilaiCarta = [
    data.bas,
    data.motosikal,
    data.motokar
  ];

  kemusnahkanCartaPentadbir(
    cartaKenderaanPentadbir
  );

  cartaKenderaanPentadbir =
    new Chart(kanvas, {
      type: "bar",

      data: {
        labels: [
          "Bas",
          "Motosikal",
          "Motokar"
        ],

        datasets: [
          {
            label: "Jumlah",
            data: nilaiCarta
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        onClick(event) {
          /*
            Klik bar, termasuk apabila nilai terlalu kecil.
          */
          const elemen =
            cartaKenderaanPentadbir
              ?.getElementsAtEventForMode(
                event,
                "nearest",
                {
                  intersect: false,
                  axis: "x"
                },
                true
              ) || [];

          if (elemen.length) {
            pilihKategoriCartaKenderaanPentadbir(
              elemen[0].index
            );
            return;
          }

          /*
            Fallback berdasarkan kedudukan X.
            Ini membolehkan kategori bernilai 0 masih dipilih.
          */
          const carta =
            cartaKenderaanPentadbir;

          const xScale =
            carta?.scales?.x;

          const nativeEvent =
            event?.native;

          if (
            !carta ||
            !xScale ||
            !nativeEvent
          ) {
            return;
          }

          const rect =
            carta.canvas.getBoundingClientRect();

          const x =
            nativeEvent.clientX -
            rect.left;

          let indexTerdekat = -1;
          let jarakTerdekat = Infinity;

          carta.data.labels.forEach(
            (_, index) => {
              const pixel =
                xScale.getPixelForValue(index);

              const jarak =
                Math.abs(pixel - x);

              if (
                jarak <
                jarakTerdekat
              ) {
                jarakTerdekat =
                  jarak;

                indexTerdekat =
                  index;
              }
            }
          );

          if (indexTerdekat >= 0) {
            pilihKategoriCartaKenderaanPentadbir(
              indexTerdekat
            );
          }
        },

        onHover(event) {
          const sasaran =
            event?.native?.target;

          if (sasaran) {
            sasaran.style.cursor =
              "pointer";
          }
        },

        plugins: {
          legend: {
            labels: {
              color: "#ffffff",
              font: {
                size: 12,
                weight: "700"
              }
            }
          },

          tooltip: {
            callbacks: {
              label(context) {
                return `${context.label}: ${Number(context.raw) || 0}`;
              },

              afterLabel() {
                return "Klik untuk papar butiran";
              }
            }
          }
        },

        scales: {
          x: {
            ticks: {
              color: "#ffffff",
              font: {
                weight: "700"
              }
            },

            grid: {
              color: "rgba(255,255,255,.06)"
            }
          },

          y: {
            beginAtZero: true,

            ticks: {
              color: "#c8c8c8",
              precision: 0
            },

            grid: {
              color: "rgba(255,255,255,.06)"
            },

            title: {
              display: true,
              text: "Jumlah Kenderaan",
              color: "#c8c8c8"
            }
          }
        }
      }
    });

  paparButiranKenderaanPentadbir(
    kategoriKenderaanDipilihPentadbir
  );

  const indeksAktif = [
    "BAS",
    "MOTOSIKAL",
    "MOTOKAR"
  ].indexOf(
    kategoriKenderaanDipilihPentadbir
  );

  if (indeksAktif >= 0) {
    sorotBarKenderaanPentadbir(
      indeksAktif
    );
  }
}



/* ================================================================
   CARTA KEHADIRAN — FUNGSI INTERAKTIF
================================================================ */

function kategoriKehadiranCartaPentadbir(item) {
  /*
    Susunan keutamaan:
    1. Jika sudah Check-Out = SELESAI
    2. Jika status HADIR = HADIR
    3. Jika MENUNGGU = MENUNGGU
    4. Selain itu = TIDAK HADIR
  */

  if (item.checkout) {
    return "SELESAI";
  }

  if (atas(item.statusKehadiran) === "HADIR") {
    return "HADIR";
  }

  if (atas(item.statusKehadiran) === "MENUNGGU") {
    return "MENUNGGU";
  }

  return "TIDAK_HADIR";
}


function labelKategoriKehadiranPentadbir(kategori) {
  const peta = {
    HADIR: "HADIR",
    TIDAK_HADIR: "TIDAK HADIR",
    SELESAI: "SELESAI",
    MENUNGGU: "MENUNGGU"
  };

  return peta[kategori] || kategori;
}


function senaraiMengikutKehadiranPentadbir(kategori) {
  return dataDashboard
    .filter(item =>
      kategoriKehadiranCartaPentadbir(item) === kategori
    )
    .sort((a, b) => {
      const pangkatA = atas(a.pangkat);
      const pangkatB = atas(b.pangkat);

      if (pangkatA !== pangkatB) {
        return pangkatA.localeCompare(
          pangkatB,
          "ms"
        );
      }

      return atas(a.nama).localeCompare(
        atas(b.nama),
        "ms"
      );
    });
}


function paparSenaraiKehadiranPentadbir(kategori) {
  statusKehadiranCartaDipilihPentadbir =
    kategori;

  const label =
    labelKategoriKehadiranPentadbir(
      kategori
    );

  const senarai =
    senaraiMengikutKehadiranPentadbir(
      kategori
    );

  if (
    el("tajukSenaraiKehadiranPentadbir")
  ) {
    el(
      "tajukSenaraiKehadiranPentadbir"
    ).textContent = label;
  }

  if (
    el("jumlahSenaraiKehadiranPentadbir")
  ) {
    el(
      "jumlahSenaraiKehadiranPentadbir"
    ).textContent =
      senarai.length.toLocaleString(
        "ms-MY"
      );
  }

  const ruang =
    el("senaraiKehadiranPentadbir");

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML = `
      <div class="empty-row">
        Tiada petugas dalam status
        ${escapeHtml(label)}.
      </div>
    `;
    return;
  }

  ruang.innerHTML =
    senarai.map((item, index) => {

      const masa =
        item.checkout
          ? (
              item.checkout.masa_checkout ||
              item.masaCheckout
            )
          : item.masaCheckin;

      const teksMasa =
        masa
          ? formatTarikhMasa(masa)
          : "-";

      return `
        <article class="admin-attendance-person">

          <div class="admin-attendance-person-no">
            ${index + 1}
          </div>

          <div class="admin-attendance-person-main">

            <strong>
              ${escapeHtml(item.pangkat || "")}
              ${escapeHtml(item.nama || "-")}
            </strong>

            <div class="admin-attendance-person-meta">

              <span>
                No Badan:
                <b>
                  ${escapeHtml(item.noBadan || "-")}
                </b>
              </span>

              <span>
                No. Telefon:
                <b>
                  ${escapeHtml(item.telefon || "-")}
                </b>
              </span>

              <span>
                Call Sign:
                <b>
                  ${escapeHtml(item.callSign || "-")}
                </b>
              </span>

              <span>
                Tempat:
                <b>
                  ${escapeHtml(item.tempatTugas || "-")}
                </b>
              </span>

              <span>
                Tugas:
                <b>
                  ${escapeHtml(item.jenisTugas || "-")}
                </b>
              </span>

            </div>

            <div class="admin-attendance-person-footer">

              ${
                item.penyelia
                  ? '<span class="badge badge-yellow">PENYELIA</span>'
                  : ""
              }

              ${
                item.pemegangSet
                  ? '<span class="badge badge-blue">PEMEGANG SET</span>'
                  : ""
              }

              <small>
                ${
                  kategori === "SELESAI"
                    ? "Check-Out"
                    : kategori === "HADIR"
                      ? "Check-In"
                      : "Masa"
                }:
                ${escapeHtml(teksMasa)}
              </small>

            </div>

          </div>

        </article>
      `;
    }).join("");
}


function pilihKategoriCartaKehadiranPentadbir(index) {
  const kategori = [
    "HADIR",
    "TIDAK_HADIR",
    "SELESAI",
    "MENUNGGU"
  ][index];

  if (!kategori) return;

  paparSenaraiKehadiranPentadbir(
    kategori
  );
}


/* ================================================================
   PLUGIN PERATUS CARTA KEHADIRAN
================================================================ */

const pluginPeratusCartaKehadiranPentadbir = {
  id: "peratusCartaKehadiranPentadbir",

  afterDatasetsDraw(chart) {
    const { ctx } = chart;

    const dataset =
      chart.data.datasets?.[0];

    const meta =
      chart.getDatasetMeta(0);

    if (
      !dataset ||
      !meta?.data?.length
    ) {
      return;
    }

    const nilai =
      dataset.data.map(
        item => Number(item) || 0
      );

    const jumlah =
      nilai.reduce(
        (a, b) => a + b,
        0
      );

    if (!jumlah) return;

    ctx.save();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 12px Arial";

    meta.data.forEach(
      (arc, index) => {

        const bilangan =
          nilai[index];

        if (!bilangan) return;

        const peratus =
          Math.round(
            (bilangan / jumlah) * 100
          );

        /*
          Elakkan tulisan bertindih
          untuk bahagian terlalu kecil.
        */
        if (peratus < 5) return;

        const posisi =
          arc.tooltipPosition();

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle =
          "rgba(0,0,0,.85)";
        ctx.lineWidth = 4;

        const teksPeratus =
          `${peratus}%`;

        ctx.strokeText(
          teksPeratus,
          posisi.x,
          posisi.y
        );

        ctx.fillText(
          teksPeratus,
          posisi.x,
          posisi.y
        );
      }
    );

    ctx.restore();
  }
};


function peratusKategoriKehadiranPentadbir(
  nilai,
  semuaNilai
) {
  const jumlah =
    semuaNilai.reduce(
      (a, b) =>
        a + (Number(b) || 0),
      0
    );

  if (!jumlah) return 0;

  return Math.round(
    (
      (Number(nilai) || 0) /
      jumlah
    ) * 100
  );
}


function paparCartaKehadiranPentadbir() {
  const kanvas =
    el("canvasCartaKehadiran");

  if (!kanvas) return;

  try {
    pastikanChartJsPentadbir();
  } catch (_) {
    return;
  }

  const hadir =
    senaraiMengikutKehadiranPentadbir(
      "HADIR"
    ).length;

  const tidakHadir =
    senaraiMengikutKehadiranPentadbir(
      "TIDAK_HADIR"
    ).length;

  const selesai =
    senaraiMengikutKehadiranPentadbir(
      "SELESAI"
    ).length;

  const menunggu =
    senaraiMengikutKehadiranPentadbir(
      "MENUNGGU"
    ).length;

  const nilaiCarta = [
    hadir,
    tidakHadir,
    selesai,
    menunggu
  ];

  kemusnahkanCartaPentadbir(
    cartaKehadiranPentadbir
  );

  cartaKehadiranPentadbir =
    new Chart(kanvas, {
      type: "doughnut",

      data: {
        labels: [
          "Hadir",
          "Tidak Hadir",
          "Selesai",
          "Menunggu"
        ],

        datasets: [
          {
            data: nilaiCarta
          }
        ]
      },

      plugins: [
        pluginPeratusCartaKehadiranPentadbir
      ],

      options: {
        responsive: true,
        maintainAspectRatio: false,

        onClick(event, elements) {
          if (!elements?.length) return;

          pilihKategoriCartaKehadiranPentadbir(
            elements[0].index
          );
        },

        onHover(event, elements) {
          const sasaran =
            event?.native?.target;

          if (sasaran) {
            sasaran.style.cursor =
              elements?.length
                ? "pointer"
                : "default";
          }
        },

        plugins: {
          legend: {
            position: "top",

            labels: {
              color: "#ffffff",
              font: {
                size: 12,
                weight: "700"
              },

              generateLabels(chart) {
                const data =
                  chart.data;

                const semuaNilai =
                  data.datasets?.[0]?.data || [];

                return data.labels.map(
                  (label, index) => {
                    const nilai =
                      Number(
                        semuaNilai[index]
                      ) || 0;

                    const peratus =
                      peratusKategoriKehadiranPentadbir(
                        nilai,
                        semuaNilai
                      );

                    const style =
                      chart.getDatasetMeta(0)
                        .controller
                        .getStyle(index);

                    return {
                      text:
                        `${label}: ${nilai} (${peratus}%)`,
                      fillStyle:
                        style.backgroundColor,
                      strokeStyle:
                        style.borderColor,
                      lineWidth:
                        style.borderWidth,
                      fontColor: "#ffffff",
                      hidden:
                        !chart.getDataVisibility(index),
                      index
                    };
                  }
                );
              }
            },

            onClick(event, legendItem) {
              pilihKategoriCartaKehadiranPentadbir(
                legendItem.index
              );
            }
          },

          tooltip: {
            enabled: true,

            callbacks: {
              label(context) {
                const semuaNilai =
                  context.chart.data.datasets?.[0]?.data || [];

                const nilai =
                  Number(context.raw) || 0;

                const peratus =
                  peratusKategoriKehadiranPentadbir(
                    nilai,
                    semuaNilai
                  );

                return `${context.label}: ${nilai} petugas (${peratus}%)`;
              },

              afterLabel() {
                return "Klik untuk papar senarai nama";
              }
            }
          }
        }
      }
    });

  paparSenaraiKehadiranPentadbir(
    statusKehadiranCartaDipilihPentadbir
  );
}


function labelKategoriInsidenPentadbir(kategori) {
  const peta = {
    TANGKAPAN: "TANGKAPAN",
    RAMPASAN: "RAMPASAN",
    KEMALANGAN: "KEMALANGAN",
    ANCAMAN: "ANCAMAN"
  };

  return peta[kategori] || kategori;
}


function nilaiInsidenDaripadaLaporanPentadbir(item, kategori) {
  const data = dataLaporanCarta(item);

  if (kategori === "TANGKAPAN") {
    return data.tangkapan;
  }

  if (kategori === "RAMPASAN") {
    return data.rampasan;
  }

  if (kategori === "KEMALANGAN") {
    return data.kemalangan;
  }

  if (kategori === "ANCAMAN") {
    return (
      data.jenis_ancaman ??
      data.ancaman
    );
  }

  return null;
}


function senaraiInsidenMengikutKategoriPentadbir(kategori) {
  return dataCartaLaporanPentadbir
    .filter(item =>
      nilaiAdaCarta(
        nilaiInsidenDaripadaLaporanPentadbir(
          item,
          kategori
        )
      )
    )
    .sort((a, b) => {
      const masaA = new Date(a.tarikh_masa || 0).getTime();
      const masaB = new Date(b.tarikh_masa || 0).getTime();
      return masaB - masaA;
    });
}


function rekodPetugasUntukLaporanInsidenPentadbir(item) {
  const petugasId =
    item.petugas_id ||
    item.profile_id ||
    "";

  if (!petugasId) return null;

  return (
    dataDashboard.find(
      rekod => rekod.petugasId === petugasId
    ) || null
  );
}


function lokasiLaporanInsidenPentadbir(item, petugas) {
  const data = dataLaporanCarta(item);

  return (
    teks(data.lokasi) ||
    teks(data.tempat_tugas) ||
    teks(item.tempat_tugas) ||
    teks(petugas?.tempatTugas) ||
    "-"
  );
}


function paparButiranInsidenPentadbir(kategori) {
  kategoriInsidenDipilihPentadbir =
    kategori;

  const label =
    labelKategoriInsidenPentadbir(kategori);

  const senarai =
    senaraiInsidenMengikutKategoriPentadbir(
      kategori
    );

  if (el("tajukButiranInsidenPentadbir")) {
    el("tajukButiranInsidenPentadbir").textContent =
      label;
  }

  if (el("jumlahButiranInsidenPentadbir")) {
    el("jumlahButiranInsidenPentadbir").textContent =
      senarai.length.toLocaleString("ms-MY");
  }

  const ruang =
    el("senaraiButiranInsidenPentadbir");

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML = `
      <div class="empty-row">
        Tiada laporan ${escapeHtml(label)} untuk tarikh ini.
      </div>
    `;
    return;
  }

  ruang.innerHTML =
    senarai.map((item, index) => {
      const data =
        dataLaporanCarta(item);

      const petugas =
        rekodPetugasUntukLaporanInsidenPentadbir(item);

      const nilai =
        nilaiInsidenDaripadaLaporanPentadbir(
          item,
          kategori
        );

      const butiran =
        teksNilaiCarta(nilai) || "-";

      const jenisTugas =
        jenisTugasCarta(item) ||
        petugas?.jenisTugas ||
        "-";

      const lokasi =
        lokasiLaporanInsidenPentadbir(
          item,
          petugas
        );

      const namaPetugas =
        petugas
          ? `${teks(petugas.pangkat)} ${teks(petugas.nama)}`.trim()
          : teks(item.nama_petugas || item.nama) || "-";

      const noBadan =
        teks(petugas?.noBadan) ||
        teks(item.no_badan) ||
        "-";

      const telefon =
        teks(petugas?.telefon) ||
        teks(item.no_telefon) ||
        teks(item.telefon) ||
        "-";

      const catatanTambahan =
        teksNilaiCarta(
          data.catatan ??
          data.perkara_menarik ??
          data.catatan_no_repot
        );

      return `
        <article class="admin-incident-detail-item">
          <div class="admin-incident-detail-number">
            ${index + 1}
          </div>

          <div class="admin-incident-detail-main">
            <div class="admin-incident-detail-top">
              <strong>${escapeHtml(label)}</strong>
              <time>
                ${escapeHtml(
                  formatMasaLaporanAdmin(
                    item.tarikh_masa
                  )
                )}
              </time>
            </div>

            <div class="admin-incident-detail-body">
              <div>
                <span>Butiran</span>
                <b>${escapeHtml(butiran)}</b>
              </div>

              <div>
                <span>Lokasi</span>
                <b>${escapeHtml(lokasi)}</b>
              </div>

              <div>
                <span>Jenis Tugas</span>
                <b>${escapeHtml(jenisTugas)}</b>
              </div>

              <div>
                <span>Petugas</span>
                <b>${escapeHtml(namaPetugas)}</b>
              </div>

              <div>
                <span>No Badan</span>
                <b>${escapeHtml(noBadan)}</b>
              </div>

              <div>
                <span>No. Telefon</span>
                <b>${escapeHtml(telefon)}</b>
              </div>
            </div>

            ${
              catatanTambahan
                ? `
                  <div class="admin-incident-note">
                    <span>Catatan</span>
                    <p>${escapeHtml(catatanTambahan)}</p>
                  </div>
                `
                : ""
            }
          </div>
        </article>
      `;
    }).join("");
}


function pilihKategoriCartaInsidenPentadbir(index) {
  const kategori = [
    "TANGKAPAN",
    "RAMPASAN",
    "KEMALANGAN",
    "ANCAMAN"
  ][index];

  if (!kategori) return;

  paparButiranInsidenPentadbir(kategori);
}



function sorotBarInsidenPentadbir(indexDipilih) {
  const carta =
    cartaInsidenPentadbir;

  if (!carta) return;

  const dataset =
    carta.data.datasets?.[0];

  if (!dataset) return;

  /*
    Warna berbeza untuk kategori dipilih.
    Tidak bergantung pada warna khusus untuk setiap kategori,
    cuma beri opacity lebih jelas pada pilihan aktif.
  */
  const warnaAsal =
    carta.options?.plugins?._warnaInsidenAsal ||
    "rgba(54, 162, 235, 0.65)";

  dataset.backgroundColor =
    carta.data.labels.map(
      (_, index) =>
        index === indexDipilih
          ? "rgba(212, 175, 55, 0.95)"
          : "rgba(54, 162, 235, 0.48)"
    );

  dataset.borderColor =
    carta.data.labels.map(
      (_, index) =>
        index === indexDipilih
          ? "#ffffff"
          : "rgba(255,255,255,.25)"
    );

  dataset.borderWidth =
    carta.data.labels.map(
      (_, index) =>
        index === indexDipilih
          ? 2
          : 1
    );

  carta.update();
}


function paparCartaInsidenPentadbir() {
  const kanvas =
    el("canvasCartaInsiden");

  if (!kanvas) return;

  try {
    pastikanChartJsPentadbir();
  } catch (_) {
    return;
  }

  const insiden =
    kiraInsidenCarta();

  const nilaiCarta = [
    insiden.tangkapan,
    insiden.rampasan,
    insiden.kemalangan,
    insiden.ancaman
  ];

  kemusnahkanCartaPentadbir(
    cartaInsidenPentadbir
  );

  cartaInsidenPentadbir =
    new Chart(kanvas, {
      type: "bar",

      data: {
        labels: [
          "Tangkapan",
          "Rampasan",
          "Kemalangan",
          "Ancaman"
        ],

        datasets: [
          {
            label: "Bilangan Laporan",
            data: nilaiCarta
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        onClick(event) {
          /*
            Cuba kesan bar yang diklik terlebih dahulu.
            intersect:false membolehkan bar yang sangat pendek
            masih mudah dipilih.
          */
          const elemenTerdekat =
            cartaInsidenPentadbir
              ?.getElementsAtEventForMode(
                event,
                "nearest",
                {
                  intersect: false,
                  axis: "x"
                },
                true
              ) || [];

          if (elemenTerdekat.length) {
            pilihKategoriCartaInsidenPentadbir(
              elemenTerdekat[0].index
            );
            sorotBarInsidenPentadbir(
              elemenTerdekat[0].index
            );
            return;
          }

          /*
            Fallback:
            tentukan kategori berdasarkan kedudukan X klik.
            Jadi walaupun nilai = 0 dan bar hampir tidak kelihatan,
            kawasan kategorinya masih boleh diklik.
          */
          const carta =
            cartaInsidenPentadbir;

          const xScale =
            carta?.scales?.x;

          const nativeEvent =
            event?.native;

          if (
            !carta ||
            !xScale ||
            !nativeEvent
          ) {
            return;
          }

          const rect =
            carta.canvas.getBoundingClientRect();

          const x =
            nativeEvent.clientX -
            rect.left;

          let indexTerdekat = -1;
          let jarakTerdekat = Infinity;

          carta.data.labels.forEach(
            (_, index) => {
              const pixel =
                xScale.getPixelForValue(index);

              const jarak =
                Math.abs(pixel - x);

              if (jarak < jarakTerdekat) {
                jarakTerdekat = jarak;
                indexTerdekat = index;
              }
            }
          );

          if (indexTerdekat >= 0) {
            pilihKategoriCartaInsidenPentadbir(
              indexTerdekat
            );
            sorotBarInsidenPentadbir(
              indexTerdekat
            );
          }
        },

        onHover(event) {
          const sasaran =
            event?.native?.target;

          if (sasaran) {
            sasaran.style.cursor =
              "pointer";
          }
        },

        plugins: {
          legend: {
            labels: {
              color: "#ffffff",
              font: {
                size: 12,
                weight: "700"
              }
            }
          },

          tooltip: {
            callbacks: {
              label(context) {
                return `${context.label}: ${Number(context.raw) || 0} laporan`;
              },

              afterLabel() {
                return "Klik untuk papar butiran";
              }
            }
          }
        },

        scales: {
          x: {
            ticks: {
              color: "#ffffff",
              font: {
                weight: "700"
              }
            },

            grid: {
              color: "rgba(255,255,255,.06)"
            }
          },

          y: {
            beginAtZero: true,

            ticks: {
              color: "#c8c8c8",
              precision: 0
            },

            grid: {
              color: "rgba(255,255,255,.06)"
            },

            title: {
              display: true,
              text: "Bilangan Insiden",
              color: "#c8c8c8"
            }
          }
        }
      }
    });

  paparButiranInsidenPentadbir(
    kategoriInsidenDipilihPentadbir
  );

  const indeksAktif = [
    "TANGKAPAN",
    "RAMPASAN",
    "KEMALANGAN",
    "ANCAMAN"
  ].indexOf(
    kategoriInsidenDipilihPentadbir
  );

  if (indeksAktif >= 0) {
    sorotBarInsidenPentadbir(
      indeksAktif
    );
  }
}


/* ================================================================
   VVIP / VIP — PAPARAN + CRUD SUPABASE
================================================================ */

function ralatJadualVvipVipBelumWujud(error) {
  return (
    error?.code === "42P01" ||
    /vvip_vip_operasi|relation.*does not exist|could not find.*table/i.test(
      error?.message || ""
    )
  );
}


async function muatVvipVipOperasiPentadbir(
  tarikh,
  paparStatus = true
) {
  const tarikhDipilih =
    tarikh ||
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  try {
    const { data, error } =
      await denganHadMasa(
        db.from("vvip_vip_operasi")
          .select("*")
          .eq("tarikh", tarikhDipilih)
          .order("masa_tiba", { ascending: true })
          .order("nama", { ascending: true })
      );

    if (error) throw error;

    dataVvipVipOperasiPentadbir =
      data || [];

    paparCartaVvipVipPentadbir();
    paparRingkasanCartaPentadbir();

    if (paparStatus) {
      paparMesej(
        "statusVvipVipPentadbir",
        `${dataVvipVipOperasiPentadbir.length} rekod tambahan VVIP / VIP dimuatkan.`,
        "success"
      );
    }

    return true;

  } catch (error) {
    console.error(
      "Gagal memuat VVIP/VIP:",
      error
    );

    dataVvipVipOperasiPentadbir = [];
    paparCartaVvipVipPentadbir();

    const mesej =
      ralatJadualVvipVipBelumWujud(error)
        ? "Jadual vvip_vip_operasi belum diwujudkan. Jalankan SQL yang disediakan dalam Supabase SQL Editor."
        : `Ralat VVIP / VIP: ${error.message || "Ralat tidak diketahui."}`;

    paparMesej(
      "statusVvipVipPentadbir",
      escapeHtml(mesej),
      "error"
    );

    return false;
  }
}


async function muatSemulaVvipVipPentadbir() {
  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  await muatVvipVipOperasiPentadbir(
    tarikh,
    true
  );
}


function kosongkanBorangVvipVipPentadbir() {
  rekodVvipVipSedangEditPentadbir = null;

  const nilaiKosong = [
    "idVvipVipPentadbir",
    "namaVvipVipPentadbir",
    "jawatanVvipVipPentadbir",
    "agensiVvipVipPentadbir",
    "masaTibaVvipVipPentadbir",
    "masaBeredarVvipVipPentadbir",
    "lokasiVvipVipPentadbir",
    "tujuanVvipVipPentadbir",
    "catatanVvipVipPentadbir"
  ];

  nilaiKosong.forEach(id => {
    if (el(id)) el(id).value = "";
  });

  if (el("kategoriVvipVipPentadbir")) {
    el("kategoriVvipVipPentadbir").value = "VIP";
  }

  const status =
    el("statusModalVvipVipPentadbir");

  if (status) {
    status.className = "status-box";
    status.innerHTML = "";
  }
}


function bukaTambahVvipVipPentadbir() {
  kosongkanBorangVvipVipPentadbir();

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  if (el("tarikhVvipVipPentadbir")) {
    el("tarikhVvipVipPentadbir").value =
      tarikh;
  }

  if (el("tajukModalVvipVipPentadbir")) {
    el("tajukModalVvipVipPentadbir").textContent =
      "Tambah VVIP / VIP";
  }

  const modal =
    el("modalVvipVipPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.classList.add("open");
  }
}


function bukaEditVvipVipPentadbir(id) {
  const rekod =
    dataVvipVipOperasiPentadbir.find(
      item =>
        teks(item.id) === teks(id)
    );

  if (!rekod) {
    alert("Rekod VVIP / VIP tidak dijumpai.");
    return;
  }

  rekodVvipVipSedangEditPentadbir =
    rekod;

  if (el("idVvipVipPentadbir")) {
    el("idVvipVipPentadbir").value =
      rekod.id || "";
  }

  if (el("tarikhVvipVipPentadbir")) {
    el("tarikhVvipVipPentadbir").value =
      rekod.tarikh || "";
  }

  if (el("kategoriVvipVipPentadbir")) {
    el("kategoriVvipVipPentadbir").value =
      atas(rekod.kategori) === "VVIP"
        ? "VVIP"
        : "VIP";
  }

  const map = {
    namaVvipVipPentadbir: rekod.nama,
    jawatanVvipVipPentadbir: rekod.jawatan,
    agensiVvipVipPentadbir: rekod.agensi,
    masaTibaVvipVipPentadbir: rekod.masa_tiba,
    masaBeredarVvipVipPentadbir: rekod.masa_beredar,
    lokasiVvipVipPentadbir: rekod.lokasi,
    tujuanVvipVipPentadbir: rekod.tujuan,
    catatanVvipVipPentadbir: rekod.catatan
  };

  Object.entries(map).forEach(([idElemen, nilai]) => {
    if (el(idElemen)) {
      el(idElemen).value =
        teks(nilai);
    }
  });

  if (el("tajukModalVvipVipPentadbir")) {
    el("tajukModalVvipVipPentadbir").textContent =
      "Edit VVIP / VIP";
  }

  const modal =
    el("modalVvipVipPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.classList.add("open");
  }
}


function tutupModalVvipVipPentadbir() {
  const modal =
    el("modalVvipVipPentadbir");

  if (modal) {
    modal.classList.remove("open");
    modal.hidden = true;
  }

  kosongkanBorangVvipVipPentadbir();
}


async function simpanVvipVipPentadbir() {
  const btn =
    el("btnSimpanVvipVipPentadbir");

  const id =
    teks(
      el("idVvipVipPentadbir")?.value
    );

  const tarikh =
    teks(
      el("tarikhVvipVipPentadbir")?.value
    );

  const kategori =
    atas(
      el("kategoriVvipVipPentadbir")?.value
    );

  const nama =
    atas(
      el("namaVvipVipPentadbir")?.value
    );

  if (!tarikh || !kategori || !nama) {
    paparMesej(
      "statusModalVvipVipPentadbir",
      "Tarikh, Kategori dan Nama wajib diisi.",
      "error"
    );
    return;
  }

  const payload = {
    tarikh,
    kategori,
    nama,
    jawatan:
      atas(
        el("jawatanVvipVipPentadbir")?.value
      ) || null,
    agensi:
      atas(
        el("agensiVvipVipPentadbir")?.value
      ) || null,
    masa_tiba:
      teks(
        el("masaTibaVvipVipPentadbir")?.value
      ) || null,
    masa_beredar:
      teks(
        el("masaBeredarVvipVipPentadbir")?.value
      ) || null,
    lokasi:
      atas(
        el("lokasiVvipVipPentadbir")?.value
      ) || null,
    tujuan:
      atas(
        el("tujuanVvipVipPentadbir")?.value
      ) || null,
    catatan:
      atas(
        el("catatanVvipVipPentadbir")?.value
      ) || null,
    dikemaskini_oleh:
      adminLogin?.id || null
  };

  btn.disabled = true;
  btn.textContent =
    id
      ? "SEDANG MENGEMAS KINI..."
      : "SEDANG MENYIMPAN...";

  try {
    let hasil;

    if (id) {
      hasil =
        await denganHadMasa(
          db.from("vvip_vip_operasi")
            .update(payload)
            .eq("id", id)
            .select()
            .single()
        );
    } else {
      hasil =
        await denganHadMasa(
          db.from("vvip_vip_operasi")
            .insert({
              ...payload,
              dicipta_oleh:
                adminLogin?.id || null
            })
            .select()
            .single()
        );
    }

    if (hasil.error) throw hasil.error;

    if (el("tarikhCartaPentadbir")) {
      el("tarikhCartaPentadbir").value =
        tarikh;
    }

    await muatVvipVipOperasiPentadbir(
      tarikh,
      false
    );

    paparMesej(
      "statusVvipVipPentadbir",
      id
        ? "Rekod VVIP / VIP berjaya dikemas kini."
        : "Rekod VVIP / VIP berjaya ditambah.",
      "success"
    );

    tutupModalVvipVipPentadbir();

  } catch (error) {
    console.error(
      "Simpan VVIP/VIP gagal:",
      error
    );

    const mesej =
      ralatJadualVvipVipBelumWujud(error)
        ? "Jadual vvip_vip_operasi belum diwujudkan. Jalankan SQL yang disediakan dahulu."
        : error.message;

    paparMesej(
      "statusModalVvipVipPentadbir",
      `Gagal menyimpan: ${escapeHtml(mesej || "Ralat tidak diketahui.")}`,
      "error"
    );

  } finally {
    btn.disabled = false;
    btn.textContent =
      "SIMPAN VVIP / VIP";
  }
}


async function padamVvipVipPentadbir(id) {
  const rekod =
    dataVvipVipOperasiPentadbir.find(
      item =>
        teks(item.id) === teks(id)
    );

  if (!rekod) return;

  if (
    !confirm(
      `Padam ${rekod.kategori || "VIP"} ${rekod.nama || ""}?`
    )
  ) {
    return;
  }

  try {
    const { error } =
      await denganHadMasa(
        db.from("vvip_vip_operasi")
          .delete()
          .eq("id", id)
      );

    if (error) throw error;

    await muatVvipVipOperasiPentadbir(
      rekod.tarikh,
      false
    );

    paparMesej(
      "statusVvipVipPentadbir",
      "Rekod VVIP / VIP berjaya dipadam.",
      "success"
    );

  } catch (error) {
    console.error(
      "Padam VVIP/VIP gagal:",
      error
    );

    paparMesej(
      "statusVvipVipPentadbir",
      `Gagal memadam rekod: ${escapeHtml(error.message)}`,
      "error"
    );
  }
}


function formatMasaVvipVipPentadbir(nilai) {
  const masa = teks(nilai);
  if (!masa) return "-";

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(masa)) {
    return masa.slice(0, 5);
  }

  try {
    return formatMasaLaporanAdmin(masa);
  } catch (_) {
    return masa;
  }
}


function bolehBukaButiranVvipVipPentadbir(item) {
  return Boolean(item);
}



function kosongkanButiranVvipVipPentadbir() {
  idVvipVipDipilihPentadbir = "";

  const tajuk =
    el("tajukButiranVvipVipPentadbir");

  const ruang =
    el("butiranVvipVipPentadbir");

  if (tajuk) {
    tajuk.textContent =
      "PILIH VVIP / VIP";
  }

  if (ruang) {
    ruang.innerHTML = `
      <div class="admin-vvip-detail-empty">
        <strong>BUTIRAN PETUGAS</strong>
        <p>
          Klik mana-mana nama VVIP / VIP untuk melihat maklumat
          petugas yang menghantar laporan.
        </p>
      </div>
    `;
  }
}


function pilihVvipVipPentadbir(id) {
  const senarai =
    kumpulanVvipVipCarta();

  const item =
    senarai.find(
      rekod =>
        teks(rekod.id) === teks(id)
    );

  if (!item) {
    return;
  }

  idVvipVipDipilihPentadbir =
    item.id;

  document
    .querySelectorAll(
      ".admin-vvip-name-item"
    )
    .forEach(elemen =>
      elemen.classList.remove("active")
    );

  const aktif =
    document.querySelector(
      `.admin-vvip-name-item[data-vvip-id="${CSS.escape(String(item.id))}"]`
    );

  if (aktif) {
    aktif.classList.add("active");
  }

  paparButiranVvipVipPentadbir(
    item
  );
}


function paparButiranVvipVipPentadbir(item) {
  const tajuk =
    el("tajukButiranVvipVipPentadbir");

  const ruang =
    el("butiranVvipVipPentadbir");

  if (!tajuk || !ruang || !item) return;

  tajuk.textContent =
    item.nama || "VVIP / VIP";

  const petugasNama =
    teks(item.petugasNama) || "-";

  const noBadan =
    teks(item.noBadan) || "-";

  const lokasi =
    teks(
      item.tempatTugas ||
      item.lokasi
    ) || "-";

  const jenisTugas =
    teks(item.jenisTugasPetugas) || "-";

  const callSign =
    teks(item.callSign) || "-";

  ruang.innerHTML = `
    <div class="admin-vvip-detail-source">
      SUMBER: ${escapeHtml(item.sumber || "-")}
    </div>

    <div class="admin-vvip-detail-grid">
      <div class="admin-vvip-detail-wide">
        <span>Petugas :</span>
        <b>${escapeHtml(petugasNama)}</b>
      </div>

      <div>
        <span>No. Badan :</span>
        <b>${escapeHtml(noBadan)}</b>
      </div>

      <div>
        <span>Call Sign :</span>
        <b>${escapeHtml(callSign)}</b>
      </div>

      <div>
        <span>Lokasi :</span>
        <b>${escapeHtml(lokasi)}</b>
      </div>

      <div>
        <span>Jenis Tugas :</span>
        <b>${escapeHtml(jenisTugas)}</b>
      </div>
    </div>
  `;
}

function paparCartaVvipVipPentadbir() {
  const ruang =
    el("senaraiCartaVvipVip");

  const jumlah =
    el("jumlahSenaraiVvipVipPentadbir");

  if (!ruang) return;

  const senarai =
    kumpulanVvipVipCarta();

  if (jumlah) {
    jumlah.textContent =
      `${senarai.length.toLocaleString("ms-MY")} REKOD`;
  }

  if (!senarai.length) {
    ruang.innerHTML =
      '<div class="empty-row">Tiada maklumat VVIP / VIP untuk tarikh ini.</div>';

    kosongkanButiranVvipVipPentadbir();
    return;
  }

  /*
    Jika rekod yang sedang dipilih sudah tiada selepas refresh,
    kosongkan panel kanan.
  */
  if (
    idVvipVipDipilihPentadbir &&
    !senarai.some(
      item =>
        teks(item.id) ===
        teks(idVvipVipDipilihPentadbir)
    )
  ) {
    kosongkanButiranVvipVipPentadbir();
  }

  ruang.innerHTML =
    senarai.map((item, index) => {
      const bolehBukaButiran =
        bolehBukaButiranVvipVipPentadbir(item);

      const aktif =
        bolehBukaButiran &&
        teks(item.id) ===
          teks(idVvipVipDipilihPentadbir);

      const tindakanManual =
        item.jenisRekod === "MANUAL"
          ? `
            <div class="admin-vvip-manual-actions">
              <button
                class="admin-committee-edit-button"
                type="button"
                onclick="event.stopPropagation();bukaEditVvipVipPentadbir('${escapeHtml(item.id)}')"
              >
                EDIT
              </button>

              <button
                class="admin-committee-delete-button"
                type="button"
                onclick="event.stopPropagation();padamVvipVipPentadbir('${escapeHtml(item.id)}')"
              >
                PADAM
              </button>
            </div>
          `
          : "";

      const petunjuk =
        bolehBukaButiran
          ? `
            <span class="admin-vvip-open-hint">
              KLIK UNTUK BUTIRAN
            </span>
          `
          : "";

      return `
        <article
          class="admin-vvip-name-item ${bolehBukaButiran ? "clickable" : "manual"} ${aktif ? "active" : ""}"
          data-vvip-id="${escapeHtml(item.id)}"
          ${
            bolehBukaButiran
              ? `onclick="pilihVvipVipPentadbir('${escapeHtml(item.id)}')"`
              : ""
          }
        >
          <span class="admin-vvip-name-number">
            ${index + 1}
          </span>

          <div class="admin-vvip-name-main">
            <strong>
              ${escapeHtml(item.kategori || "VVIP / VIP")}
              — ${escapeHtml(item.nama || "-")}
            </strong>

            <small>
              SUMBER: ${escapeHtml(item.sumber || "-")}
            </small>

            ${petunjuk}
            ${tindakanManual}
          </div>
        </article>
      `;
    }).join("");

  /*
    Kekalkan butiran yang sedang dipilih selepas render semula.
  */
  if (idVvipVipDipilihPentadbir) {
    const dipilih =
      senarai.find(
        item =>
          teks(item.id) ===
          teks(idVvipVipDipilihPentadbir)
      );

    if (dipilih) {
      paparButiranVvipVipPentadbir(
        dipilih
      );
    }
  }
}


/* ================================================================
   JAWATANKUASA OPERASI — SUPABASE CRUD
================================================================ */

function dataJawatankuasaPentadbir() {
  return [...dataJawatankuasaOperasiPentadbir]
    .sort((a, b) => {
      const kumpulanA =
        atas(a.jawatankuasa);

      const kumpulanB =
        atas(b.jawatankuasa);

      if (
        kumpulanA !== kumpulanB
      ) {
        return kumpulanA.localeCompare(
          kumpulanB,
          "ms"
        );
      }

      const tugasA =
        atas(a.tugas);

      const tugasB =
        atas(b.tugas);

      if (tugasA !== tugasB) {
        return tugasA.localeCompare(
          tugasB,
          "ms"
        );
      }

      return atas(a.nama).localeCompare(
        atas(b.nama),
        "ms"
      );
    });
}


function teksPangkatNoNamaJawatankuasaPentadbir(item) {
  return [
    teks(item.pangkat),
    teks(item.no_badan),
    teks(item.nama)
  ]
    .filter(
      nilai =>
        nilai &&
        nilai !== "-"
    )
    .join(" ") || "-";
}


function ralatJadualJawatankuasaBelumWujud(error) {
  return (
    error?.code === "42P01" ||
    /jawatankuasa_operasi|relation.*does not exist|could not find.*table/i.test(
      error?.message || ""
    )
  );
}


async function muatJawatankuasaOperasiPentadbir(
  tarikh,
  paparStatus = true
) {
  const tarikhDipilih =
    tarikh ||
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  try {
    const { data, error } =
      await denganHadMasa(
        db.from("jawatankuasa_operasi")
          .select("*")
          .eq("tarikh", tarikhDipilih)
          .order("jawatankuasa", { ascending: true })
          .order("tugas", { ascending: true })
          .order("nama", { ascending: true })
      );

    if (error) throw error;

    dataJawatankuasaOperasiPentadbir =
      data || [];

    paparCartaJawatankuasaPentadbir();

    if (paparStatus) {
      paparMesej(
        "statusJawatankuasaPentadbir",
        `${dataJawatankuasaOperasiPentadbir.length} rekod jawatankuasa berjaya dimuatkan.`,
        "success"
      );
    }

    return true;

  } catch (error) {
    console.error(
      "Gagal memuatkan jawatankuasa:",
      error
    );

    dataJawatankuasaOperasiPentadbir = [];
    paparCartaJawatankuasaPentadbir();

    const mesej =
      ralatJadualJawatankuasaBelumWujud(error)
        ? "Jadual jawatankuasa_operasi belum diwujudkan. Jalankan fail SQL yang disediakan dalam Supabase SQL Editor."
        : `Ralat jawatankuasa: ${error.message || "Ralat tidak diketahui."}`;

    paparMesej(
      "statusJawatankuasaPentadbir",
      escapeHtml(mesej),
      "error"
    );

    /*
      Jangan rosakkan carta lain jika table Jawatankuasa
      belum diwujudkan.
    */
    return false;
  }
}


async function muatSemulaJawatankuasaPentadbir() {
  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  await muatJawatankuasaOperasiPentadbir(
    tarikh,
    true
  );
}


async function muatPilihanPetugasJawatankuasaPentadbir() {
  const select =
    el("petugasJawatankuasaPentadbir");

  if (!select) return;

  select.disabled = true;
  select.innerHTML =
    '<option value="">SEDANG MEMUATKAN PETUGAS...</option>';

  try {
    const { data, error } =
      await denganHadMasa(
        db.from("profiles")
          .select("*")
          .order("nama", { ascending: true })
      );

    if (error) throw error;

    dataPilihanPetugasJawatankuasaPentadbir =
      (data || [])
        .filter(item =>
          item.aktif !== false
        );

    select.innerHTML =
      '<option value="">PILIH PETUGAS</option>' +
      dataPilihanPetugasJawatankuasaPentadbir
        .map(item => {
          const label = [
            teks(item.pangkat),
            teks(item.no_badan),
            teks(item.nama)
          ]
            .filter(Boolean)
            .join(" ");

          return `
            <option value="${escapeHtml(item.id || "")}">
              ${escapeHtml(label || item.no_badan || item.nama || "-")}
            </option>
          `;
        })
        .join("");

  } catch (error) {
    console.error(
      "Gagal memuat pilihan petugas:",
      error
    );

    dataPilihanPetugasJawatankuasaPentadbir = [];

    select.innerHTML =
      '<option value="">GAGAL MEMUATKAN PETUGAS</option>';

    paparMesej(
      "statusModalJawatankuasaPentadbir",
      `Gagal mendapatkan senarai petugas: ${escapeHtml(error.message)}`,
      "error"
    );

  } finally {
    select.disabled = false;
  }
}


function petugasPilihanJawatankuasaPentadbir() {
  const id =
    teks(
      el(
        "petugasJawatankuasaPentadbir"
      )?.value
    );

  return (
    dataPilihanPetugasJawatankuasaPentadbir
      .find(item =>
        teks(item.id) === id
      ) ||
    null
  );
}


function kemasKiniPreviewPetugasJawatankuasaPentadbir(
  petugas
) {
  const nilai = {
    previewPangkatJawatankuasa:
      petugas?.pangkat || "-",

    previewNoBadanJawatankuasa:
      petugas?.no_badan || "-",

    previewNamaJawatankuasa:
      petugas?.nama || "-",

    previewTelefonJawatankuasa:
      petugas?.telefon ||
      petugas?.no_telefon ||
      "-"
  };

  Object.entries(nilai)
    .forEach(([id, teksPaparan]) => {
      if (el(id)) {
        el(id).textContent =
          teks(teksPaparan) || "-";
      }
    });
}


function pilihPetugasJawatankuasaPentadbir() {
  const petugas =
    petugasPilihanJawatankuasaPentadbir();

  kemasKiniPreviewPetugasJawatankuasaPentadbir(
    petugas
  );

  /*
    Unit boleh dicadangkan daripada profil,
    tetapi masih boleh diubah oleh Pentadbir.
  */
  const unitInput =
    el("unitJawatankuasaPentadbir");

  if (
    petugas &&
    unitInput &&
    !teks(unitInput.value)
  ) {
    unitInput.value =
      petugas.bahagian ||
      petugas.balai ||
      petugas.cawangan ||
      petugas.unit ||
      petugas.bahagian_unit ||
      "";
  }
}


function kosongkanBorangJawatankuasaPentadbir() {
  rekodJawatankuasaSedangEditPentadbir = null;

  if (el("idJawatankuasaPentadbir")) {
    el("idJawatankuasaPentadbir").value = "";
  }

  if (el("petugasJawatankuasaPentadbir")) {
    el("petugasJawatankuasaPentadbir").value = "";
  }

  if (el("namaJawatankuasaPentadbir")) {
    el("namaJawatankuasaPentadbir").value = "";
  }

  if (el("unitJawatankuasaPentadbir")) {
    el("unitJawatankuasaPentadbir").value = "";
  }

  if (el("tugasJawatankuasaPentadbir")) {
    el("tugasJawatankuasaPentadbir").value = "";
  }

  kemasKiniPreviewPetugasJawatankuasaPentadbir(
    null
  );

  const status =
    el("statusModalJawatankuasaPentadbir");

  if (status) {
    status.className = "status-box";
    status.innerHTML = "";
  }
}


async function bukaTambahJawatankuasaPentadbir() {
  kosongkanBorangJawatankuasaPentadbir();

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  if (el("tarikhJawatankuasaPentadbir")) {
    el("tarikhJawatankuasaPentadbir").value =
      tarikh;
  }

  if (el("tajukModalJawatankuasaPentadbir")) {
    el("tajukModalJawatankuasaPentadbir").textContent =
      "Tambah Jawatankuasa";
  }

  const modal =
    el("modalJawatankuasaPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.classList.add("open");
  }

  await muatPilihanPetugasJawatankuasaPentadbir();
}


async function bukaEditJawatankuasaPentadbir(id) {
  const rekod =
    dataJawatankuasaOperasiPentadbir.find(
      item =>
        teks(item.id) === teks(id)
    );

  if (!rekod) {
    alert(
      "Rekod jawatankuasa tidak dijumpai."
    );
    return;
  }

  rekodJawatankuasaSedangEditPentadbir =
    rekod;

  const modal =
    el("modalJawatankuasaPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.classList.add("open");
  }

  if (el("tajukModalJawatankuasaPentadbir")) {
    el("tajukModalJawatankuasaPentadbir").textContent =
      "Edit Jawatankuasa";
  }

  await muatPilihanPetugasJawatankuasaPentadbir();

  if (el("idJawatankuasaPentadbir")) {
    el("idJawatankuasaPentadbir").value =
      rekod.id || "";
  }

  if (el("tarikhJawatankuasaPentadbir")) {
    el("tarikhJawatankuasaPentadbir").value =
      rekod.tarikh || "";
  }

  if (el("petugasJawatankuasaPentadbir")) {
    el("petugasJawatankuasaPentadbir").value =
      rekod.petugas_id || "";
  }

  if (el("namaJawatankuasaPentadbir")) {
    el("namaJawatankuasaPentadbir").value =
      rekod.jawatankuasa || "";
  }

  if (el("unitJawatankuasaPentadbir")) {
    el("unitJawatankuasaPentadbir").value =
      rekod.unit || "";
  }

  if (el("tugasJawatankuasaPentadbir")) {
    el("tugasJawatankuasaPentadbir").value =
      rekod.tugas || "";
  }

  const petugas =
    petugasPilihanJawatankuasaPentadbir();

  kemasKiniPreviewPetugasJawatankuasaPentadbir(
    petugas || {
      pangkat: rekod.pangkat,
      no_badan: rekod.no_badan,
      nama: rekod.nama,
      telefon: rekod.telefon
    }
  );
}


function tutupModalJawatankuasaPentadbir() {
  const modal =
    el("modalJawatankuasaPentadbir");

  if (modal) {
    modal.classList.remove("open");
    modal.hidden = true;
  }

  kosongkanBorangJawatankuasaPentadbir();
}


async function simpanJawatankuasaPentadbir() {
  const btn =
    el("btnSimpanJawatankuasaPentadbir");

  const id =
    teks(
      el("idJawatankuasaPentadbir")?.value
    );

  const tarikh =
    teks(
      el("tarikhJawatankuasaPentadbir")?.value
    );

  const petugas =
    petugasPilihanJawatankuasaPentadbir();

  const jawatankuasa =
    atas(
      el("namaJawatankuasaPentadbir")?.value
    );

  const unit =
    atas(
      el("unitJawatankuasaPentadbir")?.value
    );

  const tugas =
    atas(
      el("tugasJawatankuasaPentadbir")?.value
    );

  if (
    !tarikh ||
    !petugas ||
    !jawatankuasa ||
    !unit ||
    !tugas
  ) {
    paparMesej(
      "statusModalJawatankuasaPentadbir",
      "Lengkapkan Tarikh, Petugas, Jawatankuasa, Unit dan Tugas.",
      "error"
    );
    return;
  }

  const payload = {
    tarikh,
    petugas_id: petugas.id,
    jawatankuasa,
    unit,
    tugas,
    pangkat: atas(petugas.pangkat),
    no_badan: atas(petugas.no_badan),
    nama: atas(petugas.nama),
    telefon:
      teks(
        petugas.telefon ||
        petugas.no_telefon
      ),
    dikemaskini_oleh:
      adminLogin?.id || null
  };

  btn.disabled = true;
  btn.textContent =
    id
      ? "SEDANG MENGEMAS KINI..."
      : "SEDANG MENYIMPAN...";

  try {
    let hasil;

    if (id) {
      hasil =
        await denganHadMasa(
          db.from("jawatankuasa_operasi")
            .update(payload)
            .eq("id", id)
            .select()
            .single()
        );
    } else {
      hasil =
        await denganHadMasa(
          db.from("jawatankuasa_operasi")
            .insert({
              ...payload,
              dicipta_oleh:
                adminLogin?.id || null
            })
            .select()
            .single()
        );
    }

    if (hasil.error) {
      throw hasil.error;
    }

    const tarikhCarta =
      el("tarikhCartaPentadbir");

    if (tarikhCarta) {
      tarikhCarta.value =
        tarikh;
    }

    paparMesej(
      "statusModalJawatankuasaPentadbir",
      id
        ? "Rekod jawatankuasa berjaya dikemas kini."
        : "Rekod jawatankuasa berjaya ditambah.",
      "success"
    );

    await muatJawatankuasaOperasiPentadbir(
      tarikh,
      false
    );

    setTimeout(
      () =>
        tutupModalJawatankuasaPentadbir(),
      450
    );

  } catch (error) {
    console.error(
      "Simpan jawatankuasa gagal:",
      error
    );

    const mesej =
      ralatJadualJawatankuasaBelumWujud(error)
        ? "Jadual jawatankuasa_operasi belum diwujudkan. Jalankan SQL yang disediakan dahulu."
        : error.message;

    paparMesej(
      "statusModalJawatankuasaPentadbir",
      `Gagal menyimpan: ${escapeHtml(mesej || "Ralat tidak diketahui.")}`,
      "error"
    );

  } finally {
    btn.disabled = false;
    btn.textContent =
      "SIMPAN JAWATANKUASA";
  }
}


async function padamJawatankuasaPentadbir(id) {
  const rekod =
    dataJawatankuasaOperasiPentadbir.find(
      item =>
        teks(item.id) === teks(id)
    );

  if (!rekod) return;

  if (
    !confirm(
      `Padam ${rekod.pangkat || ""} ${rekod.nama || ""} daripada ${rekod.jawatankuasa || "jawatankuasa"}?`
    )
  ) {
    return;
  }

  try {
    const { error } =
      await denganHadMasa(
        db.from("jawatankuasa_operasi")
          .delete()
          .eq("id", id)
      );

    if (error) throw error;

    await muatJawatankuasaOperasiPentadbir(
      rekod.tarikh,
      false
    );

    paparMesej(
      "statusJawatankuasaPentadbir",
      "Rekod jawatankuasa berjaya dipadam.",
      "success"
    );

  } catch (error) {
    console.error(
      "Padam jawatankuasa gagal:",
      error
    );

    paparMesej(
      "statusJawatankuasaPentadbir",
      `Gagal memadam rekod: ${escapeHtml(error.message)}`,
      "error"
    );
  }
}


function paparCartaJawatankuasaPentadbir() {
  const tbody =
    el("tbodyJawatankuasaPentadbir");

  if (!tbody) return;

  if (cartaJawatankuasaPentadbir) {
    kemusnahkanCartaPentadbir(
      cartaJawatankuasaPentadbir
    );

    cartaJawatankuasaPentadbir = null;
  }

  const senarai =
    dataJawatankuasaPentadbir();

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    "";

  if (el("tajukJawatankuasaPentadbir")) {
    el("tajukJawatankuasaPentadbir").textContent =
      tarikh
        ? `JAWATANKUASA OPERASI — ${formatTarikhMalaysia(tarikh)}`
        : "JAWATANKUASA OPERASI";
  }

  if (!senarai.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">
          Tiada rekod jawatankuasa untuk tarikh ini.
        </td>
      </tr>
    `;
    return;
  }

  let kumpulanSemasa = "";
  let bil = 0;
  const baris = [];

  senarai.forEach(item => {
    const kumpulan =
      atas(item.jawatankuasa) ||
      "LAIN-LAIN";

    if (
      kumpulan !==
      kumpulanSemasa
    ) {
      kumpulanSemasa =
        kumpulan;

      baris.push(`
        <tr class="admin-committee-group-row">
          <td colspan="5">
            ${escapeHtml(kumpulan)}
          </td>
        </tr>
      `);
    }

    bil += 1;

    baris.push(`
      <tr>
        <td class="col-bil">
          ${bil}
        </td>

        <td class="col-nama">
          ${escapeHtml(
            teksPangkatNoNamaJawatankuasaPentadbir(
              item
            )
          )}
        </td>

        <td class="col-unit">
          ${escapeHtml(
            item.unit || "-"
          )}
        </td>

        <td class="col-tugas">
          <div class="admin-committee-task-text">
            ${escapeHtml(
              item.tugas || "-"
            )}
          </div>

          <div class="admin-committee-row-actions">
            <button
              class="admin-committee-edit-button"
              type="button"
              onclick="bukaEditJawatankuasaPentadbir('${escapeHtml(item.id)}')"
            >
              EDIT
            </button>

            <button
              class="admin-committee-delete-button"
              type="button"
              onclick="padamJawatankuasaPentadbir('${escapeHtml(item.id)}')"
            >
              PADAM
            </button>
          </div>
        </td>

        <td class="col-telefon">
          ${escapeHtml(
            item.telefon || "-"
          )}
        </td>
      </tr>
    `);
  });

  tbody.innerHTML =
    baris.join("");
}


function pilihanCartaPentadbir(
  tajukPakis = ""
) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index"
    },
    plugins: {
      legend: {
        labels: {
          color: "#eeeeee"
        }
      },
      tooltip: {
        enabled: true
      }
    },
    scales: {
      x: {
        ticks: {
          color: "#c8c8c8"
        },
        grid: {
          color: "rgba(255,255,255,.06)"
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#c8c8c8",
          precision: 0
        },
        grid: {
          color: "rgba(255,255,255,.06)"
        },
        title: {
          display: Boolean(tajukPakis),
          text: tajukPakis,
          color: "#c8c8c8"
        }
      }
    }
  };
}


function tukarPaparanCartaPentadbir(
  pilihan
) {
  const nilai =
    atas(pilihan || "SEMUA");

  document
    .querySelectorAll(
      "#modulCartaPentadbir [data-chart-section]"
    )
    .forEach(section => {
      const kategori =
        atas(
          section.getAttribute(
            "data-chart-section"
          )
        );

      section.hidden =
        nilai !== "SEMUA" &&
        kategori !== nilai;
    });
}


/* ================================================================
   PETA LOKASI PENUGASAN
================================================================ */

function tetapanPetaCartaPentadbir() {
  try {
    const data =
      JSON.parse(
        localStorage.getItem(
          KUNCI_TETAPAN_PETA_CARTA_MOTOGP
        ) ||
        "{}"
      );

    return {
      imej:
        data.imej ||
        "images/peta.png",
      marker:
        data.marker &&
        typeof data.marker === "object"
          ? data.marker
          : {}
    };
  } catch (_) {
    return {
      imej: "images/peta.png",
      marker: {}
    };
  }
}


function simpanTetapanPetaCartaTempatan(
  data
) {
  localStorage.setItem(
    KUNCI_TETAPAN_PETA_CARTA_MOTOGP,
    JSON.stringify(data)
  );
}


function lokasiUnikCartaPentadbir() {
  return [
    ...new Set(
      dataDashboard
        .map(item =>
          teks(item.tempatTugas)
        )
        .filter(item =>
          item &&
          item !== "-"
        )
    )
  ].sort(
    (a, b) =>
      a.localeCompare(b, "ms")
  );
}


function posisiAutomatikMarker(
  index,
  jumlah
) {
  const kolum =
    Math.max(
      2,
      Math.ceil(
        Math.sqrt(jumlah || 1)
      )
    );

  const baris =
    Math.max(
      1,
      Math.ceil(
        (jumlah || 1) / kolum
      )
    );

  const xIndex =
    index % kolum;

  const yIndex =
    Math.floor(index / kolum);

  return {
    x:
      ((xIndex + 1) /
      (kolum + 1)) *
      100,

    y:
      ((yIndex + 1) /
      (baris + 1)) *
      100,

    status: "NORMAL"
  };
}



function kemasKiniButangMarkerPetaPentadbir() {
  const butang =
    el("btnToggleMarkerPetaPentadbir");

  if (!butang) return;

  if (markerPetaDipaparkanPentadbir) {
    butang.textContent = "TUTUP MARKER";
    butang.setAttribute("aria-pressed", "true");
    butang.classList.remove("marker-hidden");
  } else {
    butang.textContent = "PAPAR MARKER";
    butang.setAttribute("aria-pressed", "false");
    butang.classList.add("marker-hidden");
  }
}


function setPaparanMarkerPetaPentadbir(papar) {
  markerPetaDipaparkanPentadbir =
    Boolean(papar);

  const lapisan =
    el("lapisanMarkerPetaPentadbir");

  if (lapisan) {
    lapisan.hidden =
      !markerPetaDipaparkanPentadbir;

    lapisan.style.display =
      markerPetaDipaparkanPentadbir
        ? ""
        : "none";
  }

  /*
    Apabila marker ditutup, panel maklumat lokasi juga disembunyikan
    supaya paparan benar-benar hanya gambar peta.
  */
  const panel =
    el("panelLokasiPetaPentadbir");

  if (panel) {
    panel.classList.toggle(
      "marker-panel-hidden",
      !markerPetaDipaparkanPentadbir
    );
  }

  const layout =
    document.querySelector(
      "#kadCartaPeta .admin-operation-map-layout"
    );

  if (layout) {
    layout.classList.toggle(
      "markers-off",
      !markerPetaDipaparkanPentadbir
    );
  }

  kemasKiniButangMarkerPetaPentadbir();
}


function toggleMarkerPetaPentadbir() {
  setPaparanMarkerPetaPentadbir(
    !markerPetaDipaparkanPentadbir
  );
}


function muatPetaCartaPentadbir() {
  const tetapan =
    tetapanPetaCartaPentadbir();

  const imej =
    el("imejPetaCartaPentadbir");

  if (imej) {
    imej.src =
      tetapan.imej ||
      "images/peta.png";
  }

  const imejUrus =
    el("imejUrusPetaPentadbir");

  if (imejUrus) {
    imejUrus.src =
      tetapan.imej ||
      "images/peta.png";
  }

  binaPilihanLokasiMarkerPentadbir();
  paparMarkerPetaPentadbir();
  paparMarkerUrusPetaPentadbir();
  pasangZoomPetaPentadbir();
  setPaparanMarkerPetaPentadbir(
    markerPetaDipaparkanPentadbir
  );
}


function dataPetugasLokasiPentadbir(
  lokasi
) {
  const namaLokasi =
    atas(lokasi);

  return dataDashboard.filter(
    item =>
      atas(item.tempatTugas) ===
      namaLokasi
  );
}


function statusPetugasLokasiPentadbir(
  item
) {
  if (item.checkout) {
    return "SELESAI";
  }

  if (
    item.statusKehadiran === "HADIR"
  ) {
    return "BERTUGAS";
  }

  return "BELUM_HADIR";
}


function paparMarkerPetaPentadbir() {
  const lapisan =
    el("lapisanMarkerPetaPentadbir");

  if (!lapisan) return;

  const lokasi =
    lokasiUnikCartaPentadbir();

  const tetapan =
    tetapanPetaCartaPentadbir();

  lapisan.innerHTML =
    lokasi.map((nama, index) => {
      const posisi =
        tetapan.marker?.[nama] ||
        posisiAutomatikMarker(
          index,
          lokasi.length
        );

      const petugas =
        dataPetugasLokasiPentadbir(
          nama
        );

      const bertugas =
        petugas.filter(
          item =>
            statusPetugasLokasiPentadbir(
              item
            ) === "BERTUGAS"
        ).length;

      const status =
        atas(
          posisi.status ||
          "NORMAL"
        );

      return `
        <button
          class="admin-map-marker admin-map-marker-${escapeHtml(status.toLowerCase())}"
          type="button"
          style="
            left:${Number(posisi.x).toFixed(3)}%;
            top:${Number(posisi.y).toFixed(3)}%;
          "
          onclick="pilihMarkerLokasiPentadbir('${escapeHtml(
            nama.replace(/'/g, "\\'")
          )}')"
          title="${escapeHtml(nama)}"
        >
          <span class="admin-map-marker-count">
            ${bertugas}/${petugas.length}
          </span>
          <span class="admin-map-marker-label">
            ${escapeHtml(nama)}
          </span>
        </button>
      `;
    }).join("");
}


function pilihMarkerLokasiPentadbir(
  lokasi
) {
  lokasiPetaDipilihPentadbir =
    lokasi;

  tabPetugasLokasiAktif =
    "BERTUGAS";

  const kosong =
    el("panelLokasiPetaPentadbir")
      ?.querySelector(
        ".admin-map-location-empty"
      );

  if (kosong) {
    kosong.style.display = "none";
  }

  const kandungan =
    el("kandunganLokasiPetaPentadbir");

  if (kandungan) {
    kandungan.hidden = false;
    kandungan.removeAttribute("hidden");
  }

  paparPanelLokasiPentadbir();
}


function paparPanelLokasiPentadbir() {
  if (!lokasiPetaDipilihPentadbir) {
    return;
  }

  const senarai =
    dataPetugasLokasiPentadbir(
      lokasiPetaDipilihPentadbir
    );

  const kategori = {
    BERTUGAS:
      senarai.filter(
        item =>
          statusPetugasLokasiPentadbir(
            item
          ) === "BERTUGAS"
      ),

    BELUM_HADIR:
      senarai.filter(
        item =>
          statusPetugasLokasiPentadbir(
            item
          ) === "BELUM_HADIR"
      ),

    SELESAI:
      senarai.filter(
        item =>
          statusPetugasLokasiPentadbir(
            item
          ) === "SELESAI"
      )
  };

  const tetapan =
    tetapanPetaCartaPentadbir();

  const status =
    atas(
      tetapan.marker?.[
        lokasiPetaDipilihPentadbir
      ]?.status ||
      "NORMAL"
    );

  if (el("namaLokasiPetaPentadbir")) {
    el("namaLokasiPetaPentadbir")
      .textContent =
      lokasiPetaDipilihPentadbir;
  }

  if (el("statusLokasiPetaPentadbir")) {
    el("statusLokasiPetaPentadbir")
      .textContent =
      status;
  }

  if (el("jumlahDitugaskanLokasi")) {
    el("jumlahDitugaskanLokasi")
      .textContent =
      senarai.length;
  }

  if (el("jumlahBertugasLokasi")) {
    el("jumlahBertugasLokasi")
      .textContent =
      kategori.BERTUGAS.length;
  }

  if (el("jumlahBelumHadirLokasi")) {
    el("jumlahBelumHadirLokasi")
      .textContent =
      kategori.BELUM_HADIR.length;
  }

  if (el("jumlahSelesaiLokasi")) {
    el("jumlahSelesaiLokasi")
      .textContent =
      kategori.SELESAI.length;
  }

  ["BERTUGAS", "BELUM_HADIR", "SELESAI"]
    .forEach(kategoriTab => {
      const id =
        kategoriTab === "BERTUGAS"
          ? "tabLokasiBertugas"
          : kategoriTab === "BELUM_HADIR"
            ? "tabLokasiBelumHadir"
            : "tabLokasiSelesai";

      el(id)?.classList.toggle(
        "active",
        tabPetugasLokasiAktif ===
          kategoriTab
      );
    });

  paparSenaraiPetugasLokasiPentadbir(
    kategori[
      tabPetugasLokasiAktif
    ] || []
  );
}


function tukarTabPetugasLokasi(
  tab
) {
  tabPetugasLokasiAktif =
    tab;

  paparPanelLokasiPentadbir();
}


function paparSenaraiPetugasLokasiPentadbir(
  senarai
) {
  const ruang =
    el("senaraiPetugasLokasiPeta");

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML =
      '<div class="empty-row">Tiada petugas untuk dipaparkan.</div>';
    return;
  }

  ruang.innerHTML =
    senarai.map((item, index) => `
      <article class="admin-map-personnel-card">
        <div class="admin-map-personnel-number">
          ${index + 1}
        </div>

        <div class="admin-map-personnel-main">
          <strong>
            ${escapeHtml(item.pangkat || "")}
            ${escapeHtml(item.nama || "-")}
          </strong>

          <div class="admin-map-personnel-meta">
            <span>No Badan: ${escapeHtml(item.noBadan || "-")}</span>
            <span>Call Sign: ${escapeHtml(item.callSign || "-")}</span>
            <span>Tugas: ${escapeHtml(item.jenisTugas || "-")}</span>
            ${
              item.penyelia
                ? '<span class="badge badge-yellow">PENYELIA</span>'
                : ""
            }
            ${
              item.pemegangSet
                ? '<span class="badge badge-blue">PEMEGANG SET</span>'
                : ""
            }
          </div>

          ${
            item.masaCheckin
              ? `
                <small>
                  Check-In:
                  ${escapeHtml(
                    formatTarikhMasa(
                      item.masaCheckin
                    )
                  )}
                </small>
              `
              : ""
          }
        </div>
      </article>
    `).join("");
}


function binaPilihanLokasiMarkerPentadbir() {
  const select =
    el("pilihanLokasiMarkerPentadbir");

  if (!select) return;

  const semasa =
    select.value;

  const lokasi =
    lokasiUnikCartaPentadbir();

  select.innerHTML =
    '<option value="">PILIH TEMPAT TUGAS</option>' +
    lokasi.map(item => `
      <option value="${escapeHtml(item)}">
        ${escapeHtml(item)}
      </option>
    `).join("");

  if (lokasi.includes(semasa)) {
    select.value = semasa;
  }

  if (!select.dataset.listenerLokasiMarker) {
    select.dataset.listenerLokasiMarker = "1";

    select.addEventListener("change", () => {
      const nama = teks(select.value);

      if (el("lokasiMarkerDipilihPentadbir")) {
        el("lokasiMarkerDipilihPentadbir").textContent =
          nama || "BELUM DIPILIH";
      }

      const tetapan = tetapanPetaCartaPentadbir();
      const status = atas(
        tetapan.marker?.[nama]?.status ||
        "NORMAL"
      );

      if (el("statusMarkerPentadbir")) {
        el("statusMarkerPentadbir").value = status;
      }
    });
  }
}


function bukaUrusPetaPentadbir() {
  const modal =
    el("modalUrusPetaPentadbir");

  if (!modal) {
    alert(
      "Modal Urus Peta belum terdapat dalam admin.html."
    );
    return;
  }

  binaPilihanLokasiMarkerPentadbir();
  muatPetaCartaPentadbir();

  if (el("lokasiMarkerDipilihPentadbir")) {
    const lokasiSemasa =
      el("pilihanLokasiMarkerPentadbir")?.value || "";

    el("lokasiMarkerDipilihPentadbir").textContent =
      lokasiSemasa || "BELUM DIPILIH";
  }

  modal.hidden = false;
  modal.removeAttribute("hidden");
  modal.classList.add("open");

  document.body.classList.add(
    "modal-open"
  );
}


function tutupUrusPetaPentadbir() {
  const modal =
    el("modalUrusPetaPentadbir");

  if (!modal) return;

  modal.classList.remove("open");
  modal.hidden = true;
  modal.setAttribute("hidden", "");

  document.body.classList.remove(
    "modal-open"
  );
}


function pratontonPetaPentadbir(
  event
) {
  const fail =
    event?.target?.files?.[0];

  if (!fail) return;

  if (
    !/^image\/(jpeg|png|webp)$/i.test(
      fail.type || ""
    )
  ) {
    paparMesej(
      "statusUrusPetaPentadbir",
      "Gunakan gambar JPG, PNG atau WEBP.",
      "error"
    );
    return;
  }

  /*
    localStorage mempunyai had saiz.
    Hadkan fail untuk fungsi tempatan ini.
  */
  if (fail.size > 2.5 * 1024 * 1024) {
    paparMesej(
      "statusUrusPetaPentadbir",
      "Gambar terlalu besar. Untuk versi ini gunakan gambar tidak melebihi 2.5 MB.",
      "error"
    );
    return;
  }

  const pembaca =
    new FileReader();

  pembaca.onload = () => {
    const hasil =
      String(pembaca.result || "");

    const imej =
      el("imejUrusPetaPentadbir");

    if (imej) {
      imej.src = hasil;
      imej.dataset.imejBaharu = hasil;
    }
  };

  pembaca.readAsDataURL(fail);
}


function paparMarkerUrusPetaPentadbir() {
  const lapisan =
    el("lapisanMarkerUrusPetaPentadbir");

  if (!lapisan) return;

  const lokasi =
    lokasiUnikCartaPentadbir();

  const tetapan =
    tetapanPetaCartaPentadbir();

  lapisan.innerHTML =
    lokasi.map((nama, index) => {
      const posisi =
        tetapan.marker?.[nama] ||
        posisiAutomatikMarker(
          index,
          lokasi.length
        );

      const status =
        atas(posisi.status || "NORMAL");

      const namaAtribut =
        escapeHtml(nama);

      const namaJs =
        nama
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'");

      return `
        <button
          class="admin-map-marker admin-map-marker-manage admin-map-marker-${escapeHtml(status.toLowerCase())}"
          type="button"
          style="
            left:${Number(posisi.x).toFixed(3)}%;
            top:${Number(posisi.y).toFixed(3)}%;
          "
          data-lokasi="${namaAtribut}"
          title="Seret untuk pindahkan: ${namaAtribut}"
          onpointerdown="mulaSeretMarkerPetaPentadbir(event, '${namaJs}')"
          onclick="event.stopPropagation(); pilihLokasiUrusMarkerPentadbir('${namaJs}')"
        >
          <span class="admin-map-marker-label">
            ${namaAtribut}
          </span>
        </button>
      `;
    }).join("");

  const kanvas =
    el("kanvasUrusPetaPentadbir");

  if (
    kanvas &&
    !kanvas.dataset.listenerMarker
  ) {
    kanvas.dataset.listenerMarker =
      "1";

    kanvas.addEventListener(
      "click",
      event => {
        if (sedangSeretMarkerPetaPentadbir) {
          return;
        }

        letakMarkerPetaPentadbir(event);
      }
    );
  }
}


function pilihLokasiUrusMarkerPentadbir(lokasi) {
  const select =
    el("pilihanLokasiMarkerPentadbir");

  if (select) {
    select.value = lokasi;
    select.dispatchEvent(
      new Event("change")
    );
  }
}


function mulaSeretMarkerPetaPentadbir(event, lokasi) {
  event.preventDefault();
  event.stopPropagation();

  sedangSeretMarkerPetaPentadbir = true;
  lokasiMarkerSeretPentadbir = lokasi;
  kanvasMarkerSeretPentadbir =
    el("kanvasUrusPetaPentadbir");

  pilihLokasiUrusMarkerPentadbir(lokasi);

  document.body.classList.add(
    "marker-dragging"
  );

  window.addEventListener(
    "pointermove",
    gerakSeretMarkerPetaPentadbir
  );

  window.addEventListener(
    "pointerup",
    tamatSeretMarkerPetaPentadbir,
    { once: true }
  );
}


function gerakSeretMarkerPetaPentadbir(event) {
  if (
    !sedangSeretMarkerPetaPentadbir ||
    !lokasiMarkerSeretPentadbir ||
    !kanvasMarkerSeretPentadbir
  ) {
    return;
  }

  const rect =
    kanvasMarkerSeretPentadbir
      .getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const x =
    ((event.clientX - rect.left) /
    rect.width) *
    100;

  const y =
    ((event.clientY - rect.top) /
    rect.height) *
    100;

  const tetapan =
    tetapanPetaCartaPentadbir();

  const lama =
    tetapan.marker?.[
      lokasiMarkerSeretPentadbir
    ] || {};

  tetapan.marker[
    lokasiMarkerSeretPentadbir
  ] = {
    ...lama,
    x: Math.max(
      0,
      Math.min(100, x)
    ),
    y: Math.max(
      0,
      Math.min(100, y)
    ),
    status: atas(
      el("statusMarkerPentadbir")?.value ||
      lama.status ||
      "NORMAL"
    )
  };

  simpanTetapanPetaCartaTempatan(
    tetapan
  );

  const marker =
    el("lapisanMarkerUrusPetaPentadbir")
      ?.querySelector(
        `[data-lokasi="${CSS.escape(
          lokasiMarkerSeretPentadbir
        )}"]`
      );

  if (marker) {
    marker.style.left =
      `${tetapan.marker[
        lokasiMarkerSeretPentadbir
      ].x}%`;

    marker.style.top =
      `${tetapan.marker[
        lokasiMarkerSeretPentadbir
      ].y}%`;
  }
}


function tamatSeretMarkerPetaPentadbir() {
  if (!sedangSeretMarkerPetaPentadbir) {
    return;
  }

  window.removeEventListener(
    "pointermove",
    gerakSeretMarkerPetaPentadbir
  );

  document.body.classList.remove(
    "marker-dragging"
  );

  const lokasi =
    lokasiMarkerSeretPentadbir;

  sedangSeretMarkerPetaPentadbir = false;
  lokasiMarkerSeretPentadbir = "";
  kanvasMarkerSeretPentadbir = null;

  paparMarkerPetaPentadbir();

  paparMesej(
    "statusUrusPetaPentadbir",
    `Marker ${escapeHtml(lokasi)} telah dipindahkan. Tekan SIMPAN MARKER.`,
    "success"
  );
}


function letakMarkerPetaPentadbir(
  event
) {
  const lokasi =
    el(
      "pilihanLokasiMarkerPentadbir"
    )?.value;

  if (!lokasi) {
    paparMesej(
      "statusUrusPetaPentadbir",
      "Pilih Tempat Tugas dahulu.",
      "warning"
    );
    return;
  }

  const kanvas =
    el("kanvasUrusPetaPentadbir");

  if (!kanvas) return;

  const rect =
    kanvas.getBoundingClientRect();

  const x =
    ((event.clientX - rect.left) /
    rect.width) *
    100;

  const y =
    ((event.clientY - rect.top) /
    rect.height) *
    100;

  const tetapan =
    tetapanPetaCartaPentadbir();

  tetapan.marker[lokasi] = {
    x:
      Math.max(
        0,
        Math.min(100, x)
      ),

    y:
      Math.max(
        0,
        Math.min(100, y)
      ),

    status:
      atas(
        el(
          "statusMarkerPentadbir"
        )?.value ||
        tetapan.marker?.[lokasi]?.status ||
        "NORMAL"
      )
  };

  simpanTetapanPetaCartaTempatan(
    tetapan
  );

  pilihLokasiUrusMarkerPentadbir(lokasi);
  paparMarkerUrusPetaPentadbir();
  paparMarkerPetaPentadbir();

  paparMesej(
    "statusUrusPetaPentadbir",
    `Marker ${escapeHtml(lokasi)} telah diletakkan. Anda boleh seret marker untuk melaras kedudukan.`,
    "success"
  );
}


function simpanTetapanPetaPentadbir() {
  const tetapan =
    tetapanPetaCartaPentadbir();

  const imej =
    el("imejUrusPetaPentadbir");

  if (imej?.dataset?.imejBaharu) {
    tetapan.imej =
      imej.dataset.imejBaharu;

    delete imej.dataset.imejBaharu;
  }

  const lokasi =
    el(
      "pilihanLokasiMarkerPentadbir"
    )?.value;

  if (
    lokasi &&
    tetapan.marker?.[lokasi]
  ) {
    tetapan.marker[lokasi].status =
      atas(
        el(
          "statusMarkerPentadbir"
        )?.value ||
        "NORMAL"
      );
  }

  try {
    simpanTetapanPetaCartaTempatan(
      tetapan
    );
  } catch (error) {
    paparMesej(
      "statusUrusPetaPentadbir",
      "Tetapan peta gagal disimpan. Gambar mungkin terlalu besar untuk storan browser.",
      "error"
    );
    return;
  }

  muatPetaCartaPentadbir();

  paparMesej(
    "statusUrusPetaPentadbir",
    "Marker dan tetapan peta berjaya disimpan pada peranti Pentadbir ini.",
    "success"
  );
}


function pasangZoomPetaPentadbir() {
  const viewport =
    el("viewportPetaCartaPentadbir");

  if (
    !viewport ||
    viewport.dataset.zoomListener
  ) {
    return;
  }

  viewport.dataset.zoomListener =
    "1";

  viewport.addEventListener(
    "wheel",
    event => {
      event.preventDefault();

      zumPetaCartaPentadbir +=
        event.deltaY < 0
          ? 0.15
          : -0.15;

      zumPetaCartaPentadbir =
        Math.max(
          0.75,
          Math.min(
            3,
            zumPetaCartaPentadbir
          )
        );

      gunaZumPetaCartaPentadbir();
    },
    {
      passive: false
    }
  );
}


function gunaZumPetaCartaPentadbir() {
  const kanvas =
    el("kanvasPetaCartaPentadbir");

  if (kanvas) {
    kanvas.style.transform =
      `scale(${zumPetaCartaPentadbir})`;
  }

  if (el("statusPetaCartaPentadbir")) {
    el("statusPetaCartaPentadbir")
      .textContent =
      `Zoom: ${Math.round(
        zumPetaCartaPentadbir *
        100
      )}%`;
  }
}


function resetZumPetaCartaPentadbir() {
  zumPetaCartaPentadbir = 1;
  gunaZumPetaCartaPentadbir();
}


/* ================================================================
   KRONOLOGI OPERASI
================================================================ */

function dapatkanKronologiTempatanPentadbir() {
  try {
    const data =
      JSON.parse(
        localStorage.getItem(
          KUNCI_KRONOLOGI_CARTA_MOTOGP
        ) ||
        "[]"
      );

    return Array.isArray(data)
      ? data
      : [];
  } catch (_) {
    return [];
  }
}


function bukaTambahKronologiPentadbir() {
  const modal =
    el(
      "modalTambahKronologiPentadbir"
    );

  if (!modal) {
    alert(
      "Modal Tambah Kronologi belum terdapat dalam admin.html."
    );
    return;
  }

  const masa =
    el("masaKronologiPentadbir");

  if (masa && !masa.value) {
    const sekarang =
      new Date();

    const local =
      new Date(
        sekarang.getTime() -
        sekarang.getTimezoneOffset() *
        60000
      );

    masa.value =
      local.toISOString().slice(0, 16);
  }

  modal.hidden = false;
  modal.removeAttribute("hidden");
  modal.classList.add("open");
  document.body.classList.add(
    "modal-open"
  );
}


function tutupTambahKronologiPentadbir() {
  const modal =
    el(
      "modalTambahKronologiPentadbir"
    );

  if (!modal) return;

  modal.classList.remove("open");
  modal.hidden = true;
  modal.setAttribute("hidden", "");
  document.body.classList.remove(
    "modal-open"
  );
}


function simpanKronologiPentadbir() {
  const masa =
    el("masaKronologiPentadbir")
      ?.value;

  const lokasi =
    teks(
      el("lokasiKronologiPentadbir")
        ?.value
    );

  const tajuk =
    teks(
      el("tajukKronologiPentadbir")
        ?.value
    );

  const catatan =
    teks(
      el("catatanKronologiPentadbir")
        ?.value
    );

  if (!masa || !tajuk) {
    paparMesej(
      "statusTambahKronologiPentadbir",
      "Tarikh/Masa dan Tajuk perlu diisi.",
      "error"
    );
    return;
  }

  const senarai =
    dapatkanKronologiTempatanPentadbir();

  senarai.push({
    id:
      window.crypto?.randomUUID?.() ||
      String(Date.now()),

    masa,
    lokasi,
    tajuk,
    catatan
  });

  senarai.sort(
    (a, b) =>
      new Date(b.masa) -
      new Date(a.masa)
  );

  localStorage.setItem(
    KUNCI_KRONOLOGI_CARTA_MOTOGP,
    JSON.stringify(senarai)
  );

  [
    "lokasiKronologiPentadbir",
    "tajukKronologiPentadbir",
    "catatanKronologiPentadbir"
  ].forEach(id => {
    if (el(id)) el(id).value = "";
  });

  if (el("masaKronologiPentadbir")) {
    el("masaKronologiPentadbir").value =
      "";
  }

  paparKronologiPentadbir();
  tutupTambahKronologiPentadbir();
}


function paparKronologiPentadbir() {
  const tbody =
    el("senaraiKronologiPentadbir");

  if (!tbody) return;

  const tarikh =
    el("tarikhCartaPentadbir")
      ?.value ||
    hariIniMalaysia();

  const tajukJadual =
    el("tajukJadualKronologiPentadbir");

  if (tajukJadual) {
    tajukJadual.textContent =
      `KRONOLOGI OPERASI — ${formatTarikhMalaysia(tarikh)}`;
  }

  const manual =
    dapatkanKronologiTempatanPentadbir()
      .filter(item =>
        teks(item.masa).slice(0, 10) ===
        tarikh
      );

  const automatik =
    dataCartaLaporanPentadbir
      .filter(item => {
        const data =
          dataLaporanCarta(item);

        return (
          nilaiAdaCarta(data.kemalangan) ||
          nilaiAdaCarta(data.tangkapan) ||
          nilaiAdaCarta(data.rampasan) ||
          nilaiAdaCarta(
            data.jenis_ancaman ??
            data.ancaman
          )
        );
      })
      .map(item => {
        const data =
          dataLaporanCarta(item);

        const perkara = [];

        if (nilaiAdaCarta(data.kemalangan)) {
          perkara.push(
            `Kemalangan: ${teksNilaiCarta(data.kemalangan)}`
          );
        }

        if (nilaiAdaCarta(data.tangkapan)) {
          perkara.push(
            `Tangkapan: ${teksNilaiCarta(data.tangkapan)}`
          );
        }

        if (nilaiAdaCarta(data.rampasan)) {
          perkara.push(
            `Rampasan: ${teksNilaiCarta(data.rampasan)}`
          );
        }

        if (
          nilaiAdaCarta(
            data.jenis_ancaman ??
            data.ancaman
          )
        ) {
          perkara.push(
            `Ancaman: ${teksNilaiCarta(
              data.jenis_ancaman ??
              data.ancaman
            )}`
          );
        }

        return {
          id: `laporan-${item.id}`,
          masa: item.tarikh_masa,
          lokasi:
            item.penugasan?.tempat_tugas ||
            data.lokasi ||
            "",
          tajuk:
            jenisTugasCarta(item) ||
            "LAPORAN PETUGAS",
          catatan:
            perkara.join(" | ")
        };
      });

  const semua =
    [...manual, ...automatik]
      .sort(
        (a, b) =>
          new Date(b.masa) -
          new Date(a.masa)
      );

  if (!semua.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">
          Belum ada kronologi operasi untuk tarikh ini.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML =
    semua.map(item => `
      <tr>
        <td style="text-align:center;white-space:nowrap;">
          ${escapeHtml(
            formatMasaLaporanAdmin(
              item.masa
            )
          )}
        </td>

        <td style="text-align:center;font-weight:800;">
          ${escapeHtml(item.tajuk || "-")}
        </td>

        <td style="text-align:center;">
          ${escapeHtml(item.lokasi || "-")}
        </td>

        <td style="text-align:left;white-space:normal;">
          ${escapeHtml(item.catatan || "-")}
        </td>
      </tr>
    `).join("");
}


document.addEventListener("DOMContentLoaded", () => {
  const inputTarikh = el("tarikh");

  if (inputTarikh) {
    inputTarikh.value = hariIniMalaysia();
  }

  const tarikhLaporan = el("tarikhLaporanPentadbir");
  if (tarikhLaporan) {
    tarikhLaporan.value = hariIniMalaysia();
  }

  const tarikhCarta = el("tarikhCartaPentadbir");
  if (tarikhCarta) {
    tarikhCarta.value = hariIniMalaysia();
  }

  el("password")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      login();
    }
  });

  /*
    Pastikan ketiga-tiga modul ditutup
    apabila halaman mula dibuka.
  */
  tutupSemuaModulPentadbir();

  pulihkanSesiPentadbir();
});