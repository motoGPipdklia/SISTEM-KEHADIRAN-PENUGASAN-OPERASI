"use strict";

/* ================================================================
   SKPO — URUSETIA / PENYELIA
================================================================ */

const dbPenyelia = window.supabaseClient;

const ZON_MASA_PENYELIA = "Asia/Kuala_Lumpur";

const JADUAL_LAPORAN = "pelaporan";

let penggunaPenyelia = null;
let dataPenyelia = [];
let dataLaporanPenyelia = [];
let laporanAktif = null;
let penugasanDipilih = null;


/* ================================================================
   FUNGSI ASAS
================================================================ */

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
  return `${teksPenyelia(noBadan)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")}@skpo.local`;
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
  if (!nilai) {
    return "-";
  }

  const tarikh = new Date(nilai);

  if (Number.isNaN(tarikh.getTime())) {
    return teksPenyelia(nilai) || "-";
  }

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


function statusPenyelia(
  id,
  mesej,
  jenis = "warning"
) {
  const elemen = elemenPenyelia(id);

  if (!elemen) {
    return;
  }

  elemen.className = `status ${jenis}`;
  elemen.innerHTML = mesej;
}


function nilaiPertama(
  objek,
  senaraiKunci,
  nilaiAsal = ""
) {
  for (const kunci of senaraiKunci) {
    const nilai = objek?.[kunci];

    if (
      nilai !== undefined &&
      nilai !== null &&
      teksPenyelia(nilai) !== ""
    ) {
      return nilai;
    }
  }

  return nilaiAsal;
}


function tarikhDaripadaNilai(nilai) {
  if (!nilai) {
    return "";
  }

  const teks = teksPenyelia(nilai);

  if (/^\d{4}-\d{2}-\d{2}$/.test(teks)) {
    return teks;
  }

  const tarikh = new Date(nilai);

  if (Number.isNaN(tarikh.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA_PENYELIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(tarikh);
}


/* ================================================================
   PROFIL DAN LOGIN URUSETIA
================================================================ */

async function profilPenyelia(userId) {
  let hasil = await dbPenyelia
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  /*
    Jika profiles.id tidak sama dengan auth.users.id,
    cuba cari menggunakan auth_user_id.
  */
  if (
    (!hasil.data || hasil.error) &&
    hasil.error &&
    /auth_user_id/i.test(
      hasil.error.message || ""
    )
  ) {
    hasil = await dbPenyelia
      .from("profiles")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();
  }

  /*
    Jika tiada ralat tetapi data masih tidak ditemui,
    cuba auth_user_id.
  */
  if (!hasil.error && !hasil.data) {
    const cubaanAuthId = await dbPenyelia
      .from("profiles")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!cubaanAuthId.error) {
      hasil = cubaanAuthId;
    }
  }

  if (hasil.error) {
    throw hasil.error;
  }

  return hasil.data;
}


function perananPenyeliaDibenarkan(peranan) {
  return [
    "URUSETIA",
    "PENTADBIR",
    "ADMIN"
  ].includes(
    atasPenyelia(peranan)
  );
}


async function loginPenyelia() {
  const inputNoBadan =
    elemenPenyelia("noBadan");

  const inputPassword =
    elemenPenyelia("password");

  const butang =
    elemenPenyelia("btnLogin");

  const noBadan = atasPenyelia(
    inputNoBadan?.value || ""
  );

  const password =
    inputPassword?.value || "";

  if (!noBadan || !password) {
    statusPenyelia(
      "loginStatus",
      "Sila masukkan No Badan dan kata laluan.",
      "error"
    );

    return;
  }

  if (butang) {
    butang.disabled = true;
    butang.textContent =
      "SEDANG MENYEMAK...";
  }

  statusPenyelia(
    "loginStatus",
    "Sedang menyemak...",
    "warning"
  );

  try {
    if (!dbPenyelia?.auth) {
      throw new Error(
        window.SKPO_SUPABASE_ERROR ||
        "Supabase belum disambungkan."
      );
    }

    const { data, error } =
      await dbPenyelia.auth
        .signInWithPassword({
          email: emailPenyelia(noBadan),
          password
        });

    if (error || !data?.user) {
      throw new Error(
        "No Badan atau kata laluan tidak sah."
      );
    }

    const profil = await profilPenyelia(
      data.user.id
    );

    if (!profil) {
      throw new Error(
        "Profil Urusetia tidak ditemui."
      );
    }

    if (profil.aktif === false) {
      throw new Error(
        "Akaun telah dinyahaktifkan."
      );
    }

    const peranan = atasPenyelia(profil.peranan);

if (!perananPenyeliaDibenarkan(peranan)) {

  await dbPenyelia.auth.signOut().catch(() => {});

  if (peranan === "TSM") {
    window.location.replace("tsm.html");
    return;
  }

  window.location.replace("index.html");
  return;
}

    penggunaPenyelia = {
      ...profil,
      authUserId: data.user.id
    };

    paparDashboardPenyelia();

    await muatSemuaDataPenyelia();

  } catch (error) {
    await dbPenyelia?.auth
      ?.signOut()
      .catch(() => {});

    statusPenyelia(
      "loginStatus",
      htmlPenyelia(
        error.message ||
        "Login gagal."
      ),
      "error"
    );

  } finally {
    if (butang) {
      butang.disabled = false;
      butang.textContent =
        "LOGIN URUSETIA";
    }
  }
}


/* ================================================================
   PAPAR DASHBOARD
================================================================ */

function paparDashboardPenyelia() {
  elemenPenyelia("loginSection")
    ?.classList.add("hidden");

  elemenPenyelia("dashboardSection")
    ?.classList.remove("hidden");

  const profilElemen =
    elemenPenyelia("profilPenyelia");

  if (!profilElemen) {
    return;
  }

  profilElemen.innerHTML = `
    <strong>
      ${htmlPenyelia(
        penggunaPenyelia?.pangkat || ""
      )}
      ${htmlPenyelia(
        penggunaPenyelia?.nama || "-"
      )}
    </strong>

    <br>

    No Badan:
    ${htmlPenyelia(
      penggunaPenyelia?.no_badan || "-"
    )}

    <br>

    Peranan:
    ${htmlPenyelia(
      atasPenyelia(
        penggunaPenyelia?.peranan
      )
    )}
  `;
}


/* ================================================================
   PULIHKAN SESI LOGIN
================================================================ */

async function pulihkanSesiPenyelia() {
  try {
    if (!dbPenyelia?.auth) {
      statusPenyelia(
        "loginStatus",
        htmlPenyelia(
          window.SKPO_SUPABASE_ERROR ||
          "Supabase belum disambungkan."
        ),
        "error"
      );

      return;
    }

    const { data, error } =
      await dbPenyelia.auth
        .getSession();

    if (error) {
      throw error;
    }

    if (!data.session?.user) {
      return;
    }

    const profil = await profilPenyelia(
      data.session.user.id
    );

    if (
  !profil ||
  profil.aktif === false ||
  !perananPenyeliaDibenarkan(
    profil.peranan
  )
) {

  const peranan = atasPenyelia(profil?.peranan);

  await dbPenyelia.auth
    .signOut()
    .catch(() => {});

  if (peranan === "TSM") {
    window.location.replace("tsm.html");
    return;
  }

  window.location.replace("index.html");
  return;
}

    penggunaPenyelia = {
      ...profil,
      authUserId:
        data.session.user.id
    };

    paparDashboardPenyelia();

    await muatSemuaDataPenyelia();

  } catch (error) {
    statusPenyelia(
      "loginStatus",
      htmlPenyelia(
        error.message ||
        "Gagal memulihkan sesi."
      ),
      "error"
    );
  }
}


/* ================================================================
   MUAT SEMUA DATA
================================================================ */

async function muatSemuaDataPenyelia() {
  await Promise.all([
    muatDataPenyelia(),
    muatLaporanPenyelia()
  ]);
}


/* ================================================================
   MUAT DATA KEHADIRAN
================================================================ */

async function muatDataPenyelia() {
  if (!penggunaPenyelia) {
    return;
  }

  const inputTarikh =
    elemenPenyelia("tarikh");

  const tarikh =
    inputTarikh?.value ||
    hariIniPenyelia();

  if (inputTarikh) {
    inputTarikh.value = tarikh;
  }

  statusPenyelia(
    "statusData",
    "Sedang mendapatkan rekod kehadiran...",
    "warning"
  );

  try {
    const tugasanRes =
      await dbPenyelia
        .from("penugasan")
        .select("*")
        .eq("tarikh", tarikh);

    if (tugasanRes.error) {
      throw tugasanRes.error;
    }

    const tugasan =
      tugasanRes.data || [];

    const petugasIds = [
      ...new Set(
        tugasan
          .map(item =>
            item.petugas_id ||
            item.profile_id
          )
          .filter(Boolean)
      )
    ];

    let profil = [];

    if (petugasIds.length) {
      const profilRes =
        await dbPenyelia
          .from("profiles")
          .select("*")
          .in("id", petugasIds);

      if (profilRes.error) {
        throw profilRes.error;
      }

      profil =
        profilRes.data || [];
    }

    const checkinRes =
      await dbPenyelia
        .from("checkin")
        .select("*")
        .eq("tarikh", tarikh);

    if (checkinRes.error) {
      throw checkinRes.error;
    }

    const profilMap = new Map(
      profil.map(item => [
        item.id,
        item
      ])
    );

    const checkinMap = new Map(
      (checkinRes.data || [])
        .map(item => [
          item.penugasan_id,
          item
        ])
    );

    dataPenyelia =
      tugasan.map(item => {
        const idPetugas =
          item.petugas_id ||
          item.profile_id;

        const petugas =
          profilMap.get(idPetugas) ||
          {};

        const checkin =
          checkinMap.get(item.id) ||
          null;

        const statusCheckin =
          atasPenyelia(
            checkin?.status
          );

        let status =
          "BELUM HADIR";

        if (
          atasPenyelia(item.status) ===
          "DIGANTI"
        ) {
          status = "DIGANTI";

        } else if (checkin) {
          if (
            statusCheckin ===
              "MENUNGGU" ||
            statusCheckin ===
              "MENUNGGU PENGESAHAN" ||
            !statusCheckin
          ) {
            status = "MENUNGGU";

          } else {
            status = statusCheckin;
          }
        }

        return {
          idPenugasan: item.id,
          profil: petugas,
          tugas: item,
          checkin,
          status
        };
      });

    paparSenarai();

    statusPenyelia(
      "statusData",
      `${dataPenyelia.length} rekod kehadiran berjaya dimuatkan.`,
      "success"
    );

  } catch (error) {
    console.error(
      "Ralat muat kehadiran:",
      error
    );

    dataPenyelia = [];

    paparSenarai();

    statusPenyelia(
      "statusData",
      `Ralat: ${htmlPenyelia(
        error.message ||
        "Gagal memuatkan rekod."
      )}`,
      "error"
    );
  }
}


/* ================================================================
   PENAPIS STATUS KEHADIRAN
================================================================ */

function tetapPenapisStatus(status) {
  const penapis =
    elemenPenyelia(
      "penapisStatus"
    );

  if (penapis) {
    penapis.value = status;
  }

  tukarTabPenyelia(
    "kehadiran"
  );

  paparSenarai();
}


/* ================================================================
   PAPAR SENARAI KEHADIRAN
================================================================ */

function paparSenarai() {
  const carian = atasPenyelia(
    elemenPenyelia("carian")
      ?.value || ""
  );

  const penapis = atasPenyelia(
    elemenPenyelia(
      "penapisStatus"
    )?.value || "SEMUA"
  );

  const jumlahSemua =
    dataPenyelia.length;

  const jumlahBelumHadir =
    dataPenyelia.filter(
      item =>
        item.status ===
        "BELUM HADIR"
    ).length;

  const jumlahMenunggu =
    dataPenyelia.filter(
      item =>
        item.status ===
        "MENUNGGU"
    ).length;

  const elemenJumlahRekod =
    elemenPenyelia("jumlahRekod");

  const elemenBelumHadir =
    elemenPenyelia(
      "jumlahBelumHadir"
    );

  const elemenMenunggu =
    elemenPenyelia(
      "jumlahMenunggu"
    );

  if (elemenJumlahRekod) {
    elemenJumlahRekod.textContent =
      jumlahSemua;
  }

  if (elemenBelumHadir) {
    elemenBelumHadir.textContent =
      jumlahBelumHadir;
  }

  if (elemenMenunggu) {
    elemenMenunggu.textContent =
      jumlahMenunggu;
  }

  const senarai =
    dataPenyelia.filter(item => {
      const gabung = atasPenyelia([
        item.profil?.no_badan,
        item.profil?.pangkat,
        item.profil?.nama,
        item.tugas?.call_sign,
        item.tugas?.jenis_tugas,
        item.tugas?.tempat_tugas ||
          item.tugas?.lokasi,
        item.status
      ].join(" "));

      const padanCarian =
        !carian ||
        gabung.includes(carian);

      const padanStatus =
        penapis === "SEMUA" ||
        item.status === penapis;

      return (
        padanCarian &&
        padanStatus
      );
    });

  const bekas =
    elemenPenyelia(
      "senaraiPetugas"
    );

  if (!bekas) {
    return;
  }

  if (!senarai.length) {
    bekas.innerHTML = `
      <div class="empty">
        Tiada rekod ditemui untuk pilihan ini.
      </div>
    `;

    return;
  }

  bekas.innerHTML =
    senarai.map(item => {
      const bolehTindak =
        Boolean(item.checkin) &&
        item.status ===
          "MENUNGGU";
       
       const bolehGanti =
     item.status === "BELUM HADIR";

      const statusPaparan =
        item.status === "MENUNGGU"
          ? "MENUNGGU PENGESAHAN"
          : item.status;

      const kelasStatus =
        atasPenyelia(item.status)
          .toLowerCase()
          .replace(/\s+/g, "-");

      return `
        <article class="record">

          <div class="record-heading">

            <h3>
              ${htmlPenyelia(
                item.tugas?.call_sign ||
                "TIADA CALL SIGN"
              )}
            </h3>

            <span
              class="status-badge status-${htmlPenyelia(
                kelasStatus
              )}"
            >
              ${htmlPenyelia(
                statusPaparan
              )}
            </span>

          </div>

          <div class="grid">

            <div class="label">
              Petugas
            </div>

            <div>
              ${htmlPenyelia(
                item.profil?.pangkat ||
                "-"
              )}
              ${htmlPenyelia(
                item.profil?.nama ||
                "-"
              )}
            </div>

            <div class="label">
              No Badan
            </div>

            <div>
              ${htmlPenyelia(
                item.profil?.no_badan ||
                "-"
              )}
            </div>

            <div class="label">
              Tugas
            </div>

            <div>
              ${htmlPenyelia(
                item.tugas?.jenis_tugas ||
                "-"
              )}
            </div>

            <div class="label">
              Lokasi
            </div>

            <div>
              ${htmlPenyelia(
                item.tugas?.tempat_tugas ||
                item.tugas?.lokasi ||
                "-"
              )}
            </div>

            <div class="label">
              Masa Check-In
            </div>

            <div>
              ${htmlPenyelia(
                formatMasaPenyelia(
                  item.checkin
                    ?.masa_checkin
                )
              )}
            </div>

            <div class="label">
              Status
            </div>

            <div>
              <strong>
                ${htmlPenyelia(
                  statusPaparan
                )}
              </strong>
            </div>

          </div>

${
  bolehTindak || bolehGanti
    ? `
      <div class="actions">

        ${
          bolehTindak
            ? `
              <button
                class="btn-ok"
                type="button"
                onclick="sahkanKehadiran('${htmlPenyelia(
                  item.checkin.id
                )}')"
              >
                SAHKAN HADIR
              </button>

              <button
                class="btn-no"
                type="button"
                onclick="tolakKehadiran('${htmlPenyelia(
                  item.checkin.id
                )}')"
              >
                TOLAK
              </button>
            `
            : ""
        }

        ${
          bolehGanti
            ? `
              <button
                class="btn-change"
                type="button"
                onclick="bukaModalPengganti('${htmlPenyelia(
                  item.idPenugasan
                )}')"
              >
                GANTI PETUGAS
              </button>
            `
            : ""
        }

      </div>
    `
    : ""
}

        </article>
      `;
    }).join("");
}


/* ================================================================
   SAHKAN KEHADIRAN
================================================================ */

async function sahkanKehadiran(
  checkinId
) {
  const pasti = confirm(
    "Sahkan kehadiran petugas ini?"
  );

  if (!pasti) {
    return;
  }

  await ubahStatusKehadiran(
    checkinId,
    "HADIR",
    null
  );
}


/* ================================================================
   TOLAK KEHADIRAN
================================================================ */

async function tolakKehadiran(
  checkinId
) {
  const sebab = prompt(
    "Nyatakan sebab penolakan:"
  );

  if (sebab === null) {
    return;
  }

  if (!teksPenyelia(sebab)) {
    alert(
      "Sebab penolakan wajib diisi."
    );

    return;
  }

  await ubahStatusKehadiran(
    checkinId,
    "DITOLAK",
    teksPenyelia(sebab)
  );
}


/* ================================================================
   UBAH STATUS KEHADIRAN
================================================================ */

async function ubahStatusKehadiran(
  checkinId,
  status,
  sebab
) {
  if (!penggunaPenyelia) {
    alert(
      "Sesi Urusetia tidak ditemui. Sila login semula."
    );

    return;
  }

  try {
    const idPengesah =
      penggunaPenyelia.id ||
      penggunaPenyelia.authUserId;

    const { error } =
      await dbPenyelia
        .from("checkin")
        .update({
          status,
          disahkan_oleh:
            idPengesah,
          masa_pengesahan:
            new Date().toISOString(),
          sebab_ditolak:
            sebab
        })
        .eq("id", checkinId);

    if (error) {
      throw error;
    }

    await muatDataPenyelia();

  } catch (error) {
    console.error(
      "Ralat ubah status kehadiran:",
      error
    );

    alert(
      `Tindakan gagal: ${
        error.message ||
        "Ralat tidak diketahui."
      }`
    );
  }
}


/* ================================================================
   MODUL LAPORAN PETUGAS
================================================================ */

async function muatLaporanPenyelia() {
  if (!penggunaPenyelia) {
    return;
  }

  const tarikh =
    elemenPenyelia("tarikh")
      ?.value ||
    hariIniPenyelia();

  statusPenyelia(
    "statusLaporan",
    "Sedang mendapatkan laporan petugas...",
    "warning"
  );

  try {
    /*
      Struktur sebenar jadual pelaporan:

      id
      penugasan_id
      petugas_id
      tarikh_masa
      jumlah_pengunjung
      jumlah_kenderaan
      vvip_vip
      perkara_menarik
      dibaca
      dibaca_pada
      dibaca_oleh
    */
    const laporanRes =
      await dbPenyelia
        .from(JADUAL_LAPORAN)
        .select(`
          id,
          penugasan_id,
          petugas_id,
          tarikh_masa,
          jumlah_pengunjung,
          jumlah_kenderaan,
          vvip_vip,
          perkara_menarik,
          dibaca,
          dibaca_pada,
          dibaca_oleh
        `)
        .order(
          "tarikh_masa",
          {
            ascending: false
          }
        );

    if (laporanRes.error) {
      throw laporanRes.error;
    }

    const semuaLaporan =
      laporanRes.data || [];

    const laporanTarikh =
      semuaLaporan.filter(item => {
        const tarikhItem =
          tarikhDaripadaNilai(
            item.tarikh_masa
          );

        return (
          tarikhItem === tarikh
        );
      });

    const petugasIds = [
      ...new Set(
        laporanTarikh
          .map(item =>
            item.petugas_id
          )
          .filter(Boolean)
      )
    ];

    const penugasanIds = [
      ...new Set(
        laporanTarikh
          .map(item =>
            item.penugasan_id
          )
          .filter(Boolean)
      )
    ];

    let profiles = [];
    let penugasan = [];

    if (petugasIds.length) {
      const profilRes =
        await dbPenyelia
          .from("profiles")
          .select("*")
          .in("id", petugasIds);

      if (profilRes.error) {
        throw profilRes.error;
      }

      profiles =
        profilRes.data || [];
    }

    if (penugasanIds.length) {
      const penugasanRes =
        await dbPenyelia
          .from("penugasan")
          .select("*")
          .in("id", penugasanIds);

      if (penugasanRes.error) {
        throw penugasanRes.error;
      }

      penugasan =
        penugasanRes.data || [];
    }

    const profilMap = new Map(
      profiles.map(item => [
        String(item.id),
        item
      ])
    );

    const penugasanMap =
      new Map(
        penugasan.map(item => [
          String(item.id),
          item
        ])
      );

    dataLaporanPenyelia =
      laporanTarikh.map(item => {
        const profil =
          profilMap.get(
            String(item.petugas_id)
          ) || {};

        const tugas =
          penugasanMap.get(
            String(
              item.penugasan_id
            )
          ) || {};

        const telahDibaca =
          item.dibaca === true ||
          Boolean(
            item.dibaca_pada
          );

        return {
          asal: item,
          id: item.id,
          profil,
          tugas,
          petugasId:
            item.petugas_id,
          penugasanId:
            item.penugasan_id,

          tarikhMasa:
            item.tarikh_masa,

          callSign:
            tugas.call_sign ||
            tugas.callsign ||
            "-",

          jumlahPengunjung:
            item.jumlah_pengunjung ??
            0,

          jumlahKenderaan:
            item.jumlah_kenderaan ??
            0,

          vvipVip:
            item.vvip_vip ||
            "TIADA",

          perkaraMenarik:
            item.perkara_menarik ||
            "TIADA",

          telahDibaca,

          dibacaOleh:
            item.dibaca_oleh ||
            "",

          masaDibaca:
            item.dibaca_pada ||
            ""
        };
      });

    paparSenaraiLaporan();

    statusPenyelia(
      "statusLaporan",
      `${dataLaporanPenyelia.length} laporan berjaya dimuatkan.`,
      "success"
    );

  } catch (error) {
    console.error(
      "Ralat muat laporan:",
      error
    );

    dataLaporanPenyelia = [];

    paparSenaraiLaporan();

    statusPenyelia(
      "statusLaporan",
      `Ralat laporan: ${htmlPenyelia(
        error.message ||
        "Gagal memuatkan laporan."
      )}`,
      "error"
    );
  }
}


/* ================================================================
   PAPAR SENARAI LAPORAN
================================================================ */

function paparSenaraiLaporan() {
  const carian = atasPenyelia(
    elemenPenyelia(
      "carianLaporan"
    )?.value || ""
  );

  const penapis = atasPenyelia(
    elemenPenyelia(
      "penapisLaporan"
    )?.value || "SEMUA"
  );

  const belumDibaca =
    dataLaporanPenyelia.filter(
      item =>
        !item.telahDibaca
    ).length;

  const jumlahBelumDibaca =
    elemenPenyelia(
      "jumlahLaporanBelumDibaca"
    );

  if (jumlahBelumDibaca) {
    jumlahBelumDibaca.textContent =
      belumDibaca;
  }

  const badge =
    elemenPenyelia(
      "badgeLaporan"
    );

  if (badge) {
    badge.textContent =
      belumDibaca;

    badge.classList.toggle(
      "hidden",
      belumDibaca === 0
    );
  }

  const senarai =
    dataLaporanPenyelia.filter(
      item => {
        const statusBacaan =
          item.telahDibaca
            ? "TELAH DIBACA"
            : "BELUM DIBACA";

        const gabung =
          atasPenyelia([
            item.profil?.no_badan,
            item.profil?.pangkat,
            item.profil?.nama,
            item.callSign,
            item.perkaraMenarik,
            statusBacaan
          ].join(" "));

        const padanCarian =
          !carian ||
          gabung.includes(
            carian
          );

        const padanStatus =
          penapis === "SEMUA" ||
          penapis ===
            statusBacaan;

        return (
          padanCarian &&
          padanStatus
        );
      }
    );

  const bekas =
    elemenPenyelia(
      "senaraiLaporan"
    );

  if (!bekas) {
    return;
  }

  if (!senarai.length) {
    bekas.innerHTML = `
      <div class="empty">
        Tiada laporan ditemui untuk pilihan ini.
      </div>
    `;

    return;
  }

  bekas.innerHTML =
    senarai.map(item => {
      const statusBacaan =
        item.telahDibaca
          ? "TELAH DIBACA"
          : "BELUM DIBACA";

      return `
        <article
          class="record laporan-record ${
            item.telahDibaca
              ? "dibaca"
              : "belum-dibaca"
          }"
        >

          <div class="record-heading">

            <div>

              <h3>
                ${htmlPenyelia(
                  item.callSign &&
                  item.callSign !== "-"
                    ? item.callSign
                    : "LAPORAN PETUGAS"
                )}
              </h3>

              <small>
                ${htmlPenyelia(
                  formatMasaPenyelia(
                    item.tarikhMasa
                  )
                )}
              </small>

            </div>

            <span
              class="status-badge ${
                item.telahDibaca
                  ? "status-telah-dibaca"
                  : "status-belum-dibaca"
              }"
            >
              ${htmlPenyelia(
                statusBacaan
              )}
            </span>

          </div>

          <div class="grid">

            <div class="label">
              Petugas
            </div>

            <div>
              ${htmlPenyelia(
                item.profil?.pangkat ||
                "-"
              )}
              ${htmlPenyelia(
                item.profil?.nama ||
                "-"
              )}
            </div>

            <div class="label">
              No Badan
            </div>

            <div>
              ${htmlPenyelia(
                item.profil?.no_badan ||
                "-"
              )}
            </div>

            <div class="label">
              Pengunjung
            </div>

            <div>
              ${htmlPenyelia(
                item.jumlahPengunjung
              )}
            </div>

            <div class="label">
              Kenderaan
            </div>

            <div>
              ${htmlPenyelia(
                item.jumlahKenderaan
              )}
            </div>

            <div class="label">
              VVIP / VIP
            </div>

            <div>
              ${htmlPenyelia(
                item.vvipVip ||
                "TIADA"
              )}
            </div>

            <div class="label">
              Perkara Menarik
            </div>

            <div class="teks-ringkas">
              ${htmlPenyelia(
                item.perkaraMenarik ||
                "TIADA"
              )}
            </div>

          </div>

          <div class="actions">

            <button
              class="btn-main"
              type="button"
              onclick="bukaLaporanPenyelia('${htmlPenyelia(
                item.id
              )}')"
            >
              BUKA LAPORAN
            </button>

            ${
              !item.telahDibaca
                ? `
                  <button
                    class="btn-ok"
                    type="button"
                    onclick="tandaLaporanDibaca('${htmlPenyelia(
                      item.id
                    )}')"
                  >
                    TANDA TELAH DIBACA
                  </button>
                `
                : ""
            }

          </div>

        </article>
      `;
    }).join("");
}


/* ================================================================
   BUKA TAB LAPORAN BELUM DIBACA
================================================================ */

function bukaBahagianLaporan() {
  tukarTabPenyelia(
    "laporan"
  );

  const penapis =
    elemenPenyelia(
      "penapisLaporan"
    );

  if (penapis) {
    penapis.value =
      "BELUM DIBACA";
  }

  paparSenaraiLaporan();
}


/* ================================================================
   TUKAR TAB KEHADIRAN / LAPORAN
================================================================ */

function tukarTabPenyelia(tab) {
  const kehadiranAktif =
    tab === "kehadiran";

  const bahagianKehadiran =
    elemenPenyelia(
      "bahagianKehadiran"
    );

  const bahagianLaporan =
    elemenPenyelia(
      "bahagianLaporan"
    );

  const tabKehadiran =
    elemenPenyelia(
      "tabKehadiran"
    );

  const tabLaporan =
    elemenPenyelia(
      "tabLaporan"
    );

  if (bahagianKehadiran) {
    bahagianKehadiran
      .classList.toggle(
        "hidden",
        !kehadiranAktif
      );
  }

  if (bahagianLaporan) {
    bahagianLaporan
      .classList.toggle(
        "hidden",
        kehadiranAktif
      );
  }

  if (tabKehadiran) {
    tabKehadiran
      .classList.toggle(
        "active",
        kehadiranAktif
      );

    tabKehadiran.setAttribute(
      "aria-selected",
      String(
        kehadiranAktif
      )
    );
  }

  if (tabLaporan) {
    tabLaporan
      .classList.toggle(
        "active",
        !kehadiranAktif
      );

    tabLaporan.setAttribute(
      "aria-selected",
      String(
        !kehadiranAktif
      )
    );
  }
}


/* ================================================================
   BUKA LAPORAN DALAM MODAL
================================================================ */

function bukaLaporanPenyelia(
  laporanId
) {
  laporanAktif =
    dataLaporanPenyelia.find(
      item =>
        String(item.id) ===
        String(laporanId)
    );

  if (!laporanAktif) {
    alert(
      "Laporan tidak ditemui."
    );

    return;
  }

  const item =
    laporanAktif;

  const statusBacaan =
    item.telahDibaca
      ? "TELAH DIBACA"
      : "BELUM DIBACA";

  const tajukModal =
    elemenPenyelia(
      "tajukModalLaporan"
    );

  if (tajukModal) {
    tajukModal.textContent =
      item.callSign &&
      item.callSign !== "-"
        ? `Laporan ${item.callSign}`
        : "Laporan Petugas";
  }

  const kandunganModal =
    elemenPenyelia(
      "kandunganModalLaporan"
    );

  if (kandunganModal) {
    kandunganModal.innerHTML = `
      <div class="grid modal-grid">

        <div class="label">
          Petugas
        </div>

        <div>
          ${htmlPenyelia(
            item.profil?.pangkat ||
            "-"
          )}
          ${htmlPenyelia(
            item.profil?.nama ||
            "-"
          )}
        </div>

        <div class="label">
          No Badan
        </div>

        <div>
          ${htmlPenyelia(
            item.profil?.no_badan ||
            "-"
          )}
        </div>

        <div class="label">
          Tarikh / Masa
        </div>

        <div>
          ${htmlPenyelia(
            formatMasaPenyelia(
              item.tarikhMasa
            )
          )}
        </div>

        <div class="label">
          Call Sign
        </div>

        <div>
          ${htmlPenyelia(
            item.callSign ||
            "-"
          )}
        </div>

        <div class="label">
          Jumlah Pengunjung
        </div>

        <div>
          ${htmlPenyelia(
            item.jumlahPengunjung
          )}
        </div>

        <div class="label">
          Jumlah Kenderaan
        </div>

        <div>
          ${htmlPenyelia(
            item.jumlahKenderaan
          )}
        </div>

        <div class="label">
          VVIP / VIP
        </div>

        <div>
          ${htmlPenyelia(
            item.vvipVip ||
            "TIADA"
          )}
        </div>

        <div class="label">
          Status Bacaan
        </div>

        <div>
          <strong>
            ${htmlPenyelia(
              statusBacaan
            )}
          </strong>
        </div>

        ${
          item.telahDibaca
            ? `
              <div class="label">
                Masa Dibaca
              </div>

              <div>
                ${htmlPenyelia(
                  formatMasaPenyelia(
                    item.masaDibaca
                  )
                )}
              </div>
            `
            : ""
        }

      </div>

      <div class="laporan-penuh">

        <div class="label">
          Perkara Menarik
        </div>

        <p>
          ${htmlPenyelia(
            item.perkaraMenarik ||
            "TIADA"
          )}
        </p>

      </div>
    `;
  }

  const tindakanModal =
    elemenPenyelia(
      "tindakanModalLaporan"
    );

  if (tindakanModal) {
    tindakanModal.innerHTML =
      item.telahDibaca
        ? `
          <button
            class="btn-secondary"
            type="button"
            onclick="tutupModalLaporan()"
          >
            TUTUP
          </button>
        `
        : `
          <button
            class="btn-ok"
            type="button"
            onclick="tandaLaporanDibaca('${htmlPenyelia(
              item.id
            )}', true)"
          >
            TANDA TELAH DIBACA
          </button>

          <button
            class="btn-secondary"
            type="button"
            onclick="tutupModalLaporan()"
          >
            TUTUP
          </button>
        `;
  }

  const modal =
    elemenPenyelia(
      "modalLaporan"
    );

  if (modal) {
    modal.classList.remove(
      "hidden"
    );
  }

  document.body.classList.add(
    "modal-open"
  );
}


/* ================================================================
   TUTUP MODAL LAPORAN
================================================================ */

function tutupModalLaporan() {
  const modal =
    elemenPenyelia(
      "modalLaporan"
    );

  if (modal) {
    modal.classList.add(
      "hidden"
    );
  }

  document.body.classList.remove(
    "modal-open"
  );

  laporanAktif = null;
}


/* ================================================================
   TANDA LAPORAN TELAH DIBACA
================================================================ */

async function tandaLaporanDibaca(
  laporanId,
  tutupSelepas = false
) {
  if (!penggunaPenyelia) {
    alert(
      "Sesi Urusetia tidak ditemui. Sila login semula."
    );

    return;
  }

  const laporan =
    dataLaporanPenyelia.find(
      item =>
        String(item.id) ===
        String(laporanId)
    );

  if (!laporan) {
    alert(
      "Laporan tidak ditemui."
    );

    return;
  }

  if (laporan.telahDibaca) {
    alert(
      "Laporan ini telah pun ditandakan sebagai telah dibaca."
    );

    return;
  }

  const pasti = confirm(
    "Tandakan laporan ini sebagai telah dibaca?"
  );

  if (!pasti) {
    return;
  }

  /*
    dibaca_oleh merujuk kepada profiles.id,
    bukan auth.users.id.
  */
  const penggunaId =
    penggunaPenyelia.id;

  if (!penggunaId) {
    alert(
      "ID profil Urusetia tidak ditemui. Sila login semula."
    );

    return;
  }

  const masaSekarang =
    new Date().toISOString();

  try {
    const { data, error } =
      await dbPenyelia
        .from(JADUAL_LAPORAN)
        .update({
          dibaca: true,
          dibaca_pada:
            masaSekarang,
          dibaca_oleh:
            penggunaId
        })
        .eq("id", laporanId)
        .select(`
          id,
          dibaca,
          dibaca_pada,
          dibaca_oleh
        `)
        .maybeSingle();

    if (error) {
      throw error;
    }

    /*
      Jika tiada rekod dikembalikan,
      kebiasaannya disebabkan RLS tidak
      membenarkan UPDATE atau SELECT.
    */
    if (!data) {
      throw new Error(
        "Rekod tidak dikemas kini. Semak polisi RLS jadual pelaporan."
      );
    }

    laporan.telahDibaca =
      data.dibaca === true;

    laporan.dibacaOleh =
      data.dibaca_oleh ||
      penggunaId;

    laporan.masaDibaca =
      data.dibaca_pada ||
      masaSekarang;

    if (laporan.asal) {
      laporan.asal.dibaca =
        true;

      laporan.asal.dibaca_pada =
        laporan.masaDibaca;

      laporan.asal.dibaca_oleh =
        laporan.dibacaOleh;
    }

    paparSenaraiLaporan();

    if (tutupSelepas) {
      tutupModalLaporan();
    }

    statusPenyelia(
      "statusLaporan",
      "Laporan telah ditandakan sebagai telah dibaca.",
      "success"
    );

  } catch (error) {
    console.error(
      "Ralat tanda laporan dibaca:",
      error
    );

    alert(
      `Gagal menandakan laporan sebagai telah dibaca: ${
        error.message ||
        "Ralat tidak diketahui."
      }`
    );
  }
}


/* ================================================================
   MUAT SEMULA APABILA TARIKH BERUBAH
================================================================ */

async function tarikhPenyeliaBerubah() {
  if (!penggunaPenyelia) {
    return;
  }

  await muatSemuaDataPenyelia();
}


/* ================================================================
   LOG KELUAR
================================================================ */

async function logoutPenyelia() {
  await dbPenyelia?.auth
    ?.signOut()
    .catch(() => {});

  penggunaPenyelia = null;
  dataPenyelia = [];
  dataLaporanPenyelia = [];
  laporanAktif = null;

  elemenPenyelia(
    "dashboardSection"
  )?.classList.add(
    "hidden"
  );

  elemenPenyelia(
    "loginSection"
  )?.classList.remove(
    "hidden"
  );

  const inputPassword =
    elemenPenyelia(
      "password"
    );

  if (inputPassword) {
    inputPassword.value = "";
  }

  statusPenyelia(
    "loginStatus",
    "Anda telah log keluar.",
    "success"
  );
}


/* ================================================================
   EVENT KEYBOARD
================================================================ */

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      tutupModalLaporan();
      tutupModalPengganti();
    }
  }
);


/* ================================================================
   SISTEM DIMULAKAN
================================================================ */

/* ================================================================
   MODAL PENGGANTIAN
================================================================ */

function bukaModalPengganti(idPenugasan) {
  penugasanDipilih =
    dataPenyelia.find(
      item =>
        String(item.idPenugasan) ===
        String(idPenugasan)
    ) || null;

  if (!penugasanDipilih) {
    alert(
      "Maklumat penugasan tidak ditemui."
    );
    return;
  }

  if (
    penugasanDipilih.status !==
    "BELUM HADIR"
  ) {
    alert(
      "Hanya petugas berstatus BELUM HADIR boleh diganti."
    );
    return;
  }

  penugasanDipilih.petugasBaru = null;
  penugasanDipilih.modPengganti = null;

  const petugasAsal =
    elemenPenyelia("petugasAsal");

  if (petugasAsal) {
    petugasAsal.innerHTML = `
      <strong>Petugas Asal</strong>

      <br><br>

      <div class="grid">

        <div class="label">
          Nama
        </div>

        <div>
          ${htmlPenyelia(
            penugasanDipilih.profil?.pangkat ||
            ""
          )}
          ${htmlPenyelia(
            penugasanDipilih.profil?.nama ||
            "-"
          )}
        </div>

        <div class="label">
          No Badan
        </div>

        <div>
          ${htmlPenyelia(
            penugasanDipilih.profil?.no_badan ||
            "-"
          )}
        </div>

        <div class="label">
          Call Sign
        </div>

        <div>
          ${htmlPenyelia(
            penugasanDipilih.tugas?.call_sign ||
            "-"
          )}
        </div>

        <div class="label">
          Tugas
        </div>

        <div>
          ${htmlPenyelia(
            penugasanDipilih.tugas?.jenis_tugas ||
            "-"
          )}
        </div>

      </div>
    `;
  }

  const noBadan =
    elemenPenyelia("noBadanPengganti");

  const catatan =
    elemenPenyelia("catatanPenggantian");

  const preview =
    elemenPenyelia("previewPengganti");

  const borang =
    elemenPenyelia("borangPengganti");

  const status =
    elemenPenyelia("statusPertukaran");

  if (noBadan) {
    noBadan.value = "";
  }

  if (catatan) {
    catatan.value = "";
  }

  if (preview) {
    preview.innerHTML = "";
    preview.classList.add("hidden");
  }

  if (borang) {
    borang.classList.add("hidden");
  }

  [
    "namaPengganti",
    "pangkatPengganti",
    "telefonPengganti",
    "bahagianPengganti",
    "passwordPengganti"
  ].forEach(id => {
    const input = elemenPenyelia(id);

    if (input) {
      input.value = "";
    }
  });

  if (status) {
    status.innerHTML = "";
    status.className = "status hidden";
  }

  elemenPenyelia("modalPengganti")
    ?.classList.remove("hidden");

  document.body.classList.add(
    "modal-open"
  );

  setTimeout(() => {
    noBadan?.focus();
  }, 50);
}

function tutupModalPengganti() {
  elemenPenyelia("modalPengganti")
    ?.classList.add("hidden");

  document.body.classList.remove(
    "modal-open"
  );

  penugasanDipilih = null;
}


/* ================================================================
   SEMAK PETUGAS PENGGANTI
================================================================ */

async function semakPetugasPengganti() {
  if (!penugasanDipilih) {
    alert(
      "Sila pilih penugasan yang hendak diganti."
    );
    return;
  }

  const inputNoBadan =
    elemenPenyelia("noBadanPengganti");

  const noBadan = atasPenyelia(
    inputNoBadan?.value || ""
  );

  const preview =
    elemenPenyelia("previewPengganti");

  const borang =
    elemenPenyelia("borangPengganti");

  if (!noBadan) {
    statusPenyelia(
      "statusPertukaran",
      "Sila masukkan No Badan petugas pengganti.",
      "error"
    );
    inputNoBadan?.focus();
    return;
  }

  penugasanDipilih.petugasBaru = null;
  penugasanDipilih.modPengganti = null;

  preview?.classList.add("hidden");
  borang?.classList.add("hidden");

  statusPenyelia(
    "statusPertukaran",
    "Sedang menyemak petugas...",
    "warning"
  );

  try {
    const { data, error } =
      await dbPenyelia
        .from("profiles")
        .select("*")
        .eq("no_badan", noBadan)
        .maybeSingle();

    if (error) {
      throw error;
    }

    /* ============================================================
       PETUGAS TIDAK DITEMUI — PAPAR BORANG DAFTAR BAHARU
    ============================================================ */

    if (!data) {
      penugasanDipilih.modPengganti = "BARU";

      if (preview) {
        preview.innerHTML = `
          <strong>Petugas belum didaftarkan</strong>
          <br><br>

          No Badan:
          <strong>${htmlPenyelia(noBadan)}</strong>

          <br>

          Sila lengkapkan maklumat petugas baharu di bawah.
        `;

        preview.classList.remove("hidden");
      }

      if (borang) {
        borang.classList.remove("hidden");
      }

      const nama =
        elemenPenyelia("namaPengganti");

      const pangkat =
        elemenPenyelia("pangkatPengganti");

      const telefon =
        elemenPenyelia("telefonPengganti");

      const bahagian =
        elemenPenyelia("bahagianPengganti");

      const password =
        elemenPenyelia("passwordPengganti");

      if (nama) nama.value = "";
      if (pangkat) pangkat.value = "";
      if (telefon) telefon.value = "";
      if (bahagian) bahagian.value = "";
      if (password) password.value = "";

      statusPenyelia(
        "statusPertukaran",
        "Petugas tidak ditemui. Sila daftar petugas baharu.",
        "warning"
      );

      nama?.focus();
      return;
    }

    /* ============================================================
       PETUGAS DITEMUI
    ============================================================ */

    if (data.aktif === false) {
      statusPenyelia(
        "statusPertukaran",
        "Akaun petugas ini tidak aktif.",
        "error"
      );
      return;
    }

    if (
      String(data.id) ===
      String(penugasanDipilih.profil?.id)
    ) {
      statusPenyelia(
        "statusPertukaran",
        "Petugas asal tidak boleh dipilih sebagai pengganti.",
        "error"
      );
      return;
    }

    const peranan =
      atasPenyelia(data.peranan);

    if (
      peranan &&
      peranan !== "PETUGAS"
    ) {
      statusPenyelia(
        "statusPertukaran",
        `Profil ini mempunyai peranan ${htmlPenyelia(
          peranan
        )}, bukan PETUGAS.`,
        "error"
      );
      return;
    }

    penugasanDipilih.petugasBaru = data;
    penugasanDipilih.modPengganti = "SEDIA_ADA";

    if (preview) {
      preview.innerHTML = `
        <strong>Petugas Pengganti Ditemui</strong>
        <br><br>

        <div class="grid">
          <div class="label">Nama</div>
          <div>
            ${htmlPenyelia(data.pangkat || "")}
            ${htmlPenyelia(data.nama || "-")}
          </div>

          <div class="label">No Badan</div>
          <div>${htmlPenyelia(data.no_badan || "-")}</div>

          <div class="label">Bahagian</div>
          <div>
            ${htmlPenyelia(
              data.bahagian ||
              data.balai ||
              data.cawangan ||
              "-"
            )}
          </div>

          <div class="label">Telefon</div>
          <div>${htmlPenyelia(data.telefon || "-")}</div>

          <div class="label">Peranan</div>
          <div>${htmlPenyelia(peranan || "PETUGAS")}</div>
        </div>
      `;

      preview.classList.remove("hidden");
    }

    /* Petugas sedia ada tidak perlu borang pendaftaran */
    borang?.classList.add("hidden");

    statusPenyelia(
      "statusPertukaran",
      "Petugas pengganti berjaya ditemui.",
      "success"
    );

  } catch (error) {
    console.error(
      "Ralat semak petugas pengganti:",
      error
    );

    penugasanDipilih.petugasBaru = null;
    penugasanDipilih.modPengganti = null;

    statusPenyelia(
      "statusPertukaran",
      `Semakan gagal: ${htmlPenyelia(
        error.message ||
        "Ralat tidak diketahui."
      )}`,
      "error"
    );
  }
}


/* ================================================================
   DAFTAR PETUGAS BAHARU TANPA KEHILANGAN SESI PENYELIA
================================================================ */

async function daftarPetugasPengganti(noBadan) {
  const nama = teksPenyelia(
    elemenPenyelia("namaPengganti")?.value
  );

  const pangkat = teksPenyelia(
    elemenPenyelia("pangkatPengganti")?.value
  );

  const telefon = teksPenyelia(
    elemenPenyelia("telefonPengganti")?.value
  );

  const bahagian = teksPenyelia(
    elemenPenyelia("bahagianPengganti")?.value
  );

  const password =
    elemenPenyelia("passwordPengganti")?.value || "";

  if (!nama || !pangkat || !password) {
    throw new Error(
      "Nama, pangkat dan kata laluan petugas baharu wajib diisi."
    );
  }

  if (password.length < 6) {
    throw new Error(
      "Kata laluan petugas baharu mestilah sekurang-kurangnya 6 aksara."
    );
  }

  const { data: sesiData, error: sesiError } =
    await dbPenyelia.auth.getSession();

  if (sesiError || !sesiData.session) {
    throw sesiError || new Error(
      "Sesi Penyelia tidak ditemui."
    );
  }

  const sesiPenyelia = sesiData.session;
  let penggunaBaharu = null;

  try {
    const { data: daftarData, error: daftarError } =
      await dbPenyelia.auth.signUp({
        email: emailPenyelia(noBadan),
        password
      });

    if (daftarError || !daftarData?.user) {
      throw daftarError || new Error(
        "Akaun petugas baharu gagal didaftarkan."
      );
    }

    penggunaBaharu = daftarData.user;

    const profilBaharu = {
      id: penggunaBaharu.id,
      auth_user_id: penggunaBaharu.id,
      no_badan: noBadan,
      nama,
      pangkat,
      telefon: telefon || null,
      bahagian: bahagian || null,
      peranan: "PETUGAS",
      aktif: true
    };

    let hasilProfil = await dbPenyelia
      .from("profiles")
      .insert(profilBaharu)
      .select("*")
      .single();

    /* Sesetengah pemasangan menggunakan id sahaja dan tiada auth_user_id. */
    if (
      hasilProfil.error &&
      /auth_user_id/i.test(hasilProfil.error.message || "")
    ) {
      delete profilBaharu.auth_user_id;

      hasilProfil = await dbPenyelia
        .from("profiles")
        .insert(profilBaharu)
        .select("*")
        .single();
    }

    if (hasilProfil.error || !hasilProfil.data) {
      throw hasilProfil.error || new Error(
        "Profil petugas baharu gagal disimpan."
      );
    }

    return hasilProfil.data;

  } finally {
    const { error: pulihError } =
      await dbPenyelia.auth.setSession({
        access_token: sesiPenyelia.access_token,
        refresh_token: sesiPenyelia.refresh_token
      });

    if (pulihError) {
      console.error(
        "Sesi Penyelia gagal dipulihkan:",
        pulihError
      );
    }
  }
}


/* ================================================================
   BINA REKOD PENUGASAN PENGGANTI
================================================================ */

function rekodPenugasanPengganti(
  tugasanAsal,
  petugasBaruId,
  catatan
) {
  const rekod = { ...tugasanAsal };

  [
    "id",
    "created_at",
    "updated_at",
    "masa_dicipta",
    "masa_kemaskini",
    "diganti_oleh",
    "diganti_pada",
    "petugas_pengganti_id"
  ].forEach(kunci => {
    delete rekod[kunci];
  });

  if (Object.prototype.hasOwnProperty.call(
    tugasanAsal,
    "petugas_id"
  )) {
    rekod.petugas_id = petugasBaruId;
  }

  if (Object.prototype.hasOwnProperty.call(
    tugasanAsal,
    "profile_id"
  )) {
    rekod.profile_id = petugasBaruId;
  }

  rekod.status = "DITUGASKAN";

  if (Object.prototype.hasOwnProperty.call(
    tugasanAsal,
    "catatan"
  )) {
    rekod.catatan = catatan || null;
  }

  return rekod;
}


/* ================================================================
   SIMPAN PENGGANTIAN PETUGAS
================================================================ */

async function gantiPetugas() {
  if (!penggunaPenyelia || !penugasanDipilih) {
    alert(
      "Sesi atau maklumat penugasan tidak ditemui."
    );
    return;
  }

  if (penugasanDipilih.status !== "BELUM HADIR") {
    alert(
      "Penugasan ini tidak lagi boleh diganti."
    );
    return;
  }

  const noBadan = atasPenyelia(
    elemenPenyelia("noBadanPengganti")?.value || ""
  );

  const catatan = teksPenyelia(
    elemenPenyelia("catatanPenggantian")?.value
  );

  if (!noBadan || !penugasanDipilih.modPengganti) {
    statusPenyelia(
      "statusPertukaran",
      "Semak No Badan petugas pengganti terlebih dahulu.",
      "error"
    );
    return;
  }

  const pasti = confirm(
    "Sahkan penggantian petugas ini?"
  );

  if (!pasti) {
    return;
  }

  const butang =
    elemenPenyelia("btnGantiPetugas");

  if (butang) {
    butang.disabled = true;
    butang.textContent = "SEDANG MENYIMPAN...";
  }

  statusPenyelia(
    "statusPertukaran",
    "Sedang menyimpan penggantian...",
    "warning"
  );

  let rekodBaharuId = null;

  try {
    let petugasBaru =
      penugasanDipilih.petugasBaru;

    if (penugasanDipilih.modPengganti === "BARU") {
      petugasBaru = await daftarPetugasPengganti(
        noBadan
      );
    }

    if (!petugasBaru?.id) {
      throw new Error(
        "ID profil petugas pengganti tidak ditemui."
      );
    }

    const rekodBaharu = rekodPenugasanPengganti(
      penugasanDipilih.tugas,
      petugasBaru.id,
      catatan
    );

    const { data: penugasanBaharu, error: insertError } =
      await dbPenyelia
        .from("penugasan")
        .insert(rekodBaharu)
        .select("id")
        .single();

    if (insertError || !penugasanBaharu) {
      throw insertError || new Error(
        "Penugasan pengganti gagal diwujudkan."
      );
    }

    rekodBaharuId = penugasanBaharu.id;

    let pertanyaanKemaskini = dbPenyelia
      .from("penugasan")
      .update({ status: "DIGANTI" })
      .eq("id", penugasanDipilih.idPenugasan);

    /* Elak dua Penyelia mengganti rekod yang sama serentak. */
    if (Object.prototype.hasOwnProperty.call(
      penugasanDipilih.tugas,
      "status"
    )) {
      pertanyaanKemaskini =
        penugasanDipilih.tugas.status === null
          ? pertanyaanKemaskini.is("status", null)
          : pertanyaanKemaskini.eq(
              "status",
              penugasanDipilih.tugas.status
            );
    }

    const { data: tugasanAsal, error: updateError } =
      await pertanyaanKemaskini
        .select("id")
        .maybeSingle();

    if (updateError || !tugasanAsal) {
      throw updateError || new Error(
        "Status penugasan asal telah berubah. Muat semula dan cuba lagi."
      );
    }

    statusPenyelia(
      "statusData",
      `Petugas berjaya diganti kepada ${htmlPenyelia(
        petugasBaru.pangkat || ""
      )} ${htmlPenyelia(petugasBaru.nama || noBadan)}.`,
      "success"
    );

    tutupModalPengganti();
    await muatSemuaDataPenyelia();

  } catch (error) {
    console.error(
      "Ralat ganti petugas:",
      error
    );

    /* Rollback rekod baharu jika rekod asal gagal dikemas kini. */
    if (rekodBaharuId) {
      try {
        await dbPenyelia
          .from("penugasan")
          .delete()
          .eq("id", rekodBaharuId);
      } catch (rollbackError) {
        console.error(
          "Rollback penugasan pengganti gagal:",
          rollbackError
        );
      }
    }

    statusPenyelia(
      "statusPertukaran",
      `Penggantian gagal: ${htmlPenyelia(
        error.message || "Ralat tidak diketahui."
      )}`,
      "error"
    );

  } finally {
    if (butang) {
      butang.disabled = false;
      butang.textContent = "SAHKAN PENGGANTIAN";
    }
  }
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const butangLogin =
      elemenPenyelia("btnLogin");

    /*
      Pasang acara terus dari JavaScript supaya login tidak bergantung
      pada atribut onclick di dalam HTML atau jenis pemuatan skrip.
    */
    if (butangLogin) {
      butangLogin.removeAttribute("onclick");

      butangLogin.addEventListener(
        "click",
        event => {
          event.preventDefault();
          loginPenyelia();
        }
      );
    }

    const inputTarikh =
      elemenPenyelia(
        "tarikh"
      );

    if (inputTarikh) {
      inputTarikh.value =
        hariIniPenyelia();

      inputTarikh.addEventListener(
        "change",
        tarikhPenyeliaBerubah
      );
    }

    const inputNoBadan =
      elemenPenyelia(
        "noBadan"
      );

    const inputPassword =
      elemenPenyelia(
        "password"
      );

    if (inputNoBadan) {
      inputNoBadan.addEventListener(
        "keydown",
        event => {
          if (event.key === "Enter") {
            event.preventDefault();
            loginPenyelia();
          }
        }
      );
    }

    if (inputPassword) {
      inputPassword.addEventListener(
        "keydown",
        event => {
          if (event.key === "Enter") {
            event.preventDefault();
            loginPenyelia();
          }
        }
      );
    }

    pulihkanSesiPenyelia();
  }
);
