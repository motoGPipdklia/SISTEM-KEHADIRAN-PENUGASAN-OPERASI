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
  if (!nilai) return "-";

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


function statusPenyelia(id, mesej, jenis = "warning") {
  const elemen = elemenPenyelia(id);

  if (!elemen) return;

  elemen.className = `status ${jenis}`;
  elemen.innerHTML = mesej;
}


function nilaiPertama(objek, senaraiKunci, nilaiAsal = "") {
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
  if (!nilai) return "";

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

  if (
    hasil.error &&
    /auth_user_id/i.test(hasil.error.message || "")
  ) {
    hasil = await dbPenyelia
      .from("profiles")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();
  }

  if (hasil.error) {
    throw hasil.error;
  }

  return hasil.data;
}


function perananPenyeliaDibenarkan(peranan) {
  return [
    "URUSETIA",
    "PENYELIA",
    "PENTADBIR",
    "ADMIN"
  ].includes(atasPenyelia(peranan));
}


async function loginPenyelia() {
  const noBadan = atasPenyelia(
    elemenPenyelia("noBadan").value
  );

  const password = elemenPenyelia("password").value;
  const butang = elemenPenyelia("btnLogin");

  if (!noBadan || !password) {
    statusPenyelia(
      "loginStatus",
      "Sila masukkan No Badan dan kata laluan.",
      "error"
    );

    return;
  }

  butang.disabled = true;
  butang.textContent = "SEDANG MENYEMAK...";

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
      await dbPenyelia.auth.signInWithPassword({
        email: emailPenyelia(noBadan),
        password
      });

    if (error || !data.user) {
      throw new Error(
        "No Badan atau kata laluan tidak sah."
      );
    }

    const profil = await profilPenyelia(data.user.id);

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

    if (!perananPenyeliaDibenarkan(profil.peranan)) {
      throw new Error(
        `Akses ditolak. Peranan akaun ialah ${
          atasPenyelia(profil.peranan) ||
          "TIDAK DITETAPKAN"
        }.`
      );
    }

    penggunaPenyelia = {
      ...profil,
      authUserId: data.user.id
    };

    paparDashboardPenyelia();

    await muatSemuaDataPenyelia();

  } catch (error) {
    await dbPenyelia?.auth?.signOut().catch(() => {});

    statusPenyelia(
      "loginStatus",
      htmlPenyelia(error.message),
      "error"
    );

  } finally {
    butang.disabled = false;
    butang.textContent = "LOGIN URUSETIA";
  }
}


/* ================================================================
   PAPAR DASHBOARD
================================================================ */

function paparDashboardPenyelia() {
  elemenPenyelia("loginSection")
    .classList.add("hidden");

  elemenPenyelia("dashboardSection")
    .classList.remove("hidden");

  elemenPenyelia("profilPenyelia").innerHTML = `
    <strong>
      ${htmlPenyelia(
        penggunaPenyelia.pangkat || ""
      )}
      ${htmlPenyelia(
        penggunaPenyelia.nama || "-"
      )}
    </strong>
    <br>

    No Badan:
    ${htmlPenyelia(
      penggunaPenyelia.no_badan || "-"
    )}
    <br>

    Peranan:
    ${htmlPenyelia(
      atasPenyelia(penggunaPenyelia.peranan)
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

    const { data } =
      await dbPenyelia.auth.getSession();

    if (!data.session?.user) {
      return;
    }

    const profil = await profilPenyelia(
      data.session.user.id
    );

    if (
      !profil ||
      profil.aktif === false ||
      !perananPenyeliaDibenarkan(profil.peranan)
    ) {
      return;
    }

    penggunaPenyelia = {
      ...profil,
      authUserId: data.session.user.id
    };

    paparDashboardPenyelia();

    await muatSemuaDataPenyelia();

  } catch (error) {
    statusPenyelia(
      "loginStatus",
      htmlPenyelia(error.message),
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
  if (!penggunaPenyelia) return;

  const tarikh =
    elemenPenyelia("tarikh").value ||
    hariIniPenyelia();

  elemenPenyelia("tarikh").value = tarikh;

  statusPenyelia(
    "statusData",
    "Sedang mendapatkan rekod kehadiran...",
    "warning"
  );

  try {
    const tugasanRes = await dbPenyelia
      .from("penugasan")
      .select("*")
      .eq("tarikh", tarikh);

    if (tugasanRes.error) {
      throw tugasanRes.error;
    }

    const tugasan = tugasanRes.data || [];

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
      const profilRes = await dbPenyelia
        .from("profiles")
        .select("*")
        .in("id", petugasIds);

      if (profilRes.error) {
        throw profilRes.error;
      }

      profil = profilRes.data || [];
    }

    const checkinRes = await dbPenyelia
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
      (checkinRes.data || []).map(item => [
        item.penugasan_id,
        item
      ])
    );

    dataPenyelia = tugasan.map(item => {
      const petugas =
        profilMap.get(
          item.petugas_id ||
          item.profile_id
        ) || {};

      const checkin =
        checkinMap.get(item.id) ||
        null;

      const statusCheckin =
        atasPenyelia(checkin?.status);

      let status = "BELUM HADIR";

      if (
        atasPenyelia(item.status) ===
        "DIGANTI"
      ) {
        status = "DIGANTI";

      } else if (checkin) {
        if (
          statusCheckin === "MENUNGGU" ||
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
    dataPenyelia = [];

    paparSenarai();

    statusPenyelia(
      "statusData",
      `Ralat: ${htmlPenyelia(
        error.message
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
    elemenPenyelia("penapisStatus");

  if (penapis) {
    penapis.value = status;
  }

  tukarTabPenyelia("kehadiran");
  paparSenarai();
}


/* ================================================================
   PAPAR SENARAI KEHADIRAN
================================================================ */

function paparSenarai() {
  const carian = atasPenyelia(
    elemenPenyelia("carian")?.value || ""
  );

  const penapis = atasPenyelia(
    elemenPenyelia("penapisStatus")?.value ||
    "SEMUA"
  );

  const jumlahSemua =
    dataPenyelia.length;

  const jumlahBelumHadir =
    dataPenyelia.filter(
      item =>
        item.status === "BELUM HADIR"
    ).length;

  const jumlahMenunggu =
    dataPenyelia.filter(
      item =>
        item.status === "MENUNGGU"
    ).length;

  if (elemenPenyelia("jumlahRekod")) {
    elemenPenyelia("jumlahRekod")
      .textContent = jumlahSemua;
  }

  if (elemenPenyelia("jumlahBelumHadir")) {
    elemenPenyelia("jumlahBelumHadir")
      .textContent = jumlahBelumHadir;
  }

  if (elemenPenyelia("jumlahMenunggu")) {
    elemenPenyelia("jumlahMenunggu")
      .textContent = jumlahMenunggu;
  }

  const senarai = dataPenyelia.filter(
    item => {
      const gabung = atasPenyelia([
        item.profil.no_badan,
        item.profil.pangkat,
        item.profil.nama,
        item.tugas.call_sign,
        item.tugas.jenis_tugas,
        item.tugas.tempat_tugas ||
          item.tugas.lokasi,
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
    }
  );

  const bekas =
    elemenPenyelia("senaraiPetugas");

  if (!bekas) return;

  if (!senarai.length) {
    bekas.innerHTML = `
      <div class="empty">
        Tiada rekod ditemui untuk pilihan ini.
      </div>
    `;

    return;
  }

  bekas.innerHTML = senarai
    .map(item => {
      const bolehTindak =
        item.checkin &&
        item.status === "MENUNGGU";

      const statusPaparan =
        item.status === "MENUNGGU"
          ? "MENUNGGU PENGESAHAN"
          : item.status;

      const kelasStatus =
        item.status
          .toLowerCase()
          .replace(/\s+/g, "-");

      return `
        <article class="record">

          <div class="record-heading">

            <h3>
              ${htmlPenyelia(
                item.tugas.call_sign ||
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
                item.profil.pangkat ||
                "-"
              )}
              ${htmlPenyelia(
                item.profil.nama ||
                "-"
              )}
            </div>

            <div class="label">
              No Badan
            </div>

            <div>
              ${htmlPenyelia(
                item.profil.no_badan ||
                "-"
              )}
            </div>

            <div class="label">
              Tugas
            </div>

            <div>
              ${htmlPenyelia(
                item.tugas.jenis_tugas ||
                "-"
              )}
            </div>

            <div class="label">
              Lokasi
            </div>

            <div>
              ${htmlPenyelia(
                item.tugas.tempat_tugas ||
                item.tugas.lokasi ||
                "-"
              )}
            </div>

            <div class="label">
              Masa Check-In
            </div>

            <div>
              ${htmlPenyelia(
                formatMasaPenyelia(
                  item.checkin?.masa_checkin
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
            bolehTindak
              ? `
                <div class="actions">

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

                </div>
              `
              : ""
          }

        </article>
      `;
    })
    .join("");
}


/* ================================================================
   SAHKAN KEHADIRAN
================================================================ */

async function sahkanKehadiran(checkinId) {
  const pasti = confirm(
    "Sahkan kehadiran petugas ini?"
  );

  if (!pasti) return;

  await ubahStatusKehadiran(
    checkinId,
    "HADIR",
    null
  );
}


/* ================================================================
   TOLAK KEHADIRAN
================================================================ */

async function tolakKehadiran(checkinId) {
  const sebab = prompt(
    "Nyatakan sebab penolakan:"
  );

  if (sebab === null) return;

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
  try {
    const { error } = await dbPenyelia
      .from("checkin")
      .update({
        status,
        disahkan_oleh:
          penggunaPenyelia.authUserId,
        masa_pengesahan:
          new Date().toISOString(),
        sebab_ditolak: sebab
      })
      .eq("id", checkinId);

    if (error) {
      throw error;
    }

    await muatDataPenyelia();

  } catch (error) {
    alert(
      `Tindakan gagal: ${error.message}`
    );
  }
}


/* ================================================================
   MODUL LAPORAN PETUGAS
================================================================ */

async function muatLaporanPenyelia() {
  if (!penggunaPenyelia) return;

  const tarikh =
    elemenPenyelia("tarikh")?.value ||
    hariIniPenyelia();

  statusPenyelia(
    "statusLaporan",
    "Sedang mendapatkan laporan petugas...",
    "warning"
  );

  try {
    const laporanRes = await dbPenyelia
  .from(JADUAL_LAPORAN)
  .select("*");

if (laporanRes.error) {
  throw laporanRes.error;
}

const semuaLaporan = [
  ...(laporanRes.data || [])
].sort((a, b) => {

  const nilaiMasaA = nilaiPertama(a, [
    "tarikh_masa",
    "masa_laporan",
    "tarikh_laporan",
    "tarikh",
    "created_at"
  ]);

  const nilaiMasaB = nilaiPertama(b, [
    "tarikh_masa",
    "masa_laporan",
    "tarikh_laporan",
    "tarikh",
    "created_at"
  ]);

  return (Date.parse(nilaiMasaB) || 0) - (Date.parse(nilaiMasaA) || 0);

});

    const laporanTarikh =
      semuaLaporan.filter(item => {
        const tarikhItem =
          tarikhDaripadaNilai(
            nilaiPertama(item, [
              "tarikh",
              "tarikh_laporan",
              "tarikh_masa",
              "masa_laporan",
              "created_at"
            ])
          );

        return tarikhItem === tarikh;
      });

    const petugasIds = [
      ...new Set(
        laporanTarikh
          .map(item =>
            nilaiPertama(item, [
              "petugas_id",
              "profile_id",
              "user_id"
            ])
          )
          .filter(Boolean)
      )
    ];

    let profiles = [];

    if (petugasIds.length) {
      const profilRes = await dbPenyelia
        .from("profiles")
        .select("*")
        .in("id", petugasIds);

      if (profilRes.error) {
        throw profilRes.error;
      }

      profiles =
        profilRes.data || [];
    }

    const profilMap = new Map(
      profiles.map(item => [
        item.id,
        item
      ])
    );

    dataLaporanPenyelia =
      laporanTarikh.map(item => {
        const petugasId =
          nilaiPertama(item, [
            "petugas_id",
            "profile_id",
            "user_id"
          ]);

        const profil =
          profilMap.get(petugasId) ||
          {};

        const telahDibaca =
          item.telah_dibaca === true ||
          atasPenyelia(
            item.status_bacaan
          ) === "TELAH DIBACA" ||
          atasPenyelia(
            item.status_laporan
          ) === "TELAH DIBACA" ||
          Boolean(
            item.masa_dibaca ||
            item.dibaca_pada
          );

        return {
          asal: item,
          id: item.id,
          profil,
          petugasId,

          tarikhMasa:
            nilaiPertama(item, [
              "tarikh_masa",
              "masa_laporan",
              "created_at",
              "tarikh"
            ]),

          callSign:
            nilaiPertama(
              item,
              [
                "call_sign",
                "callsign"
              ],
              "-"
            ),

          jumlahPengunjung:
            nilaiPertama(
              item,
              [
                "jumlah_pengunjung",
                "pengunjung"
              ],
              0
            ),

          jumlahKenderaan:
            nilaiPertama(
              item,
              [
                "jumlah_kenderaan",
                "kenderaan"
              ],
              0
            ),

          vvipVip:
            nilaiPertama(
              item,
              [
                "vvip_vip",
                "vvip",
                "vip"
              ],
              "-"
            ),

          perkaraMenarik:
            nilaiPertama(
              item,
              [
                "perkara_menarik",
                "catatan",
                "laporan",
                "butiran"
              ],
              "-"
            ),

          telahDibaca,

          dibacaOleh:
            nilaiPertama(
              item,
              [
                "dibaca_oleh",
                "disemak_oleh"
              ],
              ""
            ),

          masaDibaca:
            nilaiPertama(
              item,
              [
                "masa_dibaca",
                "dibaca_pada",
                "updated_at"
              ],
              ""
            )
        };
      });

    paparSenaraiLaporan();

    statusPenyelia(
      "statusLaporan",
      `${dataLaporanPenyelia.length} laporan berjaya dimuatkan.`,
      "success"
    );

  } catch (error) {
    dataLaporanPenyelia = [];

    paparSenaraiLaporan();

    statusPenyelia(
      "statusLaporan",
      `Ralat laporan: ${htmlPenyelia(
        error.message
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
    elemenPenyelia("carianLaporan")
      ?.value || ""
  );

  const penapis = atasPenyelia(
    elemenPenyelia("penapisLaporan")
      ?.value || "SEMUA"
  );

  const belumDibaca =
    dataLaporanPenyelia.filter(
      item => !item.telahDibaca
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
    elemenPenyelia("badgeLaporan");

  if (badge) {
    badge.textContent = belumDibaca;

    badge.classList.toggle(
      "hidden",
      belumDibaca === 0
    );
  }

  const senarai =
    dataLaporanPenyelia.filter(item => {
      const statusBacaan =
        item.telahDibaca
          ? "TELAH DIBACA"
          : "BELUM DIBACA";

      const gabung = atasPenyelia([
        item.profil.no_badan,
        item.profil.pangkat,
        item.profil.nama,
        item.callSign,
        item.perkaraMenarik,
        statusBacaan
      ].join(" "));

      const padanCarian =
        !carian ||
        gabung.includes(carian);

      const padanStatus =
        penapis === "SEMUA" ||
        penapis === statusBacaan;

      return (
        padanCarian &&
        padanStatus
      );
    });

  const bekas =
    elemenPenyelia("senaraiLaporan");

  if (!bekas) return;

  if (!senarai.length) {
    bekas.innerHTML = `
      <div class="empty">
        Tiada laporan ditemui untuk pilihan ini.
      </div>
    `;

    return;
  }

  bekas.innerHTML = senarai
    .map(item => {
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
                  item.callSign ||
                  "LAPORAN PETUGAS"
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
                item.profil.pangkat ||
                "-"
              )}
              ${htmlPenyelia(
                item.profil.nama ||
                "-"
              )}
            </div>

            <div class="label">
              No Badan
            </div>

            <div>
              ${htmlPenyelia(
                item.profil.no_badan ||
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
                "-"
              )}
            </div>

            <div class="label">
              Perkara Menarik
            </div>

            <div class="teks-ringkas">
              ${htmlPenyelia(
                item.perkaraMenarik ||
                "-"
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
    })
    .join("");
}


/* ================================================================
   BUKA TAB LAPORAN BELUM DIBACA
================================================================ */

function bukaBahagianLaporan() {
  tukarTabPenyelia("laporan");

  const penapis =
    elemenPenyelia("penapisLaporan");

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
    bahagianKehadiran.classList.toggle(
      "hidden",
      !kehadiranAktif
    );
  }

  if (bahagianLaporan) {
    bahagianLaporan.classList.toggle(
      "hidden",
      kehadiranAktif
    );
  }

  if (tabKehadiran) {
    tabKehadiran.classList.toggle(
      "active",
      kehadiranAktif
    );

    tabKehadiran.setAttribute(
      "aria-selected",
      String(kehadiranAktif)
    );
  }

  if (tabLaporan) {
    tabLaporan.classList.toggle(
      "active",
      !kehadiranAktif
    );

    tabLaporan.setAttribute(
      "aria-selected",
      String(!kehadiranAktif)
    );
  }
}


/* ================================================================
   BUKA LAPORAN DALAM MODAL
================================================================ */

function bukaLaporanPenyelia(laporanId) {
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

  const item = laporanAktif;

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
            item.profil.pangkat ||
            "-"
          )}
          ${htmlPenyelia(
            item.profil.nama ||
            "-"
          )}
        </div>

        <div class="label">
          No Badan
        </div>

        <div>
          ${htmlPenyelia(
            item.profil.no_badan ||
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
            "-"
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

      </div>

      <div class="laporan-penuh">

        <div class="label">
          Perkara Menarik
        </div>

        <p>
          ${htmlPenyelia(
            item.perkaraMenarik ||
            "-"
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
  const masaSekarang =
    new Date().toISOString();

  const penggunaId =
    penggunaPenyelia.authUserId ||
    penggunaPenyelia.id;

  const cubaanPayload = [
    {
      telah_dibaca: true,
      dibaca_oleh: penggunaId,
      masa_dibaca: masaSekarang
    },

    {
      status_bacaan:
        "TELAH DIBACA",
      dibaca_oleh: penggunaId,
      masa_dibaca: masaSekarang
    },

    {
      status_laporan:
        "TELAH DIBACA",
      disemak_oleh: penggunaId,
      dibaca_pada: masaSekarang
    }
  ];

  let ralatTerakhir = null;
  let berjaya = false;

  try {
    for (
      const payload of cubaanPayload
    ) {
      const { error } =
        await dbPenyelia
          .from(JADUAL_LAPORAN)
          .update(payload)
          .eq("id", laporanId);

      if (!error) {
        berjaya = true;
        break;
      }

      ralatTerakhir = error;
    }

    if (!berjaya) {
      throw (
        ralatTerakhir ||
        new Error(
          "Struktur kolum status bacaan laporan tidak sepadan."
        )
      );
    }

    const laporanTempatan =
      dataLaporanPenyelia.find(
        item =>
          String(item.id) ===
          String(laporanId)
      );

    if (laporanTempatan) {
      laporanTempatan.telahDibaca =
        true;

      laporanTempatan.dibacaOleh =
        penggunaId;

      laporanTempatan.masaDibaca =
        masaSekarang;
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
    alert(
      `Gagal menandakan laporan sebagai telah dibaca: ${error.message}`
    );
  }
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
  )?.classList.add("hidden");

  elemenPenyelia(
    "loginSection"
  )?.classList.remove("hidden");

  if (elemenPenyelia("password")) {
    elemenPenyelia(
      "password"
    ).value = "";
  }
}


/* ================================================================
   EVENT KEYBOARD
================================================================ */

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      tutupModalLaporan();
    }
  }
);


/* ================================================================
   SISTEM DIMULAKAN
================================================================ */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const inputTarikh =
      elemenPenyelia("tarikh");

    if (inputTarikh) {
      inputTarikh.value =
        hariIniPenyelia();
    }

    const inputPassword =
      elemenPenyelia("password");

    if (inputPassword) {
      inputPassword.addEventListener(
        "keydown",
        event => {
          if (event.key === "Enter") {
            loginPenyelia();
          }
        }
      );
    }

    pulihkanSesiPenyelia();
  }
);
