"use strict";

/* ================================================================
   SKPO V2 — PENTADBIR
   GitHub Pages + Supabase
================================================================ */

const db = window.supabaseClient;
const ZON_MASA = "Asia/Kuala_Lumpur";
const MASA_TAMAT_PERMINTAAN = 15000;

let adminLogin = null;
let dataDashboard = [];
let dataPaparan = [];
let rekodResetDevice = null;
let rekodImportPenugasan = [];
let importSedangBerjalan = false;
let rekodImportPengguna = [];
let importPenggunaSedangBerjalan = false;

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
  const nilai = teks(noBadan)
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

    if (!semakPerananPentadbir(profil)) {
      throw new Error(
        `Akses ditolak. Peranan akaun ini ialah ${atas(profil.peranan) || "TIDAK DITETAPKAN"}, bukan PENTADBIR.`
      );
    }

    adminLogin = {
      id: profil.id,
      authUserId: data.user.id,
      noBadan: profil.no_badan,
      pangkat: profil.pangkat || "",
      nama: profil.nama || "",
      peranan: atas(profil.peranan)
    };

    localStorage.setItem("skpoAdmin", JSON.stringify(adminLogin));

    el("loginPage").style.display = "none";
    el("dashboard").style.display = "block";
    el("adminName").textContent = [
      adminLogin.pangkat,
      adminLogin.nama,
      `(${adminLogin.noBadan})`
    ].filter(Boolean).join(" ");

    paparMesej("loginStatus", "", "success");
    await muatData(true);
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
    if (!profil || profil.aktif === false || !semakPerananPentadbir(profil)) {
      await db.auth.signOut();
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
  } catch (error) {
    console.error("Pemulihan sesi Pentadbir gagal:", error);
    paparMesej("loginStatus", escapeHtml(error.message), "error");
  }
}

async function logout() {
  await db?.auth?.signOut().catch(() => {});
  localStorage.removeItem("skpoAdmin");
  adminLogin = null;
  dataDashboard = [];
  dataPaparan = [];

  el("dashboard").style.display = "none";
  el("loginPage").style.display = "block";
  el("password").value = "";
  el("loginStatus").innerHTML = "";
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

    const [checkinRes, checkoutRes] = await Promise.all([
      denganHadMasa(
        db.from("checkin").select("*").eq("tarikh", tarikh)
      ),
      denganHadMasa(
        db.from("checkout").select("*").eq("tarikh", tarikh)
      )
    ]);

    if (checkinRes.error) throw checkinRes.error;
    if (checkoutRes.error) throw checkoutRes.error;

    const profilMap = new Map(profil.map(item => [item.id, item]));
    const checkinMap = new Map(
      (checkinRes.data || []).map(item => [item.penugasan_id, item])
    );
    const checkoutMap = new Map(
      (checkoutRes.data || []).map(item => [item.penugasan_id, item])
    );

    dataDashboard = senaraiTugas.map(item => {
      const petugasId = item.petugas_id || item.profile_id;
      const pengguna = profilMap.get(petugasId) || {};
      const checkin = checkinMap.get(item.id) || null;
      const checkout = checkoutMap.get(item.id) || null;
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
        deviceId: pengguna.device_id || "",
        callSign: item.call_sign || "-",
        jenisTugas: item.jenis_tugas || "-",
        tempatTugas: item.tempat_tugas || item.lokasi || "-",
        pemegangSet: nilaiBoolean(item.pemegang_set),
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
  const carian = atas(el("carian")?.value);

  dataPaparan = dataDashboard.filter(item => {
    if (jenis && atas(item.jenisTugas) !== jenis) return false;
    if (tempat && atas(item.tempatTugas) !== tempat) return false;

    if (status) {
      if (status === "CHECK-OUT" && !item.checkout) return false;
      if (status !== "CHECK-OUT" && item.statusKehadiran !== status) return false;
    }

    if (carian) {
      const gabung = atas([
        item.noBadan,
        item.pangkat,
        item.nama,
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
      '<tr><td colspan="14" class="empty-row">' +
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
            ${item.deviceId ? "" : "disabled"}
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
    "BIL", "NO BADAN", "PANGKAT", "NAMA", "CALL SIGN",
    "JENIS TUGAS", "TEMPAT TUGAS", "PEMEGANG SET",
    "CHECK-IN", "STATUS", "CHECK-OUT", "TEMPOH"
  ];

  const baris = dataPaparan.map((item, index) => [
    index + 1,
    item.noBadan,
    item.pangkat,
    item.nama,
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
  pautan.download = `SKPO_${el("tarikh").value || hariIniMalaysia()}.csv`;
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

  const perananSah = ["PETUGAS", "PENYELIA", "URUSETIA", "PENTADBIR", "TSM"];
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
    "199898,SJN,AHMAD BIN ALI,PENYELIA,0123456789,IPD KLIA,SEPANG,Skpo@B9n4#2,YA"
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", kandungan], { type: "text/csv;charset=utf-8" });
  const pautan = document.createElement("a");
  pautan.href = URL.createObjectURL(blob);
  pautan.download = "TEMPLAT_PENGGUNA_SKPO.csv";
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
    paparMesej("statusImportPengguna", "Tiada pengguna baharu yang sah untuk diimport.", "error");
    return;
  }

  if (!confirm(`Import ${senarai.length} pengguna baharu? Akaun Authentication akan dicipta dan tindakan ini tidak boleh dibatalkan dari halaman ini.`)) return;

  importPenggunaSedangBerjalan = true;
  const butang = el("btnImportPengguna");
  butang.disabled = true;
  let diproses = 0;
  let berjaya = 0;
  let sediaAda = 0;
  let gagal = 0;
  const semuaKeputusan = [];

  try {
    const kumpulan = bahagiKumpulan(senarai, 10);

    for (let i = 0; i < kumpulan.length; i += 1) {
      butang.textContent = `MENGIMPORT ${diproses} / ${senarai.length}...`;
      paparMesej(
        "statusImportPengguna",
        `Sedang mencipta akaun kumpulan ${i + 1} daripada ${kumpulan.length}. Jangan tutup halaman ini.`,
        "warning"
      );

      const hasil = await panggilEdgeFunction(
        "import-pengguna",
        { pengguna: kumpulan[i].map(item => item.data) },
        120000
      );

      if (hasil?.success === false) throw new Error(hasil.message || "Import pengguna gagal.");

      berjaya += Number(hasil.berjaya || 0);
      sediaAda += Number(hasil.sedia_ada || 0);
      gagal += Number(hasil.gagal || 0);
      const keputusan = Array.isArray(hasil.keputusan) ? hasil.keputusan : [];
      semuaKeputusan.push(...keputusan);

      keputusan.forEach(itemHasil => {
        const rekod = rekodImportPengguna.find(item => item.baris === Number(itemHasil.baris));
        if (!rekod) return;

        if (itemHasil.status === "BERJAYA") {
          rekod.diimport = true;
          rekod.data.password = "";
        } else if (itemHasil.status === "SEDIA_ADA") {
          rekod.sediaAda = true;
          rekod.data.password = "";
        } else {
          rekod.ralat.push(`Import: ${itemHasil.mesej || "Gagal"}`);
        }
      });

      diproses += kumpulan[i].length;
      paparPratontonImportPengguna();
    }

    const ralat = semuaKeputusan.filter(item => item.status === "GAGAL");
    const butiran = ralat.length
      ? `<br><details><summary>Lihat ${ralat.length} ralat</summary><ul>${ralat.slice(0, 100).map(item => `<li>Baris ${escapeHtml(item.baris || "-")} — ${escapeHtml(item.no_badan || "-")}: ${escapeHtml(item.mesej || "Ralat")}</li>`).join("")}</ul></details>`
      : "";

    paparMesej(
      "statusImportPengguna",
      `<strong>IMPORT PENGGUNA SELESAI</strong><br>Berjaya: ${berjaya}<br>Sedia ada/dilangkau: ${sediaAda}<br>Gagal: ${gagal}${butiran}`,
      gagal ? "warning" : "success"
    );
  } catch (error) {
    console.error("Import pengguna gagal:", error);
    const mesej = /Edge Function|Failed to send|404/i.test(error.message)
      ? `${error.message} Pastikan Edge Function bernama tepat \"import-pengguna\" telah dideploy.`
      : error.message;
    paparMesej("statusImportPengguna", `Import gagal: ${escapeHtml(mesej)}`, "error");
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
    Device ID: ${escapeHtml(rekod.deviceId || "-")}
  `;
  el("sebabResetDevice").value = "";
  el("statusModalResetDevice").innerHTML = "";
  el("modalResetDevice").style.display = "block";
}

function tutupModalResetDevice() {
  rekodResetDevice = null;
  el("modalResetDevice").style.display = "none";
}

async function hantarResetDevice() {
  if (!rekodResetDevice) return;

  const sebab = teks(el("sebabResetDevice").value);
  const butang = el("btnSahkanResetDevice");

  if (!sebab) {
    paparMesej("statusModalResetDevice", "Sila nyatakan sebab reset Device ID.", "error");
    return;
  }

  if (!confirm("Sahkan reset Device ID petugas ini?")) return;

  butang.disabled = true;
  butang.textContent = "SEDANG RESET...";

  try {
    let hasil = await denganHadMasa(
      db.rpc("reset_device_petugas", {
        p_petugas_id: rekodResetDevice.petugasId,
        p_sebab: sebab
      })
    );

    if (
      hasil.error &&
      /does not exist|not found|PGRST202|schema cache/i.test(
        `${hasil.error.code || ""} ${hasil.error.message || ""}`
      )
    ) {
      hasil = await denganHadMasa(
        db.from("profiles")
          .update({ device_id: null })
          .eq("id", rekodResetDevice.petugasId)
      );
    }

    if (hasil.error) throw hasil.error;

    paparMesej("statusModalResetDevice", "Device ID berjaya direset.", "success");
    setTimeout(async () => {
      tutupModalResetDevice();
      await muatData(false);
    }, 1000);
  } catch (error) {
    console.error("Reset Device gagal:", error);
    paparMesej("statusModalResetDevice", escapeHtml(error.message), "error");
  } finally {
    butang.disabled = false;
    butang.textContent = "SAHKAN RESET DEVICE";
  }
}

/* ================================================================
   NAVIGASI MODUL PENTADBIR
================================================================ */

function tutupSemuaModulPentadbir() {
  const senaraiModul = [
    {
      modul: "modulImportPengguna",
      kandungan: "kandunganImportPengguna",
      butang: "btnToggleImportPengguna",
      teks: "PAPARKAN IMPORT"
    },
    {
      modul: "modulImportPenugasan",
      kandungan: "kandunganImportPenugasan",
      butang: "btnToggleImportPenugasan",
      teks: "PAPARKAN IMPORT"
    },
    {
      modul: "modulDaftarPengguna",
      kandungan: "borangDaftarPengguna",
      butang: "btnToggleDaftarPengguna",
      teks: "PAPARKAN BORANG"
    }
  ];

  senaraiModul.forEach(item => {
    const modul = el(item.modul);
    const kandungan = el(item.kandungan);
    const butang = el(item.butang);

    if (modul) {
      modul.hidden = true;
      modul.classList.remove("modul-disorot");
    }

    if (kandungan) {
      kandungan.hidden = true;
    }

    if (butang) {
      butang.setAttribute("aria-expanded", "false");
      butang.textContent = item.teks;
    }
  });
}


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
    alert("Modul tidak ditemui.");
    return;
  }

  /*
    Hanya satu modul dipaparkan pada satu masa.
  */
  tutupSemuaModulPentadbir();

  modul.hidden = false;

  if (kandungan) {
    kandungan.hidden = false;
  }

  if (butangToggle) {
    butangToggle.setAttribute(
      "aria-expanded",
      "true"
    );

    butangToggle.textContent =
      teksButangBuka;
  }

  /*
    Tunggu browser memaparkan modul dahulu,
    kemudian scroll ke kedudukannya.
  */
  window.requestAnimationFrame(() => {
    modul.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    modul.classList.remove(
      "modul-disorot"
    );

    void modul.offsetWidth;

    modul.classList.add(
      "modul-disorot"
    );

    window.setTimeout(() => {
      modul.classList.remove(
        "modul-disorot"
      );
    }, 1800);
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

/* ================================================================
   PERMULAAN HALAMAN
================================================================ */

document.addEventListener("DOMContentLoaded", () => {
  el("tarikh").value = hariIniMalaysia();

  el("password")?.addEventListener("keydown", event => {
    if (event.key === "Enter") login();
  });

  pulihkanSesiPentadbir();
});
