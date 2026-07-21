"use strict";

/* ================================================================
   SKPO — MODUL TSM
================================================================ */

const dbTSM = window.supabaseClient;
const ZON_MASA_TSM = "Asia/Kuala_Lumpur";

let penggunaTSM = null;
let dataTSM = [];
let rekodAktifTSM = null;

function elTSM(id) { return document.getElementById(id); }
function teksTSM(v) { return String(v ?? "").trim(); }
function atasTSM(v) { return teksTSM(v).toUpperCase(); }
function htmlTSM(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function emailTSM(noBadan) {
  return `${teksTSM(noBadan).toLowerCase().replace(/[^a-z0-9_-]/g, "")}@skpo.local`;
}
function hariIniTSM() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA_TSM, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}
function masaTSM(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return teksTSM(v) || "-";
  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA_TSM, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(d);
}
function paparStatusTSM(id, mesej, jenis = "warning") {
  const e = elTSM(id); if (!e) return;
  e.className = `status ${jenis}`; e.innerHTML = mesej;
}
async function ambilProfilTSM(userId) {
  let r = await dbTSM.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (r.error && /auth_user_id/i.test(r.error.message || "")) {
    r = await dbTSM.from("profiles").select("*").eq("auth_user_id", userId).maybeSingle();
  }
  if (r.error) throw r.error;
  return r.data;
}
function perananTSM(v) { return ["TSM", "PENTADBIR", "ADMIN"].includes(atasTSM(v)); }

async function loginTSM() {
  const noBadan = atasTSM(elTSM("noBadan").value);
  const password = elTSM("password").value;
  const btn = elTSM("btnLogin");
  if (!noBadan || !password) return paparStatusTSM("loginStatus", "Sila lengkapkan maklumat login.", "error");

  btn.disabled = true; btn.textContent = "SEDANG MENYEMAK...";
  paparStatusTSM("loginStatus", "Sedang menyemak...", "warning");
  try {
    if (!dbTSM?.auth) throw new Error(window.SKPO_SUPABASE_ERROR || "Supabase belum disambungkan.");
    const { data, error } = await dbTSM.auth.signInWithPassword({ email: emailTSM(noBadan), password });
    if (error || !data.user) throw new Error("No Badan atau kata laluan tidak sah.");
    const profil = await ambilProfilTSM(data.user.id);
    if (!profil) throw new Error("Profil TSM tidak ditemui.");
    if (profil.aktif === false) throw new Error("Akaun telah dinyahaktifkan.");
    if (!perananTSM(profil.peranan)) throw new Error(`Akses ditolak. Peranan akaun ialah ${atasTSM(profil.peranan)}.`);
    penggunaTSM = { ...profil, authUserId: data.user.id };
    paparDashboardTSM(); await muatDataTSM();
  } catch (error) {
    await dbTSM?.auth?.signOut().catch(() => {});
    paparStatusTSM("loginStatus", htmlTSM(error.message), "error");
  } finally { btn.disabled = false; btn.textContent = "LOGIN TSM"; }
}

function paparDashboardTSM() {
  elTSM("loginSection").style.display = "none";
  elTSM("dashboardSection").style.display = "block";
  elTSM("profilTSM").textContent = [penggunaTSM.pangkat, penggunaTSM.nama, `(${penggunaTSM.no_badan})`].filter(Boolean).join(" ");
}

async function pulihkanSesiTSM() {
  try {
    if (!dbTSM?.auth) return paparStatusTSM("loginStatus", htmlTSM(window.SKPO_SUPABASE_ERROR || "Supabase belum disambungkan."), "error");
    const { data } = await dbTSM.auth.getSession();
    if (!data.session?.user) return;
    const profil = await ambilProfilTSM(data.session.user.id);
    if (!profil || profil.aktif === false || !perananTSM(profil.peranan)) return;
    penggunaTSM = { ...profil, authUserId: data.session.user.id };
    paparDashboardTSM(); await muatDataTSM();
  } catch (error) { paparStatusTSM("loginStatus", htmlTSM(error.message), "error"); }
}

async function muatDataTSM() {
  if (!penggunaTSM) return;
  const tarikh = elTSM("tarikh").value || hariIniTSM();
  elTSM("tarikh").value = tarikh;
  paparStatusTSM("statusData", "Sedang mendapatkan permohonan...", "warning");
  try {
    const tugasRes = await dbTSM.from("penugasan").select("*").eq("tarikh", tarikh);
    if (tugasRes.error) throw tugasRes.error;
    const tugasan = tugasRes.data || [];
    const tugasIds = tugasan.map(x => x.id);

    let walkie = [];
    if (tugasIds.length) {
      const wRes = await dbTSM.from("walkie_talkie").select("*").in("penugasan_id", tugasIds).order("created_at", { ascending: false });
      if (wRes.error) throw wRes.error;
      walkie = wRes.data || [];
    }

    const petugasIds = [...new Set(walkie.map(x => x.petugas_id).filter(Boolean))];
    let profil = [];
    if (petugasIds.length) {
      const pRes = await dbTSM.from("profiles").select("*").in("id", petugasIds);
      if (pRes.error) throw pRes.error;
      profil = pRes.data || [];
    }

    const tugasMap = new Map(tugasan.map(x => [x.id, x]));
    const profilMap = new Map(profil.map(x => [x.id, x]));
    dataTSM = walkie.map(x => ({ rekod: x, tugas: tugasMap.get(x.penugasan_id) || {}, profil: profilMap.get(x.petugas_id) || {} }));
    paparDataTSM();
    paparStatusTSM("statusData", `${dataTSM.length} permohonan berjaya dimuatkan.`, "success");
  } catch (error) {
    dataTSM = []; paparDataTSM();
    paparStatusTSM("statusData", `Ralat: ${htmlTSM(error.message)}`, "error");
  }
}

function paparDataTSM() {
  const status = atasTSM(elTSM("statusFilter").value);
  const carian = atasTSM(elTSM("carian").value);
  const senarai = dataTSM.filter(item => {
    if (status && atasTSM(item.rekod.status) !== status) return false;
    const gabung = atasTSM([item.profil.no_badan, item.profil.pangkat, item.profil.nama,
      item.tugas.call_sign, item.tugas.jenis_tugas, item.tugas.tempat_tugas,
      item.rekod.no_siri_set, item.rekod.status].join(" "));
    return !carian || gabung.includes(carian);
  });

  elTSM("statJumlah").textContent = dataTSM.length;
  elTSM("statMenunggu").textContent = dataTSM.filter(x => atasTSM(x.rekod.status) === "MENUNGGU").length;
  elTSM("statDilepaskan").textContent = dataTSM.filter(x => atasTSM(x.rekod.status) === "DILEPASKAN").length;
  elTSM("statPemulangan").textContent = dataTSM.filter(x => atasTSM(x.rekod.status) === "MENUNGGU_PEMULANGAN").length;
  elTSM("statDipulangkan").textContent = dataTSM.filter(x => atasTSM(x.rekod.status) === "DIPULANGKAN").length;

  const tbody = elTSM("tbodyTSM");
  if (!senarai.length) {
    tbody.innerHTML = '<tr><td colspan="12" class="empty">Tiada permohonan ditemui.</td></tr>';
    return;
  }

  tbody.innerHTML = senarai.map((item, i) => {
    const r = item.rekod, s = atasTSM(r.status);
    let tindakan = "-";
    if (s === "MENUNGGU") tindakan = `
      <div class="table-actions">
        <button class="btn-ok btn-small" onclick="bukaModalPelepasan('${htmlTSM(r.id)}')">LEPASKAN</button>
        <button class="btn-no btn-small" onclick="tolakPermohonan('${htmlTSM(r.id)}')">TOLAK</button>
      </div>`;
    if (s === "MENUNGGU_PEMULANGAN") tindakan = `<button class="btn-ok btn-small" onclick="bukaModalPemulangan('${htmlTSM(r.id)}')">SAHKAN PULANG</button>`;

    return `<tr>
      <td>${i + 1}</td>
      <td>${htmlTSM(masaTSM(r.masa_permohonan || r.created_at))}</td>
      <td>${htmlTSM(item.profil.no_badan || "-")}</td>
      <td><strong>${htmlTSM(item.profil.pangkat || "-")}</strong><br>${htmlTSM(item.profil.nama || "-")}</td>
      <td>${htmlTSM(item.tugas.call_sign || "-")}</td>
      <td>${htmlTSM(item.tugas.jenis_tugas || "-")}<br>${htmlTSM(item.tugas.tempat_tugas || item.tugas.lokasi || "-")}</td>
      <td>${htmlTSM(r.no_siri_set || "-")}</td>
      <td>${htmlTSM(r.no_siri_bateri || "-")}</td>
      <td>${htmlTSM(r.no_siri_charger || "-")}</td>
      <td>${htmlTSM(Array.isArray(r.aksesori) ? r.aksesori.join(", ") : r.aksesori || "-")}</td>
      <td><span class="status-badge status-${s.toLowerCase().replaceAll("_", "-")}">${htmlTSM(s)}</span></td>
      <td>${tindakan}</td>
    </tr>`;
  }).join("");
}

function cariRekodTSM(id) { return dataTSM.find(x => x.rekod.id === id) || null; }

function bukaModalPelepasan(id) {
  rekodAktifTSM = cariRekodTSM(id); if (!rekodAktifTSM) return;
  elTSM("infoPelepasan").innerHTML = `<strong>${htmlTSM(rekodAktifTSM.profil.pangkat || "")} ${htmlTSM(rekodAktifTSM.profil.nama || "-")}</strong><br>No Badan: ${htmlTSM(rekodAktifTSM.profil.no_badan || "-")}<br>Call Sign: ${htmlTSM(rekodAktifTSM.tugas.call_sign || "-")}`;
  ["noSiriSet", "noSiriBateri", "noSiriCharger", "catatanTSM"].forEach(idElemen => elTSM(idElemen).value = "");
  document.querySelectorAll('input[name="aksesoriTSM"]').forEach(x => x.checked = false);
  elTSM("statusPelepasan").className = "status hidden";
  elTSM("modalPelepasan").classList.remove("hidden");
}
function tutupModalPelepasan() { rekodAktifTSM = null; elTSM("modalPelepasan").classList.add("hidden"); }

async function sahkanPelepasan() {
  if (!rekodAktifTSM) return;
  const noSet = atasTSM(elTSM("noSiriSet").value);
  if (!noSet) return paparStatusTSM("statusPelepasan", "No Siri Set wajib diisi.", "error");
  const aksesori = [...document.querySelectorAll('input[name="aksesoriTSM"]:checked')].map(x => x.value);
  try {
    const { error } = await dbTSM.from("walkie_talkie").update({
      no_siri_set: noSet,
      no_siri_bateri: atasTSM(elTSM("noSiriBateri").value) || null,
      no_siri_charger: atasTSM(elTSM("noSiriCharger").value) || null,
      aksesori,
      catatan_tsm: teksTSM(elTSM("catatanTSM").value) || null,
      status: "DILEPASKAN",
      masa_pelepasan: new Date().toISOString(),
      disahkan_oleh: penggunaTSM.authUserId
    }).eq("id", rekodAktifTSM.rekod.id);
    if (error) throw error;
    tutupModalPelepasan(); await muatDataTSM();
  } catch (error) { paparStatusTSM("statusPelepasan", htmlTSM(error.message), "error"); }
}

async function tolakPermohonan(id) {
  const sebab = prompt("Nyatakan sebab penolakan:");
  if (sebab === null) return;
  if (!teksTSM(sebab)) return alert("Sebab penolakan wajib diisi.");
  const { error } = await dbTSM.from("walkie_talkie").update({ status: "DITOLAK", sebab_ditolak: teksTSM(sebab), disahkan_oleh: penggunaTSM.authUserId }).eq("id", id);
  if (error) return alert(error.message);
  await muatDataTSM();
}

function bukaModalPemulangan(id) {
  rekodAktifTSM = cariRekodTSM(id); if (!rekodAktifTSM) return;
  elTSM("infoPemulangan").innerHTML = `<strong>Set ${htmlTSM(rekodAktifTSM.rekod.no_siri_set || "-")}</strong><br>${htmlTSM(rekodAktifTSM.profil.pangkat || "")} ${htmlTSM(rekodAktifTSM.profil.nama || "-")}`;
  elTSM("keadaanSet").value = "BAIK"; elTSM("kerosakan").value = "TIADA"; elTSM("catatanPemulangan").value = "";
  elTSM("statusPemulangan").className = "status hidden";
  elTSM("modalPemulangan").classList.remove("hidden");
}
function tutupModalPemulangan() { rekodAktifTSM = null; elTSM("modalPemulangan").classList.add("hidden"); }

async function sahkanPemulangan() {
  if (!rekodAktifTSM) return;
  const kerosakan = teksTSM(elTSM("kerosakan").value);
  if (!kerosakan) return paparStatusTSM("statusPemulangan", "Ruangan kerosakan wajib diisi. Masukkan TIADA jika tiada.", "error");
  try {
    const { error } = await dbTSM.from("walkie_talkie").update({
      status: "DIPULANGKAN",
      keadaan_set: atasTSM(elTSM("keadaanSet").value),
      kerosakan,
      catatan_tsm: teksTSM(elTSM("catatanPemulangan").value) || rekodAktifTSM.rekod.catatan_tsm || null,
      masa_pemulangan: new Date().toISOString(),
      diterima_oleh: penggunaTSM.authUserId
    }).eq("id", rekodAktifTSM.rekod.id);
    if (error) throw error;
    tutupModalPemulangan(); await muatDataTSM();
  } catch (error) { paparStatusTSM("statusPemulangan", htmlTSM(error.message), "error"); }
}

async function logoutTSM() {
  await dbTSM?.auth?.signOut().catch(() => {});
  penggunaTSM = null; dataTSM = [];
  elTSM("dashboardSection").style.display = "none";
  elTSM("loginSection").style.display = "block";
  elTSM("password").value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  elTSM("tarikh").value = hariIniTSM();
  elTSM("password").addEventListener("keydown", e => { if (e.key === "Enter") loginTSM(); });
  pulihkanSesiTSM();
});
