"use strict";

/* SKPO V2 - Petugas (GitHub Pages + Supabase) */

const db = window.supabaseClient;
const ZON_MASA = "Asia/Kuala_Lumpur";
const SELANG_SEMAKAN_STATUS = 15000;

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
  const kunci = "skpoDeviceId";
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
    userLogin = {
      id: profil.id, authUserId: data.user.id, noBadan: profil.no_badan,
      pangkat: profil.pangkat || "", nama: profil.nama || "", peranan: profil.peranan || "PETUGAS"
    };
    localStorage.setItem("user", JSON.stringify(userLogin));
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
    userLogin = {
      id: profil.id, authUserId: data.session.user.id, noBadan: profil.no_badan,
      pangkat: profil.pangkat || "", nama: profil.nama || "", peranan: profil.peranan || "PETUGAS"
    };
    localStorage.setItem("user", JSON.stringify(userLogin));
    paparDashboardProfil(); await refreshDashboard(); mulaSemakanStatusAutomatik();
  } catch (err) { console.error("Pemulihan sesi gagal:", err); }
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
function petugasLayakHantarLaporan(t) { return !!t && (nilaiBoolean(t.penyelia) || nilaiBoolean(t.pemegangSet)); }
function kemasKiniButangPelaporan(t) {
  const b = el("btnLaporan"); if (!b) return;
  const layak = petugasLayakHantarLaporan(t);
  b.style.display = layak ? "block" : "none";
  b.disabled = !(layak && statusKehadiranSemasa === "HADIR" && !sudahCheckOutSemasa);
  b.textContent = !layak ? "HANTAR PELAPORAN" : sudahCheckOutSemasa
    ? "PELAPORAN DITUTUP SELEPAS CHECK-OUT"
    : statusKehadiranSemasa !== "HADIR" ? "PELAPORAN MENUNGGU PENGESAHAN URUSETIA" : "HANTAR PELAPORAN";
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
  const dibenar = gps.accuracy <= 50 && jarak <= radius;
  if (keluar) lokasiCheckoutDibenarkan = dibenar; else lokasiDibenarkan = dibenar;
  el(jarakId).innerHTML = dibenar
    ? `<span class="status-success">Lokasi berjaya disahkan (jarak ${jarak.toFixed(1)} meter).</span>`
    : `<span class="status-error">Lokasi tidak dibenarkan. Jarak ${jarak.toFixed(1)} meter; radius ${radius} meter.</span>`;
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

function bukaLaporan() {
  if (!petugasLayakHantarLaporan(tugas) || statusKehadiranSemasa !== "HADIR" || sudahCheckOutSemasa) {
    alert("Pelaporan hanya dibenarkan selepas kehadiran disahkan, sebelum Check-Out, kepada Penyelia atau Pemegang Set."); return;
  }
  el("dashboard").style.display = "none"; el("laporan").style.display = "block";
  el("tugasLaporan").innerHTML = binaBarisMaklumat("Call Sign:", tugas.callSign) + binaBarisMaklumat("Jenis Tugas:", tugas.jenisTugas) + binaBarisMaklumat("Tempat Tugas:", tugas.lokasi) + binaBarisMaklumat("Penyelia:", tugas.penyelia);
  kemasKiniTarikhMasaLaporan();
  ["jumlahPengunjung", "jumlahKenderaan", "vvipVip", "perkaraMenarik"].forEach(id => el(id).value = "");
  el("statusLaporan").style.display = "none"; el("btnHantarLaporan").disabled = false;
}
function kemasKiniTarikhMasaLaporan() { el("tarikhMasaLaporan").textContent = formatTarikhMasa(new Date()); }
function tutupLaporan() { el("laporan").style.display = "none"; el("dashboard").style.display = "block"; }
async function hantarLaporan() {
  const jp = Number(el("jumlahPengunjung").value), jk = Number(el("jumlahKenderaan").value);
  const vip = teks(el("vvipVip").value), menarik = teks(el("perkaraMenarik").value), btn = el("btnHantarLaporan");
  if (!petugasLayakHantarLaporan(tugas) || statusKehadiranSemasa !== "HADIR" || sudahCheckOutSemasa) return paparStatus("statusLaporan", "Pelaporan tidak dibenarkan.", "error");
  if (!Number.isInteger(jp) || jp < 0 || !Number.isInteger(jk) || jk < 0 || !vip || !menarik) return paparStatus("statusLaporan", "Sila lengkapkan semua ruangan dengan nilai yang sah.", "error");
  if (!confirm("Hantar laporan ini kepada URUSETIA?")) return;
  btn.disabled = true; btn.textContent = "SEDANG MENGHANTAR...";
  try {
    const { error } = await db.from("pelaporan").insert({
      penugasan_id: tugas.id, petugas_id: userLogin.id, jumlah_pengunjung: jp,
      jumlah_kenderaan: jk, vvip_vip: vip, perkara_menarik: menarik
    });
    if (error) throw error;
    paparStatus("statusLaporan", "<strong>LAPORAN BERJAYA DIHANTAR.</strong>", "success");
    btn.textContent = "LAPORAN TELAH DIHANTAR"; setTimeout(tutupLaporan, 1800);
  } catch (err) { btn.disabled = false; btn.textContent = "HANTAR LAPORAN KEPADA URUSETIA"; paparStatus("statusLaporan", escapeHtml(err.message), "error"); }
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
  hentikanSemakanStatusAutomatik(); await db.auth.signOut().catch(() => {}); localStorage.removeItem("user");
  userLogin = tugas = lokasiGPS = lokasiGPSCheckout = rekodCheckinSemasa = null;
  ["dashboard", "checkin", "checkout", "laporan"].forEach(id => { if (el(id)) el(id).style.display = "none"; });
  el("loginBox").style.display = "block"; el("password").value = ""; el("status").innerHTML = "";
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
