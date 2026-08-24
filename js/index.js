"use strict";

/* SKPO MOTOGP — Petugas (GitHub Pages + Supabase) */

const db = window.supabaseClient;
const ZON_MASA = "Asia/Kuala_Lumpur";
const SELANG_SEMAKAN_STATUS = 15000;
const HAD_KETEPATAN_GPS = 100;

/* Kekalkan kunci tempatan MotoGP sedia ada supaya ikatan peranti tidak berubah. */
const KUNCI_USER_MOTOGP = "user";
const KUNCI_DEVICE_MOTOGP = "skpoDeviceId";

let userLogin = null;
let tugas = null;
let lokasiGPS = null;
let lokasiGPSCheckout = null;
let jarakSemasa = null;
let jarakCheckout = null;
let lokasiDibenarkan = false;
let lokasiCheckoutDibenarkan = false;
let sedangMenghantar = false;
let sedangMenghantarCheckout = false;
let timerSemakStatus = null;
let statusKehadiranSemasa = "";
let sudahCheckOutSemasa = false;
let rekodCheckinSemasa = null;

function el(id) { return document.getElementById(id); }
function teks(v) { return String(v ?? "").trim(); }
function atas(v) { return teks(v).toUpperCase(); }
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}
function hariIniMalaysia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}
function formatTarikhMasa(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return teks(v) || "-";
  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(d);
}
function nilaiBoolean(v) {
  return v === true || ["YA", "YES", "Y", "1", "BENAR", "TRUE"].includes(atas(v));
}
function paparStatus(id, mesej, jenis = "warning") {
  const e = el(id); if (!e) return;
  e.className = `status-box ${jenis}`; e.style.display = "block"; e.innerHTML = mesej;
}
function emailDalaman(noBadan) {
  const n = teks(noBadan).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return `${n}@skpo.local`;
}
function dapatkanDeviceId() {
  const kunci = KUNCI_DEVICE_MOTOGP;
  let id = localStorage.getItem(kunci);
  if (!id) {
    const rawak = window.crypto?.randomUUID?.() ||
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
      });
    id = `DEV-${rawak.toUpperCase()}`; localStorage.setItem(kunci, id);
  }
  return id;
}

async function sahkanIkatanPeranti() {
  const { data, error } = await db.rpc(
    "ikat_peranti_petugas",
    { p_device_id: dapatkanDeviceId() }
  );

  if (error) {
    if (/ikat_peranti_petugas|function.*does not exist/i.test(error.message || "")) {
      throw new Error(
        "Kawalan peranti belum dipasang dalam Supabase. Hubungi Pentadbir."
      );
    }
    throw error;
  }

  if (!data || data.success !== true) {
    throw new Error(
      data?.message || "Peranti ini tidak dibenarkan untuk akaun tersebut."
    );
  }

  return data;
}

async function ambilProfil(userId) {
  let hasil = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (hasil.error && /auth_user_id/i.test(hasil.error.message || "")) {
    hasil = await db.from("profiles").select("*").eq("auth_user_id", userId).maybeSingle();
  }
  if (hasil.error) throw hasil.error;
  return hasil.data;
}

async function login() {
  const noBadan = atas(el("noBadan")?.value);
  const password = teks(el("password")?.value);
  const btn = el("btnLogin");
  if (!noBadan || !password) {
    el("status").innerHTML = '<span class="status-error">Sila masukkan No Badan dan kata laluan.</span>';
    return;
  }
  btn.disabled = true; btn.textContent = "SEDANG LOGIN...";
  el("status").innerHTML = '<span class="status-warning">Sedang menyemak...</span>';
  try {
    const { data, error } = await db.auth.signInWithPassword({ email: emailDalaman(noBadan), password });
    if (error || !data.user) throw new Error("No Badan atau kata laluan tidak sah.");
    const profil = await ambilProfil(data.user.id);
    if (!profil) throw new Error("Profil petugas tidak dijumpai.");
    if (profil.aktif === false) throw new Error("Akaun petugas tidak aktif.");
    await sahkanIkatanPeranti();
    userLogin = {
      id: profil.id, authUserId: data.user.id, noBadan: profil.no_badan,
      pangkat: profil.pangkat || "", nama: profil.nama || "", peranan: profil.peranan || "PETUGAS"
    };
    localStorage.setItem(KUNCI_USER_MOTOGP, JSON.stringify(userLogin));
    paparDashboardProfil();
    await refreshDashboard();
    mulaSemakanStatusAutomatik();
  } catch (err) {
    await db.auth.signOut().catch(() => {});
    el("status").innerHTML = `<span class="status-error">${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false; btn.textContent = "LOGIN";
  }
}

function paparDashboardProfil() {
  el("loginBox").classList.remove("login-visible");
  el("loginBox").style.display = "none"; el("dashboard").style.display = "block";
  el("pangkatPetugas").textContent = userLogin.pangkat || "PANGKAT TIDAK DINYATAKAN";
  el("namaPetugas").textContent = userLogin.nama || "-";
  el("noBadanPetugas").textContent = `No Badan: ${userLogin.noBadan || "-"}`;
  el("status").innerHTML = "";
}

async function pulihkanSesi() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error || !data.session?.user) return;
    const profil = await ambilProfil(data.session.user.id);
    if (!profil || profil.aktif === false) { await db.auth.signOut(); return; }
    await sahkanIkatanPeranti();
    userLogin = {
      id: profil.id, authUserId: data.session.user.id, noBadan: profil.no_badan,
      pangkat: profil.pangkat || "", nama: profil.nama || "", peranan: profil.peranan || "PETUGAS"
    };
    localStorage.setItem(KUNCI_USER_MOTOGP, JSON.stringify(userLogin));
    paparDashboardProfil(); await refreshDashboard(); mulaSemakanStatusAutomatik();
  } catch (err) {
    console.error("Pemulihan sesi gagal:", err);
    await db.auth.signOut().catch(() => {});
    localStorage.removeItem(KUNCI_USER_MOTOGP);
    el("status").innerHTML = `<span class="status-error">${escapeHtml(err.message)}</span>`;
  }
}

async function dapatkanTugasHariIni() {
  const status = el("statusTugas");
  status.innerHTML = '<span class="status-warning">Sedang mendapatkan tugasan...</span>';
  el("btnCheckin").disabled = true;
  ["callSignTugas", "jenisTugas", "lokasiTugas", "penyeliaTugas", "pemegangSetTugas"]
    .forEach(id => el(id).textContent = "Memuatkan...");
  try {
    const tarikh = hariIniMalaysia();
    let q = await db.from("penugasan").select("*").eq("petugas_id", userLogin.id).eq("tarikh", tarikh)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (q.error && /petugas_id|tarikh/i.test(q.error.message || "")) {
      q = await db.from("penugasan").select("*").eq("profile_id", userLogin.id).eq("tarikh_tugas", tarikh)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
    }
    if (q.error) throw q.error;
    const p = q.data;
    if (!p) {
      tugas = null; kosongkanMaklumatTugas();
      status.innerHTML = '<span class="status-error">Tiada tugasan hari ini.</span>';
      kemasKiniButangPelaporan(null); return null;
    }
    if (atas(p.status) === "DIGANTI") {
      tugas = null; kosongkanMaklumatTugas();
      status.innerHTML = '<span class="status-error"><strong>STATUS PETUGAS: DIGANTI</strong><br>Anda telah digantikan dengan petugas lain.</span>';
      el("btnCheckin").disabled = true; el("btnCheckout").disabled = true;
      el("btnCheckin").textContent = "CHECK-IN TIDAK DIBENARKAN";
      el("btnCheckout").textContent = "CHECK-OUT TIDAK DIBENARKAN";
      return null;
    }
    tugas = {
      status: true, id: p.id, callSign: p.call_sign || "-",
      jenisTugas: p.jenis_tugas || "-", lokasi: p.tempat_tugas || p.lokasi || "-",
      penyelia: nilaiBoolean(p.penyelia) ? "YA" : "TIDAK",
      pemegangSet: nilaiBoolean(p.pemegang_set) ? "YA" : "TIDAK",
      lat: Number(p.latitude ?? p.lat), lng: Number(p.longitude ?? p.lng),
      radius: Number(p.radius_meter ?? p.radius ?? 30), raw: p
    };
    el("callSignTugas").textContent = tugas.callSign;
    el("jenisTugas").textContent = tugas.jenisTugas;
    el("lokasiTugas").textContent = tugas.lokasi;
    el("penyeliaTugas").textContent = tugas.penyelia;
    el("pemegangSetTugas").textContent = tugas.pemegangSet;
    status.innerHTML = '<span class="status-success">Tugasan hari ini dijumpai.</span>';
    return tugas;
  } catch (err) {
    tugas = null; kosongkanMaklumatTugas();
    status.innerHTML = `<span class="status-error">Ralat mendapatkan tugasan: ${escapeHtml(err.message)}</span>`;
    return null;
  }
}

async function semakStatusCheckInPetugas() {
  if (!userLogin || !tugas) return;
  paparStatus("statusKehadiran", "Sedang menyemak status kehadiran...", "warning");
  try {
    const { data, error } = await db.from("checkin").select("*").eq("petugas_id", userLogin.id)
      .eq("tarikh", hariIniMalaysia()).order("masa_checkin", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    rekodCheckinSemasa = data || null;
    if (!data) {
      statusKehadiranSemasa = ""; sudahCheckOutSemasa = false;
      el("btnCheckin").disabled = false; el("btnCheckin").textContent = "CHECK-IN KEHADIRAN";
      paparStatus("statusKehadiran", "<strong>Status Kehadiran: BELUM HADIR</strong><br>Sila buat Check-In kehadiran.", "warning");
      el("btnCheckout").disabled = true; el("btnCheckout").textContent = "CHECK-OUT TIDAK DIBENARKAN";
      paparStatus("statusCheckout", "Check-Out hanya dibenarkan selepas Check-In disahkan.", "warning");
      kemasKiniButangPelaporan(tugas); return;
    }
    statusKehadiranSemasa = atas(data.status);
    const paparan = statusKehadiranSemasa === "MENUNGGU" ? "MENUNGGU PENGESAHAN URUSETIA" : statusKehadiranSemasa;
    el("btnCheckin").disabled = true; el("btnCheckin").textContent = "CHECK-IN TELAH DIREKODKAN";
    const jenis = statusKehadiranSemasa === "DITOLAK" ? "error" : statusKehadiranSemasa === "HADIR" ? "success" : "warning";
    paparStatus("statusKehadiran", `<strong>Check-In telah direkodkan.</strong><br>Masa: ${escapeHtml(formatTarikhMasa(data.masa_checkin))}<br>Status: ${escapeHtml(paparan)}`, jenis);
    await semakStatusCheckOutPetugas(); kemasKiniButangPelaporan(tugas);
  } catch (err) {
    paparStatus("statusKehadiran", `Ralat menyemak status: ${escapeHtml(err.message)}`, "error");
  }
}

async function semakStatusCheckOutPetugas() {
  if (!userLogin || !tugas) return;
  try {
    const { data, error } = await db.from("checkout").select("*").eq("petugas_id", userLogin.id)
      .eq("tarikh", hariIniMalaysia()).order("masa_checkout", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) {
      sudahCheckOutSemasa = true; el("btnCheckout").disabled = true;
      el("btnCheckout").textContent = "CHECK-OUT TELAH DIREKODKAN";
      paparStatus("statusCheckout", `<strong>Check-Out telah direkodkan.</strong><br>Masa: ${escapeHtml(formatTarikhMasa(data.masa_checkout))}<br>Tempoh Bertugas: ${escapeHtml(formatTempoh(data.tempoh_minit))}<br>Status: <strong>SELESAI TUGAS</strong>`, "success");
    } else if (statusKehadiranSemasa === "HADIR") {
      sudahCheckOutSemasa = false; el("btnCheckout").disabled = false;
      el("btnCheckout").textContent = "CHECK-OUT KEHADIRAN";
      paparStatus("statusCheckout", "Check-Out boleh dibuat selepas selesai tugas.", "warning");
    } else {
      sudahCheckOutSemasa = false; el("btnCheckout").disabled = true;
      el("btnCheckout").textContent = "CHECK-OUT TIDAK DIBENARKAN";
      paparStatus("statusCheckout", "Check-Out hanya dibenarkan selepas Check-In disahkan.", "warning");
    }
    kemasKiniButangPelaporan(tugas);
  } catch (err) { paparStatus("statusCheckout", `Ralat menyemak Check-Out: ${escapeHtml(err.message)}`, "error"); }
}

function formatTempoh(minit) {
  if (!Number.isFinite(Number(minit))) return "-";
  const m = Math.max(0, Number(minit)); return `${Math.floor(m / 60)} jam ${Math.round(m % 60)} minit`;
}
function petugasLayakHantarLaporan(t) {
  if (!t) return false;

  const ialahPenyelia = atas(t.penyelia) === "YA";
  const ialahPemegangSet = atas(t.pemegangSet) === "YA";
  const jenis = normalisasiJenisTugasPelaporan(t.jenisTugas);

  /*
    LITUPAN KESELAMATAN:
    Borang khas ini hanya dibenarkan kepada PENYELIA.
    Pemegang Set yang bukan Penyelia tidak diberi akses.
  */
  if (jenis === "LITUPAN KESELAMATAN") {
    return ialahPenyelia;
  }

  return ialahPenyelia || ialahPemegangSet;
}

function kemasKiniButangPelaporan(t) {
  const b = el("btnLaporan");
  const skrinLaporan = el("laporan");
  const ruangBorang = el("borangLaporanDinamik");

  if (!b) return;

  const jenis =
    t
      ? normalisasiJenisTugasPelaporan(t.jenisTugas)
      : "";

  const ialahLitupan =
    jenis === "LITUPAN KESELAMATAN";

  const layak =
    petugasLayakHantarLaporan(t);

  /*
    Jika bukan petugas yang layak:
    - Litupan Keselamatan mesti PENYELIA.
    - Jenis lain kekal Penyelia atau Pemegang Set.
  */
  if (!layak) {
    b.style.display = "none";
    b.disabled = true;
    b.textContent =
      ialahLitupan
        ? "LAPORAN LITUPAN KESELAMATAN"
        : "HANTAR PELAPORAN";

    if (ruangBorang) {
      ruangBorang.innerHTML = "";
    }

    if (skrinLaporan) {
      skrinLaporan.style.display = "none";
    }

    return;
  }

  b.style.display = "block";

  b.disabled =
    !(
      statusKehadiranSemasa === "HADIR" &&
      !sudahCheckOutSemasa
    );

  if (sudahCheckOutSemasa) {
    b.textContent =
      ialahLitupan
        ? "LAPORAN LITUPAN DITUTUP SELEPAS CHECK-OUT"
        : "PELAPORAN DITUTUP SELEPAS CHECK-OUT";

    return;
  }

  if (statusKehadiranSemasa !== "HADIR") {
    b.textContent =
      ialahLitupan
        ? "LAPORAN LITUPAN MENUNGGU PENGESAHAN URUSETIA"
        : "PELAPORAN MENUNGGU PENGESAHAN URUSETIA";

    return;
  }

  b.textContent =
    ialahLitupan
      ? "HANTAR LAPORAN LITUPAN KESELAMATAN"
      : "HANTAR PELAPORAN";
}

function mulaCheckin() { bukaSkrinGps("checkin"); }
function mulaCheckout() {
  if (statusKehadiranSemasa !== "HADIR" || sudahCheckOutSemasa) return alert("Check-Out tidak dibenarkan.");
  bukaSkrinGps("checkout");
}
function bukaSkrinGps(mod) {
  if (!tugas) return alert("Tiada tugasan yang sah untuk hari ini.");
  const keluar = mod === "checkout";
  if (keluar) { lokasiGPSCheckout = null; jarakCheckout = null; lokasiCheckoutDibenarkan = false; }
  else { lokasiGPS = null; jarakSemasa = null; lokasiDibenarkan = false; }
  el("dashboard").style.display = "none"; el(mod).style.display = "block";
  el(keluar ? "tugasCheckout" : "tugasCheckin").innerHTML =
    binaBarisMaklumat("Call Sign:", tugas.callSign) + binaBarisMaklumat("Jenis Tugas:", tugas.jenisTugas) +
    binaBarisMaklumat("Tempat Tugas:", tugas.lokasi) + (!keluar ? binaBarisMaklumat("Penyelia:", tugas.penyelia) + binaBarisMaklumat("Pemegang Set:", tugas.pemegangSet) : "");
  el(keluar ? "gpsStatusCheckout" : "gpsStatus").textContent = "Sila dapatkan lokasi GPS semasa.";
  el(keluar ? "koordinatCheckout" : "koordinat").innerHTML = "";
  el(keluar ? "jarakStatusCheckout" : "jarakStatus").innerHTML = "";
  const h = el(keluar ? "statusHantarCheckout" : "statusHantar"); h.style.display = "none"; h.innerHTML = "";
  el(keluar ? "btnDapatGPSCheckout" : "btnDapatGPS").disabled = false;
  el(keluar ? "btnHantarCheckout" : "btnHantar").disabled = true;
}

function dapatkanGPS() { dapatkanGpsUntuk(false); }
function dapatkanGPSCheckout() { dapatkanGpsUntuk(true); }
function dapatkanGpsUntuk(keluar) {
  const ids = keluar ? ["gpsStatusCheckout", "koordinatCheckout", "jarakStatusCheckout", "btnDapatGPSCheckout", "btnHantarCheckout"]
    : ["gpsStatus", "koordinat", "jarakStatus", "btnDapatGPS", "btnHantar"];
  const [s, k, , g, h] = ids.map(el);
  if (!navigator.geolocation) { s.innerHTML = '<span class="status-error">Peranti ini tidak menyokong GPS.</span>'; return; }
  s.innerHTML = '<span class="status-warning">Mendapatkan lokasi GPS...</span>'; k.innerHTML = ""; g.disabled = true; h.disabled = true;
  navigator.geolocation.getCurrentPosition(pos => {
    g.disabled = false;
    const gps = { lat: Number(pos.coords.latitude), lng: Number(pos.coords.longitude), accuracy: Number(pos.coords.accuracy) };
    if (keluar) lokasiGPSCheckout = gps; else lokasiGPS = gps;
    s.innerHTML = '<span class="status-success">GPS berjaya diperoleh.</span>';
    k.innerHTML = `Latitude: ${gps.lat.toFixed(7)}<br>Longitude: ${gps.lng.toFixed(7)}<br>Ketepatan GPS: ${gps.accuracy.toFixed(1)} meter`;
    semakRadius(keluar);
  }, err => {
    g.disabled = false;
    const mesej = err.code === 1 ? "Kebenaran lokasi ditolak." : err.code === 2 ? "Lokasi tidak dapat dikesan." : "Masa mendapatkan GPS tamat.";
    s.innerHTML = `<span class="status-error">${escapeHtml(mesej)}</span>`;
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}
function semakRadius(keluar) {
  const gps = keluar ? lokasiGPSCheckout : lokasiGPS;
  const jarakId = keluar ? "jarakStatusCheckout" : "jarakStatus";
  const butangId = keluar ? "btnHantarCheckout" : "btnHantar";
  const radius = Number(tugas?.radius || 30);
  if (!gps || !Number.isFinite(tugas?.lat) || !Number.isFinite(tugas?.lng)) {
    el(jarakId).innerHTML = '<span class="status-error">Koordinat lokasi tugas tidak sah.</span>'; return;
  }
  const jarak = kiraJarakMeter(gps.lat, gps.lng, tugas.lat, tugas.lng);
  if (keluar) jarakCheckout = jarak; else jarakSemasa = jarak;
  const dibenar = gps.accuracy <= HAD_KETEPATAN_GPS && jarak <= radius;
  if (keluar) lokasiCheckoutDibenarkan = dibenar; else lokasiDibenarkan = dibenar;
  el(jarakId).innerHTML = dibenar
    ? `<span class="status-success">Lokasi berjaya disahkan (jarak ${jarak.toFixed(1)} meter; ketepatan GPS ${gps.accuracy.toFixed(1)} meter).</span>`
    : `<span class="status-error">Lokasi tidak dibenarkan. Jarak ${jarak.toFixed(1)} meter; radius ${radius} meter; ketepatan GPS ${gps.accuracy.toFixed(1)} meter (maksimum ${HAD_KETEPATAN_GPS} meter).</span>`;
  el(butangId).disabled = !dibenar;
}

async function hantarKehadiran() {
  if (sedangMenghantar || !lokasiGPS || !lokasiDibenarkan) return;
  sedangMenghantar = true; setProsesGps(false, true, "Sedang menyimpan rekod kehadiran...");
  const payload = {
    p_penugasan_id: tugas.id, p_latitude: lokasiGPS.lat, p_longitude: lokasiGPS.lng,
    p_ketepatan_gps: lokasiGPS.accuracy, p_device_id: dapatkanDeviceId()
  };
  try {
    let data;
    const rpc = await db.rpc("rekod_checkin_petugas", payload);
    if (rpc.error && rpcTiada(rpc.error)) {
      const ins = await db.from("checkin").insert({
        penugasan_id: tugas.id, petugas_id: userLogin.id, tarikh: hariIniMalaysia(),
        latitude: lokasiGPS.lat, longitude: lokasiGPS.lng, ketepatan_gps: lokasiGPS.accuracy,
        jarak_meter: jarakSemasa, device_id: dapatkanDeviceId(), status: "MENUNGGU"
      }).select("*").single();
      if (ins.error) throw ins.error; data = ins.data;
    } else { if (rpc.error) throw rpc.error; if (rpc.data?.success === false) throw new Error(rpc.data.message); data = rpc.data; }
    paparStatus("statusHantar", `<strong>Check-In berjaya dihantar.</strong><br>Status: MENUNGGU PENGESAHAN URUSETIA`, "success");
    el("btnHantar").textContent = "CHECK-IN BERJAYA";
    setTimeout(async () => { kembaliDashboard(); await refreshDashboard(); }, 1500);
    return data;
  } catch (err) { paparStatus("statusHantar", escapeHtml(err.message), "error"); setProsesGps(false, false); }
  finally { sedangMenghantar = false; }
}

async function hantarCheckout() {
  if (sedangMenghantarCheckout || !lokasiGPSCheckout || !lokasiCheckoutDibenarkan) return;
  sedangMenghantarCheckout = true; setProsesGps(true, true, "Sedang menyimpan rekod Check-Out...");
  try {
    const payload = {
      p_penugasan_id: tugas.id, p_latitude: lokasiGPSCheckout.lat, p_longitude: lokasiGPSCheckout.lng,
      p_ketepatan_gps: lokasiGPSCheckout.accuracy, p_device_id: dapatkanDeviceId()
    };
    const rpc = await db.rpc("rekod_checkout_petugas", payload);
    if (rpc.error && rpcTiada(rpc.error)) {
      const mula = new Date(rekodCheckinSemasa.masa_checkin).getTime();
      const tempoh = Number.isFinite(mula) ? Math.max(0, Math.round((Date.now() - mula) / 60000)) : null;
      const ins = await db.from("checkout").insert({
        checkin_id: rekodCheckinSemasa.id, penugasan_id: tugas.id, petugas_id: userLogin.id,
        tarikh: hariIniMalaysia(), latitude: lokasiGPSCheckout.lat, longitude: lokasiGPSCheckout.lng,
        ketepatan_gps: lokasiGPSCheckout.accuracy, jarak_meter: jarakCheckout,
        tempoh_minit: tempoh, status: "SELESAI TUGAS"
      }).select("*").single();
      if (ins.error) throw ins.error;
    } else { if (rpc.error) throw rpc.error; if (rpc.data?.success === false) throw new Error(rpc.data.message); }
    paparStatus("statusHantarCheckout", "<strong>Check-Out berjaya.</strong><br>Status: SELESAI TUGAS", "success");
    el("btnHantarCheckout").textContent = "CHECK-OUT BERJAYA";
    setTimeout(async () => { kembaliDashboardCheckout(); await refreshDashboard(); }, 1500);
  } catch (err) { paparStatus("statusHantarCheckout", escapeHtml(err.message), "error"); setProsesGps(true, false); }
  finally { sedangMenghantarCheckout = false; }
}
function rpcTiada(err) { return /does not exist|not found|PGRST202|schema cache/i.test(`${err?.code || ""} ${err?.message || ""}`); }
function setProsesGps(keluar, proses, mesej = "") {
  const h = el(keluar ? "btnHantarCheckout" : "btnHantar");
  const g = el(keluar ? "btnDapatGPSCheckout" : "btnDapatGPS");
  const k = el(keluar ? "btnKembaliCheckout" : "btnKembali");
  h.disabled = proses; g.disabled = proses; k.disabled = proses;
  h.textContent = proses ? "SEDANG MENGHANTAR..." : (keluar ? "HANTAR CHECK-OUT" : "HANTAR KEHADIRAN");
  if (mesej) paparStatus(keluar ? "statusHantarCheckout" : "statusHantar", mesej, "warning");
}

function normalisasiJenisTugasPelaporan(nilai) {
  const jenis = atas(nilai).replace(/\s+/g, " ").trim();

  if (jenis.includes("LITUPAN KESELAMATAN")) return "LITUPAN KESELAMATAN";
  if (jenis.includes("KAWALAN KESELAMATAN")) return "KAWALAN KESELAMATAN";
  if (jenis.includes("KAWALAN LALULINTAS") || jenis.includes("KAWALAN LALU LINTAS")) {
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
  if (jenis.includes("BALAI POLIS BERGERAK")) return "BALAI POLIS BERGERAK";
  if (jenis.includes("PONDOK POLIS")) return "PONDOK POLIS";
  if (jenis.includes("UNIT PEMUSNAH BOM")) return "UNIT PEMUSNAH BOM";
  if (jenis.includes("SUBTEK")) return "SUBTEK";

  return jenis;
}

function bukaLaporan() {
  if (!tugas) {
    alert("Maklumat tugasan tidak dijumpai.");
    return;
  }

  /* Perlindungan utama: hanya Penyelia atau Pemegang Set. */
  if (!petugasLayakHantarLaporan(tugas)) {
    const ruangBorang = el("borangLaporanDinamik");

    if (ruangBorang) ruangBorang.innerHTML = "";
    if (el("laporan")) el("laporan").style.display = "none";

    const jenis = normalisasiJenisTugasPelaporan(tugas.jenisTugas);

    alert(
      jenis === "LITUPAN KESELAMATAN"
        ? "Borang Litupan Keselamatan hanya disediakan kepada Penyelia."
        : "Borang pelaporan hanya disediakan kepada Penyelia atau Pemegang Set."
    );
    return;
  }

  if (statusKehadiranSemasa !== "HADIR" || sudahCheckOutSemasa) {
    alert("Pelaporan hanya dibenarkan selepas kehadiran disahkan dan sebelum Check-Out.");
    return;
  }

  el("dashboard").style.display = "none";
  el("laporan").style.display = "block";

  const jenisLaporan =
    normalisasiJenisTugasPelaporan(tugas.jenisTugas);

  const ialahLitupan =
    jenisLaporan === "LITUPAN KESELAMATAN";

  const ialahSubtek =
    jenisLaporan === "SUBTEK";

  const tajukLaporan =
    el("tajukLaporanPetugas");

  if (tajukLaporan) {
    tajukLaporan.textContent =
      ialahLitupan
        ? "Pelaporan Litupan Keselamatan"
        : ialahSubtek
          ? "Pelaporan SUBTEK"
          : "Pelaporan Petugas";
  }

  /*
    Pengguna meminta TARIKH tidak dipaparkan
    dalam Borang Litupan Keselamatan.
  */
  const blokTarikh =
    el("blokTarikhMasaLaporan");

  if (blokTarikh) {
    blokTarikh.style.display =
      ialahLitupan ? "none" : "block";
  }

  el("tugasLaporan").innerHTML =
    binaBarisMaklumat("Call Sign:", tugas.callSign) +
    binaBarisMaklumat("Jenis Tugas:", tugas.jenisTugas) +
    binaBarisMaklumat("Tempat Tugas:", tugas.lokasi) +
    binaBarisMaklumat("Penyelia:", tugas.penyelia);

  kemasKiniTarikhMasaLaporan();
  janaBorangPelaporan();

  const status = el("statusLaporan");
  if (status) {
    status.style.display = "none";
    status.innerHTML = "";
  }

  const btn = el("btnHantarLaporan");
  if (btn) {
    btn.disabled = false;
    btn.textContent =
      jenisLaporan === "LITUPAN KESELAMATAN"
        ? "HANTAR LAPORAN LITUPAN KESELAMATAN"
        : jenisLaporan === "SUBTEK"
          ? "HANTAR LAPORAN SUBTEK KEPADA URUSETIA"
          : "HANTAR LAPORAN KEPADA URUSETIA";
  }

  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

function kemasKiniTarikhMasaLaporan() {
  const ruang = el("tarikhMasaLaporan");
  if (ruang) ruang.textContent = formatTarikhMasa(new Date());
}

function tutupLaporan() {
  el("laporan").style.display = "none";
  el("dashboard").style.display = "block";
}

function janaBorangPelaporan() {
  const ruang = el("borangLaporanDinamik");
  if (!ruang || !tugas) return;

  const jenis = normalisasiJenisTugasPelaporan(tugas.jenisTugas);

  switch (jenis) {
    case "LITUPAN KESELAMATAN":
      ruang.innerHTML = `
        <div class="litupan-report-header">
          <h2>Borang Litupan Keselamatan</h2>
          <p>
            Masukkan maklumat VVIP / VIP yang diliputi.
            Borang ini hanya boleh dihantar oleh Penyelia.
          </p>
        </div>

        <div class="litupan-grid">
          <div class="litupan-field">
            <label for="lapLitupanKategori">
              <strong>Kategori *</strong>
            </label>
            <select id="lapLitupanKategori">
              <option value="">-- PILIH --</option>
              <option value="VVIP">VVIP</option>
              <option value="VIP">VIP</option>
            </select>
          </div>

          <div class="litupan-field litupan-field-wide">
            <label for="lapLitupanNama">
              <strong>Nama *</strong>
            </label>
            <input
              id="lapLitupanNama"
              type="text"
              placeholder="Nama VVIP / VIP"
              autocomplete="off"
            >
          </div>

          <div class="litupan-field">
            <label for="lapLitupanJawatan">
              <strong>Jawatan</strong>
            </label>
            <input
              id="lapLitupanJawatan"
              type="text"
              placeholder="Contoh: MENTERI / KETUA JABATAN"
              autocomplete="off"
            >
          </div>

          <div class="litupan-field">
            <label for="lapLitupanAgensi">
              <strong>Agensi / Organisasi</strong>
            </label>
            <input
              id="lapLitupanAgensi"
              type="text"
              placeholder="Contoh: KDN / PDRM / ORGANISASI"
              autocomplete="off"
            >
          </div>

          <div class="litupan-field">
            <label for="lapLitupanMasaKetibaan">
              <strong>Masa Ketibaan</strong>
            </label>
            <input
              id="lapLitupanMasaKetibaan"
              type="time"
            >
          </div>

          <div class="litupan-field">
            <label for="lapLitupanMasaBeredar">
              <strong>Masa Beredar</strong>
            </label>
            <input
              id="lapLitupanMasaBeredar"
              type="time"
            >
          </div>

          <div class="litupan-field litupan-field-wide">
            <label for="lapLitupanLokasi">
              <strong>Lokasi</strong>
            </label>
            <input
              id="lapLitupanLokasi"
              type="text"
              placeholder="Contoh: PADDOCK / MAIN GRANDSTAND"
              autocomplete="off"
            >
          </div>

          <div class="litupan-field litupan-field-wide">
            <label for="lapLitupanTujuan">
              <strong>Tujuan / Aktiviti</strong>
            </label>
            <textarea
              id="lapLitupanTujuan"
              placeholder="Tujuan lawatan atau aktiviti..."
            ></textarea>
          </div>

          <div class="litupan-field litupan-field-wide">
            <label for="lapLitupanCatatan">
              <strong>Catatan</strong>
            </label>
            <textarea
              id="lapLitupanCatatan"
              placeholder="Catatan tambahan jika ada..."
            ></textarea>
          </div>
        </div>
      `;
      break;

    case "SUBTEK":
      ruang.innerHTML = `
        <div class="subtek-report-header">
          <h2>Borang Pelaporan SUBTEK</h2>
          <p>
            Masukkan maklumat situasi semasa SUBTEK untuk dihantar kepada Urusetia.
          </p>
        </div>

        <div class="subtek-grid">
          <div class="subtek-field subtek-field-wide">
            <label for="lapSubtekKeadaanKeselamatan">
              <strong>Keadaan Keselamatan *</strong>
            </label>
            <select id="lapSubtekKeadaanKeselamatan">
              <option value="">-- PILIH --</option>
              <option value="TERKAWAL">TERKAWAL</option>
              <option value="TIDAK TERKAWAL">TIDAK TERKAWAL</option>
            </select>
          </div>

          <div class="subtek-field subtek-field-wide">
            <label for="lapSubtekLokasi">
              <strong>Lokasi *</strong>
            </label>
            <input
              id="lapSubtekLokasi"
              type="text"
              placeholder="Contoh: PADDOCK / MAIN GRANDSTAND / SUBTEK"
              autocomplete="off"
            >
          </div>

          <div class="subtek-field subtek-field-wide">
            ${binaPilihanAdaTiada(
              "lapSubtekVvipVip",
              "VVIP / VIP",
              "Butiran VVIP / VIP",
              "Masukkan nama / jawatan VVIP atau VIP."
            )}
          </div>

          <div class="subtek-field">
            <label for="lapSubtekJumlahPengunjung">
              <strong>Jumlah Pengunjung *</strong>
            </label>
            <input
              id="lapSubtekJumlahPengunjung"
              type="number"
              min="0"
              step="1"
              value="0"
              inputmode="numeric"
            >
          </div>

          <div class="subtek-field">
            <label for="lapSubtekJumlahKenderaanPengunjung">
              <strong>Jumlah Kenderaan Pengunjung *</strong>
            </label>
            <input
              id="lapSubtekJumlahKenderaanPengunjung"
              type="number"
              min="0"
              step="1"
              value="0"
              inputmode="numeric"
            >
          </div>

          <div class="subtek-field subtek-field-wide">
            <label for="lapSubtekKeperluanBantuan">
              <strong>Keperluan Bantuan / Sokongan *</strong>
            </label>
            <textarea
              id="lapSubtekKeperluanBantuan"
              placeholder="Masukkan keperluan bantuan atau sokongan. Jika tiada, masukkan TIADA."
            ></textarea>
          </div>

          <div class="subtek-field subtek-field-wide">
            <label for="lapSubtekCatatan">
              <strong>Catatan *</strong>
            </label>
            <textarea
              id="lapSubtekCatatan"
              placeholder="Masukkan catatan. Jika tiada, masukkan TIADA."
            ></textarea>
          </div>
        </div>
      `;
      break;

    case "KAWALAN KESELAMATAN":
      ruang.innerHTML = `
        <h2>Borang Kawalan Keselamatan</h2>

        <label for="lapKeadaanKeselamatan"><strong>Keadaan Keselamatan</strong></label>
        <select id="lapKeadaanKeselamatan">
          <option value="">-- PILIH --</option>
          <option value="TERKAWAL">TERKAWAL</option>
          <option value="TIDAK TERKAWAL">TIDAK TERKAWAL</option>
        </select>

        <label for="lapJumlahPengunjung"><strong>Jumlah Pengunjung</strong></label>
        <input id="lapJumlahPengunjung" type="number" min="0" step="1" inputmode="numeric" placeholder="Contoh: 1500">

        <h3>Pecahan Kenderaan</h3>

        <label for="lapBas"><strong>Bas</strong></label>
        <input id="lapBas" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahKenderaanKeselamatan()">

        <label for="lapMotosikal"><strong>Motosikal</strong></label>
        <input id="lapMotosikal" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahKenderaanKeselamatan()">

        <label for="lapMotokar"><strong>Motokar</strong></label>
        <input id="lapMotokar" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahKenderaanKeselamatan()">

        <label for="lapJumlahKenderaan"><strong>Jumlah Kenderaan</strong></label>
        <input id="lapJumlahKenderaan" type="number" value="0" readonly>

        ${binaPilihanAdaTiada("lapVvipVip", "VVIP / VIP", "Butiran VVIP / VIP", "Masukkan nama / jawatan VVIP atau VIP.")}

        <label for="lapCatatan"><strong>Catatan</strong></label>
        <textarea id="lapCatatan" placeholder="Jika tiada, masukkan TIADA."></textarea>
      `;
      kiraJumlahKenderaanKeselamatan();
      break;

    case "KAWALAN LALULINTAS":
      ruang.innerHTML = `
        <h2>Borang Kawalan Lalulintas</h2>

        <label for="lapKeadaanTrafik"><strong>Keadaan Trafik</strong></label>
        <select id="lapKeadaanTrafik">
          <option value="">-- PILIH --</option>
          <option value="LANCAR">LANCAR</option>
          <option value="PERLAHAN">PERLAHAN</option>
          <option value="SESAK">SESAK</option>
        </select>

        <label for="lapJumlahKenderaan"><strong>Jumlah Kenderaan</strong></label>
        <input id="lapJumlahKenderaan" type="number" min="0" step="1" inputmode="numeric" placeholder="Contoh: 350">

        ${binaPilihanAdaTiada("lapKemalangan", "Kemalangan", "Butiran Kemalangan", "Masukkan butiran kemalangan.")}

        <label for="lapCatatanTindakan"><strong>Catatan / Tindakan</strong></label>
        <textarea id="lapCatatanTindakan" placeholder="Masukkan catatan atau tindakan yang telah diambil."></textarea>
      `;
      break;

    case "RONDAAN PENCEGAHAN JENAYAH":
    case "RONDAAN PENCEGAHAN JENAYAH NARKOTIK":
    case "RONDAAN PENCEGAHAN JENAYAH KOMERSIL":
      ruang.innerHTML = `
        <h2>${escapeHtml(jenis)}</h2>

        <label for="lapLokasiRondaan"><strong>Lokasi Rondaan</strong></label>
        <textarea id="lapLokasiRondaan" placeholder="Masukkan lokasi / kawasan rondaan."></textarea>

        <h3>Pemeriksaan</h3>

        <label for="lapPemeriksaanLelaki"><strong>Lelaki</strong></label>
        <input id="lapPemeriksaanLelaki" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahPemeriksaan()">

        <label for="lapPemeriksaanPerempuan"><strong>Perempuan</strong></label>
        <input id="lapPemeriksaanPerempuan" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahPemeriksaan()">

        <label for="lapJumlahPemeriksaan"><strong>Jumlah Pemeriksaan</strong></label>
        <input id="lapJumlahPemeriksaan" type="number" value="0" readonly>

        ${binaPilihanAdaTiada("lapTangkapan", "Tangkapan", "Butiran Tangkapan", "Masukkan butiran tangkapan.")}

        ${binaPilihanAdaTiada("lapRampasan", "Rampasan", "Butiran Rampasan", "Masukkan butiran rampasan.")}

        <label for="lapCatatanRepot"><strong>Catatan / No. Repot</strong></label>
        <textarea id="lapCatatanRepot" placeholder="Masukkan catatan dan No. Repot jika berkaitan. Jika tiada, masukkan TIADA."></textarea>
      `;
      kiraJumlahPemeriksaan();
      break;

    case "BALAI POLIS BERGERAK":
      ruang.innerHTML = `
        <h2>Borang Balai Polis Bergerak</h2>

        <label for="lapNoRepot"><strong>No. Repot</strong></label>
        <input id="lapNoRepot" type="text" placeholder="Jika tiada, masukkan TIADA.">

        <label for="lapCatatan"><strong>Catatan</strong></label>
        <textarea id="lapCatatan" placeholder="Jika tiada, masukkan TIADA."></textarea>
      `;
      break;

    case "PONDOK POLIS":
      ruang.innerHTML = `
        <h2>Borang Pondok Polis</h2>

        <label for="lapNoRepot"><strong>No. Repot</strong></label>
        <input id="lapNoRepot" type="text" placeholder="Jika tiada, masukkan TIADA.">

        <label for="lapCatatan"><strong>Catatan</strong></label>
        <textarea id="lapCatatan" placeholder="Jika tiada, masukkan TIADA."></textarea>
      `;
      break;

    case "UNIT PEMUSNAH BOM":
      ruang.innerHTML = `
        <h2>Borang Unit Pemusnah Bom</h2>

        <label for="lapLokasi"><strong>Lokasi</strong></label>
        <textarea id="lapLokasi" placeholder="Masukkan lokasi."></textarea>

        ${binaPilihanAdaTiada("lapVvipVip", "VVIP / VIP", "Butiran VVIP / VIP", "Masukkan nama / jawatan VVIP atau VIP.")}

        ${binaPilihanAdaTiada("lapAncaman", "Jenis Ancaman", "Butiran / Jenis Ancaman", "Masukkan jenis ancaman.")}

        <label for="lapCatatan"><strong>Catatan</strong></label>
        <textarea id="lapCatatan" placeholder="Masukkan catatan."></textarea>
      `;
      break;

    default:
      ruang.innerHTML = `
        <div class="status-box error" style="display:block">
          <strong>BORANG PELAPORAN TIDAK DIJUMPAI</strong><br><br>
          Jenis tugas: <strong>${escapeHtml(tugas.jenisTugas)}</strong><br><br>
          Sila hubungi Pentadbir.
        </div>
      `;
      el("btnHantarLaporan").disabled = true;
  }
}

function binaPilihanAdaTiada(id, label, labelButiran, placeholder) {
  return `
    <div class="laporan-pilihan">
      <label for="${escapeHtml(id)}Status"><strong>${escapeHtml(label)}</strong></label>
      <select id="${escapeHtml(id)}Status" onchange="ubahPaparanButiranLaporan('${escapeHtml(id)}')">
        <option value="TIADA">TIADA</option>
        <option value="ADA">ADA</option>
      </select>

      <div id="${escapeHtml(id)}ButiranBox" style="display:none;">
        <label for="${escapeHtml(id)}Butiran"><strong>${escapeHtml(labelButiran)}</strong></label>
        <textarea id="${escapeHtml(id)}Butiran" placeholder="${escapeHtml(placeholder)}"></textarea>
      </div>
    </div>
  `;
}

function ubahPaparanButiranLaporan(id) {
  const status = el(`${id}Status`);
  const box = el(`${id}ButiranBox`);
  const butiran = el(`${id}Butiran`);
  if (!status || !box) return;

  const ada = atas(status.value) === "ADA";
  box.style.display = ada ? "block" : "none";
  if (!ada && butiran) butiran.value = "";
}

function nomborBulatLaporan(id) {
  const ruang = el(id);
  if (!ruang) return 0;

  const nilai = Number(ruang.value);
  return Number.isInteger(nilai) && nilai >= 0 ? nilai : 0;
}

function kiraJumlahKenderaanKeselamatan() {
  const bas = nomborBulatLaporan("lapBas");
  const motosikal = nomborBulatLaporan("lapMotosikal");
  const motokar = nomborBulatLaporan("lapMotokar");
  const jumlah = bas + motosikal + motokar;

  if (el("lapJumlahKenderaan")) el("lapJumlahKenderaan").value = jumlah;
  return jumlah;
}

function kiraJumlahPemeriksaan() {
  const lelaki = nomborBulatLaporan("lapPemeriksaanLelaki");
  const perempuan = nomborBulatLaporan("lapPemeriksaanPerempuan");
  const jumlah = lelaki + perempuan;

  if (el("lapJumlahPemeriksaan")) el("lapJumlahPemeriksaan").value = jumlah;
  return jumlah;
}

function dapatkanAdaTiadaLaporan(id) {
  const status = atas(el(`${id}Status`)?.value) === "ADA" ? "ADA" : "TIADA";
  const butiran = status === "ADA" ? teks(el(`${id}Butiran`)?.value) : "";
  return { status, butiran };
}

function binaDataLaporan() {
  const jenis = normalisasiJenisTugasPelaporan(tugas?.jenisTugas);

  if (jenis === "LITUPAN KESELAMATAN") {
    const kategori =
      atas(el("lapLitupanKategori")?.value);

    const nama =
      teks(el("lapLitupanNama")?.value);

    const jawatan =
      teks(el("lapLitupanJawatan")?.value);

    const agensi =
      teks(el("lapLitupanAgensi")?.value);

    const masaKetibaan =
      teks(el("lapLitupanMasaKetibaan")?.value);

    const masaBeredar =
      teks(el("lapLitupanMasaBeredar")?.value);

    const lokasi =
      teks(el("lapLitupanLokasi")?.value);

    const tujuan =
      teks(el("lapLitupanTujuan")?.value);

    const catatan =
      teks(el("lapLitupanCatatan")?.value);

    if (!["VVIP", "VIP"].includes(kategori)) {
      throw new Error("Sila pilih Kategori VVIP atau VIP.");
    }

    if (!nama) {
      throw new Error("Sila masukkan nama VVIP / VIP.");
    }

    /*
      Tarikh tidak diminta dalam borang.
      Tarikh penghantaran akan direkod oleh pangkalan data
      melalui rekod pelaporan / created_at.
    */
    return {
      kategori,
      nama,
      jawatan,
      agensi_organisasi: agensi,
      masa_ketibaan: masaKetibaan,
      masa_beredar: masaBeredar,
      lokasi,
      tujuan_aktiviti: tujuan,
      catatan,

      /*
        Nilai ringkas ini memastikan Modul Carta VVIP/VIP
        sedia ada boleh mengenal pasti laporan ini.
      */
      vvip_vip: `${kategori} — ${nama}`,

      /*
        Maklumat penugasan disimpan bersama untuk kegunaan
        paparan Pentadbir/Urusetia jika diperlukan.
      */
      petugas: {
        id: userLogin?.id || null,
        no_badan: userLogin?.noBadan || "",
        pangkat: userLogin?.pangkat || "",
        nama: userLogin?.nama || ""
      },

      penugasan: {
        id: tugas?.id || null,
        call_sign: tugas?.callSign || "",
        jenis_tugas: tugas?.jenisTugas || "",
        tempat_tugas: tugas?.lokasi || "",
        penyelia: tugas?.penyelia || ""
      }
    };
  }

  if (jenis === "SUBTEK") {
    const keadaanKeselamatan =
      atas(
        el(
          "lapSubtekKeadaanKeselamatan"
        )?.value
      );

    const lokasi =
      teks(
        el(
          "lapSubtekLokasi"
        )?.value
      );

    const vvipVip =
      dapatkanAdaTiadaLaporan(
        "lapSubtekVvipVip"
      );

    const jumlahPengunjung =
      Number(
        el(
          "lapSubtekJumlahPengunjung"
        )?.value
      );

    const jumlahKenderaanPengunjung =
      Number(
        el(
          "lapSubtekJumlahKenderaanPengunjung"
        )?.value
      );

    const keperluanBantuanSokongan =
      teks(
        el(
          "lapSubtekKeperluanBantuan"
        )?.value
      );

    const catatan =
      teks(
        el(
          "lapSubtekCatatan"
        )?.value
      );

    if (!keadaanKeselamatan) {
      throw new Error(
        "Sila pilih Keadaan Keselamatan."
      );
    }

    if (!lokasi) {
      throw new Error(
        "Sila masukkan Lokasi."
      );
    }

    if (
      vvipVip.status === "ADA" &&
      !vvipVip.butiran
    ) {
      throw new Error(
        "Sila masukkan butiran VVIP / VIP."
      );
    }

    if (
      !Number.isInteger(
        jumlahPengunjung
      ) ||
      jumlahPengunjung < 0
    ) {
      throw new Error(
        "Sila masukkan Jumlah Pengunjung yang sah."
      );
    }

    if (
      !Number.isInteger(
        jumlahKenderaanPengunjung
      ) ||
      jumlahKenderaanPengunjung < 0
    ) {
      throw new Error(
        "Sila masukkan Jumlah Kenderaan Pengunjung yang sah."
      );
    }

    if (!keperluanBantuanSokongan) {
      throw new Error(
        "Sila masukkan Keperluan Bantuan / Sokongan. Jika tiada, masukkan TIADA."
      );
    }

    if (!catatan) {
      throw new Error(
        "Sila masukkan Catatan. Jika tiada, masukkan TIADA."
      );
    }

    return {
      keadaan_keselamatan:
        keadaanKeselamatan,

      lokasi,

      vvip_vip:
        vvipVip,

      jumlah_pengunjung:
        jumlahPengunjung,

      jumlah_kenderaan_pengunjung:
        jumlahKenderaanPengunjung,

      keperluan_bantuan_sokongan:
        keperluanBantuanSokongan,

      catatan
    };
  }

  if (jenis === "KAWALAN KESELAMATAN") {
    const keadaan = atas(el("lapKeadaanKeselamatan")?.value);
    const jumlahPengunjung = Number(el("lapJumlahPengunjung")?.value);
    const bas = nomborBulatLaporan("lapBas");
    const motosikal = nomborBulatLaporan("lapMotosikal");
    const motokar = nomborBulatLaporan("lapMotokar");
    const jumlahKenderaan = kiraJumlahKenderaanKeselamatan();
    const vvipVip = dapatkanAdaTiadaLaporan("lapVvipVip");
    const catatan = teks(el("lapCatatan")?.value);

    if (!keadaan) throw new Error("Sila pilih keadaan keselamatan.");
    if (!Number.isInteger(jumlahPengunjung) || jumlahPengunjung < 0) {
      throw new Error("Sila masukkan jumlah pengunjung yang sah.");
    }
    if (vvipVip.status === "ADA" && !vvipVip.butiran) {
      throw new Error("Sila masukkan butiran VVIP / VIP.");
    }
    if (!catatan) throw new Error("Sila masukkan catatan. Jika tiada, masukkan TIADA.");

    return {
      keadaan_keselamatan: keadaan,
      jumlah_pengunjung: jumlahPengunjung,
      kenderaan: { bas, motosikal, motokar, jumlah: jumlahKenderaan },
      vvip_vip: vvipVip,
      catatan
    };
  }

  if (jenis === "KAWALAN LALULINTAS") {
    const keadaanTrafik = atas(el("lapKeadaanTrafik")?.value);
    const jumlahKenderaan = Number(el("lapJumlahKenderaan")?.value);
    const kemalangan = dapatkanAdaTiadaLaporan("lapKemalangan");
    const catatanTindakan = teks(el("lapCatatanTindakan")?.value);

    if (!keadaanTrafik) throw new Error("Sila pilih keadaan trafik.");
    if (!Number.isInteger(jumlahKenderaan) || jumlahKenderaan < 0) {
      throw new Error("Sila masukkan jumlah kenderaan yang sah.");
    }
    if (kemalangan.status === "ADA" && !kemalangan.butiran) {
      throw new Error("Sila masukkan butiran kemalangan.");
    }
    if (!catatanTindakan) throw new Error("Sila masukkan catatan / tindakan.");

    return {
      keadaan_trafik: keadaanTrafik,
      jumlah_kenderaan: jumlahKenderaan,
      kemalangan,
      catatan_tindakan: catatanTindakan
    };
  }

  if (
    jenis === "RONDAAN PENCEGAHAN JENAYAH" ||
    jenis === "RONDAAN PENCEGAHAN JENAYAH NARKOTIK" ||
    jenis === "RONDAAN PENCEGAHAN JENAYAH KOMERSIL"
  ) {
    const lokasi = teks(el("lapLokasiRondaan")?.value);
    const lelaki = nomborBulatLaporan("lapPemeriksaanLelaki");
    const perempuan = nomborBulatLaporan("lapPemeriksaanPerempuan");
    const jumlah = kiraJumlahPemeriksaan();
    const tangkapan = dapatkanAdaTiadaLaporan("lapTangkapan");
    const rampasan = dapatkanAdaTiadaLaporan("lapRampasan");
    const catatanRepot = teks(el("lapCatatanRepot")?.value);

    if (!lokasi) throw new Error("Sila masukkan lokasi rondaan.");
    if (tangkapan.status === "ADA" && !tangkapan.butiran) {
      throw new Error("Sila masukkan butiran tangkapan.");
    }
    if (rampasan.status === "ADA" && !rampasan.butiran) {
      throw new Error("Sila masukkan butiran rampasan.");
    }
    if (!catatanRepot) {
      throw new Error("Sila masukkan catatan / No. Repot. Jika tiada, masukkan TIADA.");
    }

    return {
      lokasi_rondaan: lokasi,
      pemeriksaan: { lelaki, perempuan, jumlah },
      tangkapan,
      rampasan,
      catatan_no_repot: catatanRepot
    };
  }

  if (jenis === "BALAI POLIS BERGERAK" || jenis === "PONDOK POLIS") {
    const noRepot = teks(el("lapNoRepot")?.value);
    const catatan = teks(el("lapCatatan")?.value);

    if (!noRepot) throw new Error("Sila masukkan No. Repot. Jika tiada, masukkan TIADA.");
    if (!catatan) throw new Error("Sila masukkan catatan.");

    return { no_repot: noRepot, catatan };
  }

  if (jenis === "UNIT PEMUSNAH BOM") {
    const lokasi = teks(el("lapLokasi")?.value);
    const vvipVip = dapatkanAdaTiadaLaporan("lapVvipVip");
    const ancaman = dapatkanAdaTiadaLaporan("lapAncaman");
    const catatan = teks(el("lapCatatan")?.value);

    if (!lokasi) throw new Error("Sila masukkan lokasi.");
    if (vvipVip.status === "ADA" && !vvipVip.butiran) {
      throw new Error("Sila masukkan butiran VVIP / VIP.");
    }
    if (ancaman.status === "ADA" && !ancaman.butiran) {
      throw new Error("Sila masukkan jenis ancaman.");
    }
    if (!catatan) throw new Error("Sila masukkan catatan.");

    return { lokasi, vvip_vip: vvipVip, jenis_ancaman: ancaman, catatan };
  }

  throw new Error(`Borang bagi jenis tugas "${tugas?.jenisTugas || "-"}" belum disediakan.`);
}

async function hantarLaporan() {
  const btn = el("btnHantarLaporan");

  const jenisSemasa =
    normalisasiJenisTugasPelaporan(
      tugas?.jenisTugas
    );

  /*
    Perlindungan pada masa submit juga.
    Litupan Keselamatan mesti PENYELIA.
  */
  if (
    jenisSemasa === "LITUPAN KESELAMATAN" &&
    atas(tugas?.penyelia) !== "YA"
  ) {
    paparStatus(
      "statusLaporan",
      "Borang Litupan Keselamatan hanya boleh dihantar oleh Penyelia.",
      "error"
    );
    return;
  }

  if (!petugasLayakHantarLaporan(tugas) || statusKehadiranSemasa !== "HADIR" || sudahCheckOutSemasa) {
    paparStatus("statusLaporan", "Pelaporan tidak dibenarkan.", "error");
    return;
  }

  let dataLaporan;
  try {
    dataLaporan = binaDataLaporan();
  } catch (err) {
    paparStatus("statusLaporan", escapeHtml(err.message), "error");
    return;
  }

  if (!confirm("Adakah anda pasti mahu menghantar laporan ini kepada URUSETIA?")) return;

  btn.disabled = true;
  btn.textContent = "SEDANG MENGHANTAR...";
  paparStatus("statusLaporan", "Sedang menghantar laporan...", "warning");

  try {
    const jenis = normalisasiJenisTugasPelaporan(tugas.jenisTugas);

    const payload = {
      penugasan_id: tugas.id,
      petugas_id: userLogin.id,
      jenis_tugas: jenis,
      data_laporan: dataLaporan
    };

    /* Kekalkan kolum lama untuk keserasian sementara dengan paparan Urusetia/Admin lama. */
    if (jenis === "LITUPAN KESELAMATAN") {
      payload.jumlah_pengunjung = 0;
      payload.jumlah_kenderaan = 0;

      /*
        Carta VVIP/VIP sedia ada boleh terus membaca rekod ini.
      */
      payload.vvip_vip =
        `${dataLaporan.kategori} — ${dataLaporan.nama}`;

      payload.perkara_menarik =
        dataLaporan.catatan ||
        dataLaporan.tujuan_aktiviti ||
        "";

    } else if (jenis === "SUBTEK") {
      payload.jumlah_pengunjung =
        dataLaporan.jumlah_pengunjung;

      payload.jumlah_kenderaan =
        dataLaporan.jumlah_kenderaan_pengunjung;

      payload.vvip_vip =
        dataLaporan.vvip_vip.status === "ADA"
          ? dataLaporan.vvip_vip.butiran
          : "TIADA";

      payload.perkara_menarik =
        dataLaporan.catatan;

    } else if (jenis === "KAWALAN KESELAMATAN") {
      payload.jumlah_pengunjung = dataLaporan.jumlah_pengunjung;
      payload.jumlah_kenderaan = dataLaporan.kenderaan.jumlah;
      payload.vvip_vip = dataLaporan.vvip_vip.status === "ADA" ? dataLaporan.vvip_vip.butiran : "TIADA";
      payload.perkara_menarik = dataLaporan.catatan;
    } else if (jenis === "KAWALAN LALULINTAS") {
      payload.jumlah_pengunjung = 0;
      payload.jumlah_kenderaan = dataLaporan.jumlah_kenderaan;
      payload.vvip_vip = "TIADA";
      payload.perkara_menarik = dataLaporan.catatan_tindakan;
    } else {
      payload.jumlah_pengunjung = 0;
      payload.jumlah_kenderaan = 0;
      payload.vvip_vip = "TIADA";
      payload.perkara_menarik = dataLaporan.catatan || dataLaporan.catatan_no_repot || "";
    }

    const { error } = await db.from("pelaporan").insert(payload);
    if (error) throw error;

    paparStatus("statusLaporan", "<strong>LAPORAN BERJAYA DIHANTAR.</strong>", "success");
    btn.textContent = "LAPORAN TELAH DIHANTAR";

    setTimeout(() => tutupLaporan(), 1800);

  } catch (err) {
    console.error("Ralat menghantar laporan:", err);
    btn.disabled = false;
    btn.textContent =
      jenisSemasa === "LITUPAN KESELAMATAN"
        ? "HANTAR LAPORAN LITUPAN KESELAMATAN"
        : jenisSemasa === "SUBTEK"
          ? "HANTAR LAPORAN SUBTEK KEPADA URUSETIA"
          : "HANTAR LAPORAN KEPADA URUSETIA";

    paparStatus("statusLaporan", `Ralat menghantar laporan: ${escapeHtml(err.message)}`, "error");
  }
}

async function refreshDashboard() {
  if (!userLogin) return;
  const b = el("btnRefreshStatus"); if (b) { b.disabled = true; b.textContent = "SEDANG MENYEMAK..."; }
  try {
    const ada = await dapatkanTugasHariIni();
    if (ada) await semakStatusCheckInPetugas();
    if (window.SKPOWalkie?.muatSemula) await window.SKPOWalkie.muatSemula();
  } finally { if (b) { b.disabled = false; b.textContent = "SEMAK SEMULA STATUS"; } }
}
function mulaSemakanStatusAutomatik() {
  hentikanSemakanStatusAutomatik();
  timerSemakStatus = setInterval(() => {
    if (userLogin && el("dashboard")?.style.display === "block") refreshDashboard();
  }, SELANG_SEMAKAN_STATUS);
}
function hentikanSemakanStatusAutomatik() { if (timerSemakStatus) clearInterval(timerSemakStatus); timerSemakStatus = null; }
function kembaliDashboard() { el("checkin").style.display = "none"; el("dashboard").style.display = "block"; }
function kembaliDashboardCheckout() { el("checkout").style.display = "none"; el("dashboard").style.display = "block"; }

/* PAPARAN PETA OPERASI */
let skalaPeta = 1;

function bukaPeta() {
  const modal = el("modalPeta");
  if (!modal) return;
  resetZumPeta();
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("peta-terbuka");
}

function tutupPeta() {
  const modal = el("modalPeta");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("peta-terbuka");
  el("btnPaparPeta")?.focus();
}

function paparSkalaPeta() {
  const imej = el("imejPeta");
  const status = el("statusPeta");
  if (imej) imej.style.width = `${Math.round(skalaPeta * 100)}%`;
  if (status) {
    status.textContent = `Zum: ${Math.round(skalaPeta * 100)}%`;
    status.classList.remove("error");
  }
}

function ubahZumPeta(perubahan) {
  skalaPeta = Math.min(3, Math.max(0.5, skalaPeta + perubahan));
  paparSkalaPeta();
}

function resetZumPeta() {
  skalaPeta = 1;
  paparSkalaPeta();
  const ruang = el("ruangPeta");
  if (ruang) { ruang.scrollTop = 0; ruang.scrollLeft = 0; }
}

function petaBerjayaDimuatkan() { paparSkalaPeta(); }

function petaGagalDimuatkan() {
  const status = el("statusPeta");
  if (!status) return;
  status.textContent = "Peta belum ditemui. Muat naik fail images/peta.png ke GitHub.";
  status.classList.add("error");
}

async function logout() {
  tutupPeta();
  hentikanSemakanStatusAutomatik(); await db.auth.signOut().catch(() => {}); localStorage.removeItem(KUNCI_USER_MOTOGP);
  userLogin = tugas = lokasiGPS = lokasiGPSCheckout = rekodCheckinSemasa = null;
  ["dashboard", "checkin", "checkout", "laporan"].forEach(id => { if (el(id)) el(id).style.display = "none"; });
  const loginBox = el("loginBox");
  if (loginBox) {
    loginBox.style.removeProperty("display");
    loginBox.classList.add("login-visible");
  }
  el("password").value = "";
  el("status").innerHTML = "";
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}
function kosongkanMaklumatTugas() { ["callSignTugas", "jenisTugas", "lokasiTugas", "penyeliaTugas", "pemegangSetTugas"].forEach(id => el(id).textContent = "-"); }
function binaBarisMaklumat(label, nilai) { return `<div class="info-row"><div class="info-label">${escapeHtml(label)}</div><div class="info-value">${escapeHtml(nilai || "-")}</div></div>`; }
function kiraJarakMeter(lat1, lng1, lat2, lng2) {
  const R = 6371000, dLat = darjahKeRadian(lat2 - lat1), dLng = darjahKeRadian(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(darjahKeRadian(lat1)) * Math.cos(darjahKeRadian(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function darjahKeRadian(v) { return v * Math.PI / 180; }

document.addEventListener("DOMContentLoaded", () => {
  el("password")?.addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  pulihkanSesi();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !el("modalPeta")?.hidden) tutupPeta();
});