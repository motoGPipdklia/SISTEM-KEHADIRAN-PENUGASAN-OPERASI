"use strict";

/* ================================================================
   SKPO MOTOGP — MODUL PUSAT KAWALAN — SITREP (READ ONLY)

   Peranan dibenarkan:
   - PUSAT_KAWALAN

   Fungsi:
   - Lihat SITREP sahaja
   - Cari SITREP
   - Pilih tarikh
   - Cetak / Simpan PDF SITREP
   - Muat turun lampiran SITREP

   Tiada:
   - Laporan Petugas
   - Kehadiran
   - Penugasan
   - Edit / padam / hantar data
================================================================ */

const dbLaporan = window.supabaseClient;

const ZON_MASA_LAPORAN = "Asia/Kuala_Lumpur";
const JADUAL_SITREP = "sitrep";
const BUCKET_SITREP = "sitrep-lampiran";

let penggunaLaporan = null;
let dataSitrep = [];


function elLaporan(id) {
  return document.getElementById(id);
}


function teksLaporan(nilai) {
  return String(nilai ?? "").trim();
}


function atasLaporan(nilai) {
  return teksLaporan(nilai).toUpperCase();
}


function htmlLaporan(nilai) {
  return String(nilai ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function emailLaporan(noBadan) {
  const nilai = teksLaporan(noBadan)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  return `${nilai}@skpo.local`;
}


function hariIniLaporan() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA_LAPORAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}


function formatMasaLaporan(nilai) {
  if (!nilai) return "-";

  const tarikh = new Date(nilai);

  if (Number.isNaN(tarikh.getTime())) {
    return teksLaporan(nilai) || "-";
  }

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA_LAPORAN,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(tarikh);
}


function formatTarikhLaporan(nilai) {
  const teks = teksLaporan(nilai);
  const padanan = teks.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (padanan) {
    return `${padanan[3]}/${padanan[2]}/${padanan[1]}`;
  }

  return teks || "-";
}


function statusLaporan(mesej, jenis = "warning", id = "statusDataLaporan") {
  const elemen = elLaporan(id);

  if (!elemen) return;

  if (!mesej) {
    elemen.className = "laporan-status hidden";
    elemen.innerHTML = "";
    return;
  }

  elemen.className = `laporan-status ${jenis}`;
  elemen.innerHTML = mesej;
}


async function dapatkanProfilLaporan(userId) {
  let hasil = await dbLaporan
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!hasil.error && hasil.data) {
    return hasil.data;
  }

  const cubaanAuth = await dbLaporan
    .from("profiles")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (cubaanAuth.error) {
    if (hasil.error) throw hasil.error;
    throw cubaanAuth.error;
  }

  return cubaanAuth.data;
}


function perananLaporanDibenarkan(profil) {
  return atasLaporan(profil?.peranan) === "PUSAT_KAWALAN";
}


/* ================================================================
   LOGIN / SESI
================================================================ */

async function loginLaporan() {
  const noBadan = atasLaporan(elLaporan("noBadan")?.value);
  const password = elLaporan("password")?.value || "";
  const butang = elLaporan("btnLogin");

  if (!noBadan || !password) {
    statusLaporan(
      "Sila masukkan No Badan dan kata laluan.",
      "error",
      "loginStatus"
    );
    return;
  }

  if (butang) {
    butang.disabled = true;
    butang.textContent = "SEDANG MENYEMAK...";
  }

  statusLaporan("Sedang menyemak...", "warning", "loginStatus");

  try {
    if (!dbLaporan?.auth) {
      throw new Error(
        window.SKPO_SUPABASE_ERROR ||
        "Supabase belum disambungkan."
      );
    }

    const { data, error } = await dbLaporan.auth.signInWithPassword({
      email: emailLaporan(noBadan),
      password
    });

    if (error || !data?.user) {
      throw new Error("No Badan atau kata laluan tidak sah.");
    }

    const profil = await dapatkanProfilLaporan(data.user.id);

    if (!profil) {
      throw new Error("Profil pengguna tidak ditemui.");
    }

    if (profil.aktif === false) {
      throw new Error("Akaun telah dinyahaktifkan.");
    }

    if (!perananLaporanDibenarkan(profil)) {
      await dbLaporan.auth.signOut().catch(() => {});
      throw new Error("Akaun ini tidak mempunyai akses PUSAT KAWALAN.");
    }

    penggunaLaporan = {
      ...profil,
      authUserId: data.user.id
    };

    paparDashboardLaporan();
    await muatSitrep();

  } catch (error) {
    console.error("Login Pusat Kawalan gagal:", error);

    await dbLaporan?.auth
      ?.signOut()
      .catch(() => {});

    statusLaporan(
      htmlLaporan(error.message || "Login gagal."),
      "error",
      "loginStatus"
    );

  } finally {
    if (butang) {
      butang.disabled = false;
      butang.textContent = "LOGIN PUSAT KAWALAN";
    }
  }
}


async function pulihkanSesiLaporan() {
  try {
    if (!dbLaporan?.auth) return;

    const { data, error } = await dbLaporan.auth.getSession();

    if (error || !data?.session?.user) return;

    const profil = await dapatkanProfilLaporan(
      data.session.user.id
    );

    if (
      !profil ||
      profil.aktif === false ||
      !perananLaporanDibenarkan(profil)
    ) {
      await dbLaporan.auth.signOut().catch(() => {});
      return;
    }

    penggunaLaporan = {
      ...profil,
      authUserId: data.session.user.id
    };

    paparDashboardLaporan();
    await muatSitrep();

  } catch (error) {
    console.error("Pulihkan sesi Pusat Kawalan gagal:", error);

    statusLaporan(
      htmlLaporan(error.message || "Gagal memulihkan sesi."),
      "error",
      "loginStatus"
    );
  }
}


function paparDashboardLaporan() {
  elLaporan("loginPage")?.classList.add("hidden");
  elLaporan("dashboardPage")?.classList.remove("hidden");

  const profil = elLaporan("profilLaporan");

  if (profil) {
    profil.innerHTML = `
      <strong>
        ${htmlLaporan(penggunaLaporan?.pangkat || "")}
        ${htmlLaporan(penggunaLaporan?.nama || "-")}
      </strong>
      &nbsp; | &nbsp;
      No Badan: ${htmlLaporan(penggunaLaporan?.no_badan || "-")}
      &nbsp; | &nbsp;
      Akses: PUSAT KAWALAN
    `;
  }

  const tarikh = elLaporan("tarikhLaporan");

  if (tarikh && !tarikh.value) {
    tarikh.value = hariIniLaporan();
  }
}


async function logoutLaporan() {
  await dbLaporan?.auth
    ?.signOut()
    .catch(() => {});

  penggunaLaporan = null;
  dataSitrep = [];

  elLaporan("dashboardPage")?.classList.add("hidden");
  elLaporan("loginPage")?.classList.remove("hidden");

  if (elLaporan("password")) {
    elLaporan("password").value = "";
  }

  statusLaporan(
    "Anda telah log keluar.",
    "success",
    "loginStatus"
  );
}


/* ================================================================
   MUAT SITREP
================================================================ */

async function muatSitrep() {
  if (!penggunaLaporan) return;

  const tarikh =
    elLaporan("tarikhLaporan")?.value ||
    hariIniLaporan();

  if (elLaporan("tarikhLaporan")) {
    elLaporan("tarikhLaporan").value = tarikh;
  }

  statusLaporan(
    "Sedang mendapatkan SITREP...",
    "warning"
  );

  try {
    const { data, error } = await dbLaporan
      .from(JADUAL_SITREP)
      .select("*")
      .eq("tarikh", tarikh)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    dataSitrep = data || [];

    paparSitrep();

    statusLaporan(
      `${dataSitrep.length} SITREP berjaya dimuatkan.`,
      "success"
    );

  } catch (error) {
    console.error("Gagal memuatkan SITREP:", error);

    dataSitrep = [];
    paparSitrep();

    statusLaporan(
      `Ralat: ${htmlLaporan(error.message || "Gagal mendapatkan SITREP.")}`,
      "error"
    );
  }
}


/* ================================================================
   PAPAR SITREP
================================================================ */

function paparSitrep() {
  const bekas = elLaporan("senaraiSitrep");

  if (!bekas) return;

  const carian = atasLaporan(
    elLaporan("carianLaporan")?.value || ""
  );

  const senarai = dataSitrep.filter(item => {
    const gabung = atasLaporan([
      item.tajuk,
      item.no_badan_pelapor,
      item.pangkat_pelapor,
      item.nama_pelapor,
      item.musuh,
      item.kedudukan,
      item.tugas,
      item.tadbir,
      item.perancangan_hadapan,
      item.kekuatan,
      item.pegawai_pemerintah_medan,
      item.keselamatan,
      item.keutamaan,
      item.lampiran_nama
    ].join(" "));

    return !carian || gabung.includes(carian);
  });

  if (elLaporan("jumlahSitrep")) {
    elLaporan("jumlahSitrep").textContent =
      String(senarai.length);
  }

  if (!senarai.length) {
    bekas.innerHTML = `
      <div class="laporan-empty">
        Tiada SITREP ditemui.
      </div>
    `;
    return;
  }

  bekas.innerHTML = senarai.map(item => `
    <article class="laporan-record">

      <div class="laporan-record-head">
        <div>
          <span class="laporan-record-type">SITREP</span>
          <h3>${htmlLaporan(item.tajuk || "SITUATION REPORT")}</h3>
          <small>${htmlLaporan(formatMasaLaporan(item.created_at))}</small>
        </div>
      </div>

      <div class="laporan-grid">

        <div class="laporan-label">Pengirim</div>
        <div>
          ${htmlLaporan(item.pangkat_pelapor || "")}
          ${htmlLaporan(item.nama_pelapor || "-")}
        </div>

        <div class="laporan-label">No Badan</div>
        <div>${htmlLaporan(item.no_badan_pelapor || "-")}</div>

        <div class="laporan-label">Tarikh</div>
        <div>${htmlLaporan(formatTarikhLaporan(item.tarikh))}</div>

        <div class="laporan-label">Tadbir</div>
        <div style="white-space:pre-wrap">${htmlLaporan(item.tadbir || "TIADA")}</div>

      </div>

      <div class="laporan-actions">

        ${
          item.lampiran_path
            ? `
                <button
                  class="laporan-btn laporan-btn-download"
                  type="button"
                  onclick="muatTurunLampiranSitrep(
                    '${htmlLaporan(item.lampiran_path)}',
                    '${htmlLaporan(item.lampiran_nama || "lampiran")}'
                  )"
                >
                  MUAT TURUN LAMPIRAN
                </button>
              `
            : ""
        }

        <button
          class="laporan-btn laporan-btn-primary"
          type="button"
          onclick="cetakSitrepLaporan('${htmlLaporan(item.id)}')"
        >
          CETAK / SIMPAN PDF
        </button>

      </div>
    </article>
  `).join("");
}


/* ================================================================
   MUAT TURUN LAMPIRAN
================================================================ */

async function muatTurunLampiranSitrep(
  laluan,
  namaFail = "lampiran"
) {
  if (!laluan) {
    alert("Lampiran tidak ditemui.");
    return;
  }

  try {
    const { data, error } = await dbLaporan.storage
      .from(BUCKET_SITREP)
      .download(laluan);

    if (error) throw error;

    if (!data) {
      throw new Error("Fail tidak ditemui.");
    }

    const url = URL.createObjectURL(data);
    const pautan = document.createElement("a");

    pautan.href = url;
    pautan.download = namaFail || "lampiran";

    document.body.appendChild(pautan);
    pautan.click();
    pautan.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

  } catch (error) {
    console.error("Ralat muat turun lampiran:", error);

    alert(
      `Lampiran gagal dimuat turun: ${
        error.message || "Ralat tidak diketahui."
      }`
    );
  }
}


/* ================================================================
   CETAK SITREP
================================================================ */

function cetakSitrepLaporan(id) {
  const item = dataSitrep.find(
    rekod => String(rekod.id) === String(id)
  );

  if (!item) {
    alert("SITREP tidak ditemui.");
    return;
  }

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
    ["11. Lampiran", item.lampiran_nama || "TIADA"]
  ];

  const tetingkap = window.open(
    "",
    "_blank",
    "width=950,height=750"
  );

  if (!tetingkap) {
    alert(
      "Benarkan pop-up pada browser untuk mencetak atau menyimpan PDF."
    );
    return;
  }

  tetingkap.document.write(`
    <!doctype html>
    <html lang="ms">
    <head>
      <meta charset="utf-8">
      <title>SITREP - ${htmlLaporan(item.tajuk || "")}</title>

      <style>
        *{box-sizing:border-box}

        body{
          font-family:Arial,Helvetica,sans-serif;
          color:#111;
          margin:32px;
          line-height:1.5;
          font-size:14px;
        }

        h1{
          margin:0 0 6px;
          font-size:24px;
        }

        .meta{
          margin:0 0 24px;
          color:#444;
        }

        section{
          border-top:1px solid #bbb;
          padding:12px 0;
          break-inside:avoid;
        }

        strong{
          display:block;
          margin-bottom:4px;
        }

        p{
          margin:0;
          white-space:pre-wrap;
        }

        .nota{
          margin-top:22px;
          padding:12px;
          border:1px solid #ccc;
          background:#f5f5f5;
          font-size:12px;
        }

        @media print{
          body{margin:15mm}
        }
      </style>
    </head>

    <body>

      <h1>SITUATION REPORT (SITREP)</h1>

      <p class="meta">
        ${htmlLaporan(formatMasaLaporan(item.created_at))}
        <br>
        ${htmlLaporan(item.pangkat_pelapor || "")}
        ${htmlLaporan(item.nama_pelapor || "-")}
        (${htmlLaporan(item.no_badan_pelapor || "-")})
      </p>

      ${medan.map(([label, nilai]) => `
        <section>
          <strong>${htmlLaporan(label)}</strong>
          <p>${htmlLaporan(nilai || "TIADA")}</p>
        </section>
      `).join("")}

      ${
        item.lampiran_path
          ? `
              <div class="nota">
                Lampiran tersedia: ${htmlLaporan(item.lampiran_nama || "lampiran")}.
                Gunakan butang "MUAT TURUN LAMPIRAN" pada halaman utama untuk mendapatkan fail asal.
              </div>
            `
          : ""
      }

    </body>
    </html>
  `);

  tetingkap.document.close();
  tetingkap.focus();

  setTimeout(() => {
    tetingkap.print();
  }, 300);
}


/* ================================================================
   EVENT
================================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const tarikh = elLaporan("tarikhLaporan");

  if (tarikh && !tarikh.value) {
    tarikh.value = hariIniLaporan();
  }

  pulihkanSesiLaporan();

  elLaporan("password")?.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        loginLaporan();
      }
    }
  );

  elLaporan("noBadan")?.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        elLaporan("password")?.focus();
      }
    }
  );
});