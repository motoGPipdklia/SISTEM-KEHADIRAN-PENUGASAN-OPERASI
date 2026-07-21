"use strict";

/* ================================================================
   SKPO — MODUL TSM
================================================================ */

const dbTSM = window.supabaseClient;
const ZON_MASA_TSM = "Asia/Kuala_Lumpur";

let penggunaTSM = null;
let dataTSM = [];
let rekodAktifTSM = null;

/* ================================================================
   NOTIFIKASI TSM
================================================================ */

let dataNotifikasiTSM = [];
let saluranNotifikasiTSM = null;
let pemasaAlertTSM = null;
let notifikasiTSMSedangDimuatkan = false;

const PERANAN_NOTIFIKASI_TSM = "TSM";
const HAD_NOTIFIKASI_TSM = 50;

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
/* ================================================================
   NOTIFICATION CENTER TSM
================================================================ */

function normalisasiNotifikasiTSM(rekod) {
  return {
    id: rekod?.id || "",
    penerima_peranan: atasTSM(rekod?.penerima_peranan),
    tajuk: teksTSM(rekod?.tajuk) || "Notifikasi",
    mesej: teksTSM(rekod?.mesej),
    jenis: atasTSM(rekod?.jenis) || "INFO",
    sumber_jadual: teksTSM(rekod?.sumber_jadual),
    rujukan_id: rekod?.rujukan_id || null,
    petugas_id: rekod?.petugas_id || null,
    dibaca: rekod?.dibaca === true,
    created_at: rekod?.created_at || null,
    updated_at: rekod?.updated_at || null
  };
}

function kiraNotifikasiBelumDibacaTSM() {
  return dataNotifikasiTSM.filter(item => !item.dibaca).length;
}

function formatMasaRelatifTSM(nilai) {
  if (!nilai) return "-";

  const tarikh = new Date(nilai);
  if (Number.isNaN(tarikh.getTime())) return masaTSM(nilai);

  const bezaSaat = Math.max(
    0,
    Math.floor((Date.now() - tarikh.getTime()) / 1000)
  );

  if (bezaSaat < 10) return "Baru sahaja";
  if (bezaSaat < 60) return `${bezaSaat} saat lalu`;

  const bezaMinit = Math.floor(bezaSaat / 60);
  if (bezaMinit < 60) return `${bezaMinit} minit lalu`;

  const bezaJam = Math.floor(bezaMinit / 60);
  if (bezaJam < 24) return `${bezaJam} jam lalu`;

  const bezaHari = Math.floor(bezaJam / 24);
  if (bezaHari < 7) return `${bezaHari} hari lalu`;

  return masaTSM(nilai);
}

function kelasJenisNotifikasiTSM(jenis) {
  const nilai = atasTSM(jenis);

  if (
    nilai.includes("TOLAK") ||
    nilai.includes("RALAT") ||
    nilai.includes("ROSAK")
  ) {
    return "notification-danger";
  }

  if (
    nilai.includes("PULANG") ||
    nilai.includes("SELESAI") ||
    nilai.includes("LULUS")
  ) {
    return "notification-success";
  }

  if (
    nilai.includes("PERMOHONAN") ||
    nilai.includes("MENUNGGU")
  ) {
    return "notification-warning";
  }

  return "notification-info";
}

function ikonJenisNotifikasiTSM(jenis) {
  const nilai = atasTSM(jenis);

  if (
    nilai.includes("TOLAK") ||
    nilai.includes("RALAT") ||
    nilai.includes("ROSAK")
  ) {
    return "🔴";
  }

  if (
    nilai.includes("PULANG") ||
    nilai.includes("SELESAI") ||
    nilai.includes("LULUS")
  ) {
    return "🟢";
  }

  if (
    nilai.includes("PERMOHONAN") ||
    nilai.includes("MENUNGGU")
  ) {
    return "🟡";
  }

  return "🔔";
}

function kemasKiniBadgeNotifikasiTSM() {
  const badge = elTSM("jumlahNotifikasiTSM");
  const ringkasan = elTSM("ringkasanNotifikasiTSM");
  const butangBacaSemua = elTSM("btnBacaSemuaNotifikasiTSM");

  const jumlah = kiraNotifikasiBelumDibacaTSM();

  if (badge) {
    badge.textContent = jumlah > 99 ? "99+" : String(jumlah);
    badge.hidden = jumlah === 0;
  }

  if (ringkasan) {
    ringkasan.textContent = jumlah
      ? `${jumlah} notifikasi belum dibaca`
      : "Tiada notifikasi baharu";
  }

  if (butangBacaSemua) {
    butangBacaSemua.disabled = jumlah === 0;
  }

  document.title = jumlah
    ? `(${jumlah}) SKPO TSM`
    : "SKPO TSM";
}

function paparSenaraiNotifikasiTSM() {
  const senarai = elTSM("senaraiNotifikasiTSM");
  if (!senarai) return;

  kemasKiniBadgeNotifikasiTSM();

  if (!dataNotifikasiTSM.length) {
    senarai.innerHTML = `
      <div class="notification-empty">
        Tiada notifikasi untuk dipaparkan.
      </div>
    `;
    return;
  }

  senarai.innerHTML = dataNotifikasiTSM.map(item => {
    const kelasBaca = item.dibaca ? "" : " unread";
    const kelasJenis = kelasJenisNotifikasiTSM(item.jenis);
    const ikon = ikonJenisNotifikasiTSM(item.jenis);

    return `
      <article
        class="notification-item${kelasBaca} ${kelasJenis}"
        role="listitem"
        tabindex="0"
        data-notifikasi-id="${htmlTSM(item.id)}"
        onclick="bukaNotifikasiTSM('${htmlTSM(item.id)}')"
        onkeydown="urusKekunciNotifikasiTSM(event, '${htmlTSM(item.id)}')"
      >
        <div class="notification-title">
          <span aria-hidden="true">${ikon}</span>
          ${htmlTSM(item.tajuk)}
        </div>

        <div class="notification-message">
          ${htmlTSM(item.mesej || "-")}
        </div>

        <div class="notification-time">
          ${htmlTSM(formatMasaRelatifTSM(item.created_at))}
        </div>
      </article>
    `;
  }).join("");
}

function urusKekunciNotifikasiTSM(event, id) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    bukaNotifikasiTSM(id);
  }
}

async function muatNotifikasiTSM() {
  if (!penggunaTSM || notifikasiTSMSedangDimuatkan) return;

  notifikasiTSMSedangDimuatkan = true;

  try {
    const { data, error } = await dbTSM
      .from("notifications")
      .select(`
        id,
        penerima_peranan,
        tajuk,
        mesej,
        jenis,
        sumber_jadual,
        rujukan_id,
        petugas_id,
        dibaca,
        created_at,
        updated_at
      `)
      .eq("penerima_peranan", PERANAN_NOTIFIKASI_TSM)
      .order("created_at", { ascending: false })
      .limit(HAD_NOTIFIKASI_TSM);

    if (error) throw error;

    dataNotifikasiTSM = (data || []).map(normalisasiNotifikasiTSM);
    paparSenaraiNotifikasiTSM();
  } catch (error) {
    console.error("Ralat mendapatkan notifikasi TSM:", error);

    const senarai = elTSM("senaraiNotifikasiTSM");

    if (senarai) {
      senarai.innerHTML = `
        <div class="notification-empty">
          Notifikasi tidak dapat dimuatkan.<br>
          ${htmlTSM(error.message)}
        </div>
      `;
    }
  } finally {
    notifikasiTSMSedangDimuatkan = false;
  }
}

function togglePanelNotifikasiTSM() {
  const panel = elTSM("panelNotifikasiTSM");
  const butang = elTSM("btnNotifikasiTSM");

  if (!panel) return;

  const akanDibuka = panel.hidden;

  panel.hidden = !akanDibuka;

  if (butang) {
    butang.setAttribute(
      "aria-expanded",
      akanDibuka ? "true" : "false"
    );
  }

  if (akanDibuka) {
    muatNotifikasiTSM();
  }
}

function tutupPanelNotifikasiTSM() {
  const panel = elTSM("panelNotifikasiTSM");
  const butang = elTSM("btnNotifikasiTSM");

  if (panel) panel.hidden = true;
  if (butang) butang.setAttribute("aria-expanded", "false");
}

async function bukaNotifikasiTSM(id) {
  const notifikasi = dataNotifikasiTSM.find(
    item => String(item.id) === String(id)
  );

  if (!notifikasi) return;

  if (!notifikasi.dibaca) {
    try {
      const { error } = await dbTSM
        .from("notifications")
        .update({
          dibaca: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", notifikasi.id);

      if (error) throw error;

      notifikasi.dibaca = true;
      paparSenaraiNotifikasiTSM();
    } catch (error) {
      console.error("Gagal menandakan notifikasi dibaca:", error);
    }
  }

  tutupPanelNotifikasiTSM();

  if (atasTSM(notifikasi.sumber_jadual) === "WALKIE_TALKIE") {
    elTSM("statusFilter").value = "";

    const tarikh = elTSM("tarikh");
    if (tarikh && !tarikh.value) {
      tarikh.value = hariIniTSM();
    }

    await muatDataTSM();

    const jadual = elTSM("tbodyTSM");
    if (jadual) {
      jadual.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }
}

async function tandakanSemuaNotifikasiTSMDibaca() {
  const belumDibaca = dataNotifikasiTSM
    .filter(item => !item.dibaca)
    .map(item => item.id)
    .filter(Boolean);

  if (!belumDibaca.length) return;

  const butang = elTSM("btnBacaSemuaNotifikasiTSM");

  if (butang) {
    butang.disabled = true;
    butang.textContent = "SEDANG MENYIMPAN...";
  }

  try {
    const { error } = await dbTSM
      .from("notifications")
      .update({
        dibaca: true,
        updated_at: new Date().toISOString()
      })
      .in("id", belumDibaca);

    if (error) throw error;

    dataNotifikasiTSM.forEach(item => {
      if (belumDibaca.includes(item.id)) {
        item.dibaca = true;
      }
    });

    paparSenaraiNotifikasiTSM();
  } catch (error) {
    alert(`Gagal menandakan notifikasi: ${error.message}`);
  } finally {
    if (butang) {
      butang.textContent = "TANDA SEMUA DIBACA";
      butang.disabled = kiraNotifikasiBelumDibacaTSM() === 0;
    }
  }
}

function paparPemberitahuanLangsungTSM(notifikasi) {
  const kotak = elTSM("realtimeAlertTSM");
  const tajuk = elTSM("realtimeAlertTitleTSM");
  const mesej = elTSM("realtimeAlertMessageTSM");

  if (!kotak) return;

  if (tajuk) {
    tajuk.textContent = notifikasi.tajuk || "Notifikasi Baharu";
  }

  if (mesej) {
    mesej.textContent =
      notifikasi.mesej ||
      "Permohonan Walkie Talkie baharu diterima.";
  }

  kotak.hidden = false;

  if (pemasaAlertTSM) {
    clearTimeout(pemasaAlertTSM);
  }

  pemasaAlertTSM = setTimeout(() => {
    tutupPemberitahuanLangsungTSM();
  }, 10000);
}

function tutupPemberitahuanLangsungTSM() {
  const kotak = elTSM("realtimeAlertTSM");

  if (kotak) kotak.hidden = true;

  if (pemasaAlertTSM) {
    clearTimeout(pemasaAlertTSM);
    pemasaAlertTSM = null;
  }
}

function tambahNotifikasiRealtimeTSM(rekod) {
  const notifikasi = normalisasiNotifikasiTSM(rekod);

  if (
    notifikasi.penerima_peranan !== PERANAN_NOTIFIKASI_TSM
  ) {
    return;
  }

  const indeks = dataNotifikasiTSM.findIndex(
    item => String(item.id) === String(notifikasi.id)
  );

  if (indeks >= 0) {
    dataNotifikasiTSM[indeks] = notifikasi;
  } else {
    dataNotifikasiTSM.unshift(notifikasi);
  }

  dataNotifikasiTSM = dataNotifikasiTSM
    .sort((a, b) => {
      return new Date(b.created_at || 0) -
        new Date(a.created_at || 0);
    })
    .slice(0, HAD_NOTIFIKASI_TSM);

  paparSenaraiNotifikasiTSM();

  if (!notifikasi.dibaca) {
    paparPemberitahuanLangsungTSM(notifikasi);
  }

  if (
    atasTSM(notifikasi.sumber_jadual) === "WALKIE_TALKIE"
  ) {
    muatDataTSM().catch(error => {
      console.error("Auto refresh TSM gagal:", error);
    });
  }
}

function kemasKiniNotifikasiRealtimeTSM(rekod) {
  const notifikasi = normalisasiNotifikasiTSM(rekod);

  if (
    notifikasi.penerima_peranan !== PERANAN_NOTIFIKASI_TSM
  ) {
    return;
  }

  const indeks = dataNotifikasiTSM.findIndex(
    item => String(item.id) === String(notifikasi.id)
  );

  if (indeks >= 0) {
    dataNotifikasiTSM[indeks] = notifikasi;
  } else {
    dataNotifikasiTSM.unshift(notifikasi);
  }

  paparSenaraiNotifikasiTSM();
}

function padamNotifikasiRealtimeTSM(rekodLama) {
  const id = rekodLama?.id;
  if (!id) return;

  dataNotifikasiTSM = dataNotifikasiTSM.filter(
    item => String(item.id) !== String(id)
  );

  paparSenaraiNotifikasiTSM();
}

async function hentikanRealtimeNotifikasiTSM() {
  if (!saluranNotifikasiTSM) return;

  try {
    await dbTSM.removeChannel(saluranNotifikasiTSM);
  } catch (error) {
    console.warn("Saluran notifikasi gagal dihentikan:", error);
  } finally {
    saluranNotifikasiTSM = null;
  }
}

async function mulakanRealtimeNotifikasiTSM() {
  if (!penggunaTSM || !dbTSM?.channel) return;

  await hentikanRealtimeNotifikasiTSM();

  saluranNotifikasiTSM = dbTSM
    .channel(`notifikasi-tsm-${penggunaTSM.authUserId}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `penerima_peranan=eq.${PERANAN_NOTIFIKASI_TSM}`
      },
      payload => {
        tambahNotifikasiRealtimeTSM(payload.new);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `penerima_peranan=eq.${PERANAN_NOTIFIKASI_TSM}`
      },
      payload => {
        kemasKiniNotifikasiRealtimeTSM(payload.new);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "notifications"
      },
      payload => {
        padamNotifikasiRealtimeTSM(payload.old);
      }
    )
    .subscribe(status => {
      console.log("Status Realtime Notifikasi TSM:", status);

      if (status === "CHANNEL_ERROR") {
        console.error(
          "Realtime notifikasi gagal. Pastikan jadual notifications telah ditambah ke publication supabase_realtime."
        );
      }
    });
}

async function mulakanSistemNotifikasiTSM() {
  if (!penggunaTSM) return;

  await muatNotifikasiTSM();
  await mulakanRealtimeNotifikasiTSM();
}

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
    const peranan = atasTSM(profil.peranan);
if (!perananTSM(peranan)) {

    await dbTSM.auth.signOut().catch(() => {});

    window.location.replace("index.html");
    return;

}
    penggunaTSM = { ...profil, authUserId: data.user.id };
    paparDashboardTSM();

await Promise.all([
  muatDataTSM(),
  mulakanSistemNotifikasiTSM()
]);
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
    if (!profil || profil.aktif === false) {

    await dbTSM.auth.signOut().catch(() => {});
    window.location.replace("index.html");
    return;

}

const peranan = atasTSM(profil.peranan);

if (!perananTSM(peranan)) {

    await dbTSM.auth.signOut().catch(() => {});
    window.location.replace("index.html");
    return;

}
    penggunaTSM = {
  ...profil,
  authUserId: data.session.user.id
};

paparDashboardTSM();

await Promise.all([
  muatDataTSM(),
  mulakanSistemNotifikasiTSM()
]);
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
  const btn = elTSM("btnSahkanPelepasan");
  btn.disabled = false;
  btn.textContent = "SAHKAN & LEPASKAN";
  elTSM("modalPelepasan").classList.remove("hidden");
  const kotakModal = elTSM("modalPelepasan").querySelector(".modal-box");
  if (kotakModal) kotakModal.scrollTop = 0;
  setTimeout(() => elTSM("noSiriSet")?.focus(), 50);
}
function tutupModalPelepasan() { rekodAktifTSM = null; elTSM("modalPelepasan").classList.add("hidden"); }

async function sahkanPelepasan() {
  const status = elTSM("statusPelepasan");
  const btn = elTSM("btnSahkanPelepasan");

  if (!rekodAktifTSM) {
    paparStatusTSM("statusPelepasan", "Rekod permohonan tidak dijumpai. Tutup borang dan cuba semula.", "error");
    status?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const medanNoSet = elTSM("noSiriSet");
  const noSet = atasTSM(medanNoSet.value);

  if (!noSet) {
    paparStatusTSM("statusPelepasan", "No Siri Set wajib diisi sebelum set boleh dilepaskan.", "error");
    medanNoSet.focus();
    medanNoSet.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const aksesori = [...document.querySelectorAll('input[name="aksesoriTSM"]:checked')].map(x => x.value);

  btn.disabled = true;
  btn.textContent = "SEDANG MENYIMPAN...";
  paparStatusTSM("statusPelepasan", "Sedang merekodkan nombor siri dan pelepasan set...", "warning");
  status?.scrollIntoView({ behavior: "smooth", block: "nearest" });

  try {
    const { data, error } = await dbTSM.from("walkie_talkie").update({
      no_siri_set: noSet,
      no_siri_bateri: atasTSM(elTSM("noSiriBateri").value) || null,
      no_siri_charger: atasTSM(elTSM("noSiriCharger").value) || null,
      aksesori,
      catatan_tsm: teksTSM(elTSM("catatanTSM").value) || null,
      status: "DILEPASKAN",
      masa_pelepasan: new Date().toISOString(),
      disahkan_oleh: penggunaTSM.authUserId
    })
      .eq("id", rekodAktifTSM.rekod.id)
      .select("id,status,no_siri_set")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error("Rekod tidak dikemas kini. Pastikan akaun mempunyai peranan TSM/PENTADBIR dan polisi RLS membenarkan kemas kini.");
    }

    paparStatusTSM(
      "statusPelepasan",
      `Set ${htmlTSM(data.no_siri_set || noSet)} berjaya dilepaskan.`,
      "success"
    );
    status?.scrollIntoView({ behavior: "smooth", block: "center" });

    await new Promise(resolve => setTimeout(resolve, 700));
    tutupModalPelepasan();
    await muatDataTSM();
  } catch (error) {
    paparStatusTSM("statusPelepasan", `Pelepasan gagal: ${htmlTSM(error.message)}`, "error");
    status?.scrollIntoView({ behavior: "smooth", block: "center" });
    btn.disabled = false;
    btn.textContent = "SAHKAN & LEPASKAN";
  }
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
  await hentikanRealtimeNotifikasiTSM();
  tutupPanelNotifikasiTSM();
  tutupPemberitahuanLangsungTSM();

  await dbTSM?.auth?.signOut().catch(() => {});

  penggunaTSM = null;
  dataTSM = [];
  dataNotifikasiTSM = [];
  rekodAktifTSM = null;

  paparSenaraiNotifikasiTSM();

  elTSM("dashboardSection").style.display = "none";
  elTSM("loginSection").style.display = "block";
  elTSM("password").value = "";

  document.title = "SKPO TSM";
}

document.addEventListener("DOMContentLoaded", () => {
  elTSM("tarikh").value = hariIniTSM();

  elTSM("password")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      loginTSM();
    }
  });

  document.addEventListener("click", event => {
    const wrapper = elTSM("notificationWrapper");
    const panel = elTSM("panelNotifikasiTSM");

    if (
      wrapper &&
      panel &&
      !panel.hidden &&
      !wrapper.contains(event.target)
    ) {
      tutupPanelNotifikasiTSM();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      tutupPanelNotifikasiTSM();
      tutupPemberitahuanLangsungTSM();

      if (!elTSM("modalPelepasan")?.classList.contains("hidden")) {
        tutupModalPelepasan();
      }

      if (!elTSM("modalPemulangan")?.classList.contains("hidden")) {
        tutupModalPemulangan();
      }
    }
  });

  window.addEventListener("beforeunload", () => {
    if (saluranNotifikasiTSM) {
      dbTSM.removeChannel(saluranNotifikasiTSM);
      saluranNotifikasiTSM = null;
    }
  });

  pulihkanSesiTSM();
});
