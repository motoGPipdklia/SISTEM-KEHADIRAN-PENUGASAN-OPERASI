"use strict";

/* ================================================================
   SKPO — URUSETIA / PENYELIA
================================================================ */

const dbPenyelia = window.supabaseClient;
const ZON_MASA_PENYELIA = "Asia/Kuala_Lumpur";

let penggunaPenyelia = null;
let dataPenyelia = [];

function elemenPenyelia(id) {
  return document.getElementById(id);
}

function teksPenyelia(nilai) {
  return String(nilai ?? "").trim();
}

function atasPenyelia(nilai) {
  return teksPenyelia(nilai).toUpperCase();
}

function htmlPenyelia(nilai) {
  return String(nilai ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailPenyelia(noBadan) {
  return `${teksPenyelia(noBadan).toLowerCase().replace(/[^a-z0-9_-]/g, "")}@skpo.local`;
}

function hariIniPenyelia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA_PENYELIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function formatMasaPenyelia(nilai) {
  if (!nilai) return "-";
  const tarikh = new Date(nilai);
  if (Number.isNaN(tarikh.getTime())) return teksPenyelia(nilai) || "-";

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA_PENYELIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(tarikh);
}

function statusPenyelia(id, mesej, jenis = "warning") {
  const elemen = elemenPenyelia(id);
  if (!elemen) return;
  elemen.className = `status ${jenis}`;
  elemen.innerHTML = mesej;
}

async function profilPenyelia(userId) {
  let hasil = await dbPenyelia.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (hasil.error && /auth_user_id/i.test(hasil.error.message || "")) {
    hasil = await dbPenyelia.from("profiles").select("*").eq("auth_user_id", userId).maybeSingle();
  }
  if (hasil.error) throw hasil.error;
  return hasil.data;
}

function perananPenyeliaDibenarkan(peranan) {
  return ["URUSETIA", "PENYELIA", "PENTADBIR", "ADMIN"].includes(atasPenyelia(peranan));
}

async function loginPenyelia() {
  const noBadan = atasPenyelia(elemenPenyelia("noBadan").value);
  const password = elemenPenyelia("password").value;
  const butang = elemenPenyelia("btnLogin");

  if (!noBadan || !password) {
    statusPenyelia("loginStatus", "Sila masukkan No Badan dan kata laluan.", "error");
    return;
  }

  butang.disabled = true;
  butang.textContent = "SEDANG MENYEMAK...";
  statusPenyelia("loginStatus", "Sedang menyemak...", "warning");

  try {
    if (!dbPenyelia?.auth) throw new Error(window.SKPO_SUPABASE_ERROR || "Supabase belum disambungkan.");

    const { data, error } = await dbPenyelia.auth.signInWithPassword({
      email: emailPenyelia(noBadan),
      password
    });

    if (error || !data.user) throw new Error("No Badan atau kata laluan tidak sah.");

    const profil = await profilPenyelia(data.user.id);
    if (!profil) throw new Error("Profil Urusetia tidak ditemui.");
    if (profil.aktif === false) throw new Error("Akaun telah dinyahaktifkan.");
    if (!perananPenyeliaDibenarkan(profil.peranan)) {
      throw new Error(`Akses ditolak. Peranan akaun ialah ${atasPenyelia(profil.peranan) || "TIDAK DITETAPKAN"}.`);
    }

    penggunaPenyelia = { ...profil, authUserId: data.user.id };
    paparDashboardPenyelia();
    await muatDataPenyelia();
  } catch (error) {
    await dbPenyelia?.auth?.signOut().catch(() => {});
    statusPenyelia("loginStatus", htmlPenyelia(error.message), "error");
  } finally {
    butang.disabled = false;
    butang.textContent = "LOGIN URUSETIA";
  }
}

function paparDashboardPenyelia() {
  elemenPenyelia("loginSection").classList.add("hidden");
  elemenPenyelia("dashboardSection").classList.remove("hidden");
  elemenPenyelia("profilPenyelia").innerHTML = `
    <strong>${htmlPenyelia(penggunaPenyelia.pangkat || "")} ${htmlPenyelia(penggunaPenyelia.nama || "-")}</strong><br>
    No Badan: ${htmlPenyelia(penggunaPenyelia.no_badan || "-")}<br>
    Peranan: ${htmlPenyelia(atasPenyelia(penggunaPenyelia.peranan))}
  `;
}

async function pulihkanSesiPenyelia() {
  try {
    if (!dbPenyelia?.auth) {
      statusPenyelia("loginStatus", htmlPenyelia(window.SKPO_SUPABASE_ERROR || "Supabase belum disambungkan."), "error");
      return;
    }

    const { data } = await dbPenyelia.auth.getSession();
    if (!data.session?.user) return;

    const profil = await profilPenyelia(data.session.user.id);
    if (!profil || profil.aktif === false || !perananPenyeliaDibenarkan(profil.peranan)) return;

    penggunaPenyelia = { ...profil, authUserId: data.session.user.id };
    paparDashboardPenyelia();
    await muatDataPenyelia();
  } catch (error) {
    statusPenyelia("loginStatus", htmlPenyelia(error.message), "error");
  }
}

async function muatDataPenyelia() {
  if (!penggunaPenyelia) return;

  const tarikh = elemenPenyelia("tarikh").value || hariIniPenyelia();
  elemenPenyelia("tarikh").value = tarikh;
  statusPenyelia("statusData", "Sedang mendapatkan rekod kehadiran...", "warning");

  try {
    const tugasanRes = await dbPenyelia.from("penugasan").select("*").eq("tarikh", tarikh);
    if (tugasanRes.error) throw tugasanRes.error;

    const tugasan = tugasanRes.data || [];
    const petugasIds = [...new Set(tugasan.map(item => item.petugas_id || item.profile_id).filter(Boolean))];

    let profil = [];
    if (petugasIds.length) {
      const profilRes = await dbPenyelia.from("profiles").select("*").in("id", petugasIds);
      if (profilRes.error) throw profilRes.error;
      profil = profilRes.data || [];
    }

    const checkinRes = await dbPenyelia.from("checkin").select("*").eq("tarikh", tarikh);
    if (checkinRes.error) throw checkinRes.error;

    const profilMap = new Map(profil.map(item => [item.id, item]));
    const checkinMap = new Map((checkinRes.data || []).map(item => [item.penugasan_id, item]));

    dataPenyelia = tugasan.map(item => {
      const petugas = profilMap.get(item.petugas_id || item.profile_id) || {};
      const checkin = checkinMap.get(item.id) || null;
      return {
        idPenugasan: item.id,
        profil: petugas,
        tugas: item,
        checkin,
        status: atasPenyelia(item.status) === "DIGANTI"
          ? "DIGANTI"
          : checkin ? (atasPenyelia(checkin.status) || "MENUNGGU") : "BELUM HADIR"
      };
    });

    paparSenarai();
    statusPenyelia("statusData", `${dataPenyelia.length} rekod berjaya dimuatkan.`, "success");
  } catch (error) {
    dataPenyelia = [];
    paparSenarai();
    statusPenyelia("statusData", `Ralat: ${htmlPenyelia(error.message)}`, "error");
  }
}

function paparSenarai() {
  const carian = atasPenyelia(elemenPenyelia("carian").value);
  const senarai = dataPenyelia.filter(item => {
    const gabung = atasPenyelia([
      item.profil.no_badan,
      item.profil.pangkat,
      item.profil.nama,
      item.tugas.call_sign,
      item.tugas.jenis_tugas,
      item.tugas.tempat_tugas || item.tugas.lokasi,
      item.status
    ].join(" "));
    return !carian || gabung.includes(carian);
  });

  elemenPenyelia("jumlahRekod").textContent = senarai.length;
  elemenPenyelia("jumlahMenunggu").textContent = senarai.filter(item => item.status === "MENUNGGU").length;

  const bekas = elemenPenyelia("senaraiPetugas");
  if (!senarai.length) {
    bekas.innerHTML = '<div class="empty">Tiada rekod ditemui.</div>';
    return;
  }

  bekas.innerHTML = senarai.map(item => {
    const bolehTindak = item.checkin && item.status === "MENUNGGU";
    return `
      <article class="record">
        <h3>${htmlPenyelia(item.tugas.call_sign || "TIADA CALL SIGN")}</h3>
        <div class="grid">
          <div class="label">Petugas</div>
          <div>${htmlPenyelia(item.profil.pangkat || "-")} ${htmlPenyelia(item.profil.nama || "-")}</div>
          <div class="label">No Badan</div>
          <div>${htmlPenyelia(item.profil.no_badan || "-")}</div>
          <div class="label">Tugas</div>
          <div>${htmlPenyelia(item.tugas.jenis_tugas || "-")}</div>
          <div class="label">Lokasi</div>
          <div>${htmlPenyelia(item.tugas.tempat_tugas || item.tugas.lokasi || "-")}</div>
          <div class="label">Masa Check-In</div>
          <div>${htmlPenyelia(formatMasaPenyelia(item.checkin?.masa_checkin))}</div>
          <div class="label">Status</div>
          <div><strong>${htmlPenyelia(item.status)}</strong></div>
        </div>
        ${bolehTindak ? `
          <div class="actions">
            <button class="btn-ok" type="button" onclick="sahkanKehadiran('${htmlPenyelia(item.checkin.id)}')">SAHKAN HADIR</button>
            <button class="btn-no" type="button" onclick="tolakKehadiran('${htmlPenyelia(item.checkin.id)}')">TOLAK</button>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}

async function sahkanKehadiran(checkinId) {
  if (!confirm("Sahkan kehadiran petugas ini?")) return;
  await ubahStatusKehadiran(checkinId, "HADIR", null);
}

async function tolakKehadiran(checkinId) {
  const sebab = prompt("Nyatakan sebab penolakan:");
  if (sebab === null) return;
  if (!teksPenyelia(sebab)) return alert("Sebab penolakan wajib diisi.");
  await ubahStatusKehadiran(checkinId, "DITOLAK", teksPenyelia(sebab));
}

async function ubahStatusKehadiran(checkinId, status, sebab) {
  try {
    const { error } = await dbPenyelia
      .from("checkin")
      .update({
        status,
        disahkan_oleh: penggunaPenyelia.authUserId,
        masa_pengesahan: new Date().toISOString(),
        sebab_ditolak: sebab
      })
      .eq("id", checkinId);

    if (error) throw error;
    await muatDataPenyelia();
  } catch (error) {
    alert(`Tindakan gagal: ${error.message}`);
  }
}

async function logoutPenyelia() {
  await dbPenyelia?.auth?.signOut().catch(() => {});
  penggunaPenyelia = null;
  dataPenyelia = [];
  elemenPenyelia("dashboardSection").classList.add("hidden");
  elemenPenyelia("loginSection").classList.remove("hidden");
  elemenPenyelia("password").value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  elemenPenyelia("tarikh").value = hariIniPenyelia();
  elemenPenyelia("password").addEventListener("keydown", event => {
    if (event.key === "Enter") loginPenyelia();
  });
  pulihkanSesiPenyelia();
});
