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
    const { data, error } = await denganHadMasa(
      db.functions.invoke("tambah_petugas", {
        body: {
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
      }),
      25000
    );

    if (error) throw error;
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
   PERMULAAN HALAMAN
================================================================ */

document.addEventListener("DOMContentLoaded", () => {
  el("tarikh").value = hariIniMalaysia();

  el("password")?.addEventListener("keydown", event => {
    if (event.key === "Enter") login();
  });

  pulihkanSesiPentadbir();
});
