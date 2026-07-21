"use strict";

/* =========================================================
   SKPO V2 — PERMOHONAN WALKIE-TALKIE PETUGAS

   Fail:
   js/walkie-petugas.js

   Keperluan:
   - window.supabaseClient
   - Jadual profiles
   - Jadual penugasan
   - Jadual walkie_talkie
========================================================= */

(() => {
  const db = window.supabaseClient;

  const state = {
    user: null,
    profile: null,
    penugasan: null,
    permohonan: null,
    sedangProses: false
  };

  /* =======================================================
     UTILITI
  ======================================================= */

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalisasi(value) {
    return String(value ?? "")
      .trim()
      .toUpperCase();
  }

  function tarikhMalaysiaHariIni() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function formatTarikhMasa(value) {
    if (!value) {
      return "-";
    }

    const tarikh = new Date(value);

    if (Number.isNaN(tarikh.getTime())) {
      return escapeHtml(value);
    }

    return new Intl.DateTimeFormat("ms-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(tarikh);
  }

  function formatAksesori(value) {
    if (!value) {
      return "-";
    }

    if (Array.isArray(value)) {
      return value.length
        ? value.join(", ")
        : "-";
    }

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
          return parsed.length
            ? parsed.join(", ")
            : "-";
        }
      } catch {
        return value || "-";
      }
    }

    return String(value);
  }

  function dapatkanElemen(id) {
    return document.getElementById(id);
  }

  function paparStatus(mesej, jenis = "warning") {
    const elemen = dapatkanElemen("statusWalkiePetugas");

    if (!elemen) {
      return;
    }

    elemen.className = `status ${jenis}`;
    elemen.textContent = mesej;
    elemen.classList.remove("hidden");
  }

  function sembunyiStatus() {
    const elemen = dapatkanElemen("statusWalkiePetugas");

    if (!elemen) {
      return;
    }

    elemen.textContent = "";
    elemen.className = "hidden";
  }

  function setButangLoading(loading) {
    const butang = dapatkanElemen("btnMohonWalkie");

    if (!butang) {
      return;
    }

    butang.disabled = loading;

    butang.textContent = loading
      ? "SEDANG MENGHANTAR..."
      : "MOHON SET WALKIE-TALKIE";
  }

  function kelasStatus(status) {
    switch (normalisasi(status)) {
      case "MENUNGGU":
        return "walkie-menunggu";

      case "DILEPASKAN":
        return "walkie-dilepaskan";

      case "DIPULANGKAN":
        return "walkie-dipulangkan";

      case "DITOLAK":
        return "walkie-ditolak";

      default:
        return "walkie-tiada";
    }
  }

  /* =======================================================
     SESI DAN PROFIL
  ======================================================= */

  async function dapatkanPenggunaSemasa() {
    if (!db) {
      throw new Error(
        "Sambungan Supabase tidak tersedia."
      );
    }

    const {
      data: { session },
      error
    } = await db.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session?.user) {
      throw new Error(
        "Sila login terlebih dahulu."
      );
    }

    state.user = session.user;

    return session.user;
  }

  async function dapatkanProfil() {
    const user =
      state.user || await dapatkanPenggunaSemasa();

    const { data, error } = await db
      .from("profiles")
      .select(`
        id,
        auth_user_id,
        no_badan,
        pangkat,
        nama,
        peranan,
        telefon,
        bahagian,
        daerah,
        aktif
      `)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Profil petugas tidak ditemui."
      );
    }

    if (data.aktif === false) {
      throw new Error(
        "Akaun petugas telah dinyahaktifkan."
      );
    }

    state.profile = data;

    return data;
  }

  /* =======================================================
     PENUGASAN HARI INI
  ======================================================= */

  async function dapatkanPenugasanHariIni() {
    const profile =
      state.profile || await dapatkanProfil();

    const hariIni = tarikhMalaysiaHariIni();

    const { data, error } = await db
      .from("penugasan")
      .select(`
        id,
        profile_id,
        tarikh_tugas,
        jenis_tugas,
        lokasi,
        status
      `)
      .eq("profile_id", profile.id)
      .eq("tarikh_tugas", hariIni)
      .neq("status", "DIGANTI")
      .order("created_at", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    state.penugasan = data || null;

    return state.penugasan;
  }

  /* =======================================================
     PERMOHONAN WALKIE-TALKIE
  ======================================================= */

  async function dapatkanPermohonanAktif() {
    const profile =
      state.profile || await dapatkanProfil();

    const penugasan =
      state.penugasan ||
      await dapatkanPenugasanHariIni();

    if (!penugasan) {
      state.permohonan = null;
      return null;
    }

    const { data, error } = await db
      .from("walkie_talkie")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("penugasan_id", penugasan.id)
      .order("created_at", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    state.permohonan = data || null;

    return state.permohonan;
  }

  async function daftarPermohonan() {
    if (state.sedangProses) {
      return;
    }

    state.sedangProses = true;
    setButangLoading(true);
    sembunyiStatus();

    try {
      const profile =
        state.profile || await dapatkanProfil();

      const penugasan =
        await dapatkanPenugasanHariIni();

      if (!penugasan) {
        throw new Error(
          "Tiada penugasan aktif untuk hari ini."
        );
      }

      const statusTugas =
        normalisasi(penugasan.status);

      if (statusTugas === "DIGANTI") {
        throw new Error(
          "Penugasan ini telah digantikan kepada petugas lain."
        );
      }

      const permohonanSediaAda =
        await dapatkanPermohonanAktif();

      if (permohonanSediaAda) {
        const status =
          normalisasi(permohonanSediaAda.status);

        if (
          status === "MENUNGGU" ||
          status === "DILEPASKAN"
        ) {
          throw new Error(
            status === "MENUNGGU"
              ? "Permohonan anda masih menunggu tindakan TSM."
              : "Set walkie-talkie telah dilepaskan kepada anda."
          );
        }

        if (status === "DIPULANGKAN") {
          throw new Error(
            "Set walkie-talkie bagi penugasan ini telah dipulangkan."
          );
        }

        if (status === "DITOLAK") {
          throw new Error(
            "Permohonan bagi penugasan ini telah ditolak. Hubungi TSM untuk tindakan lanjut."
          );
        }
      }

      const pasti = window.confirm(
        "Adakah anda pasti mahu memohon set walkie-talkie?"
      );

      if (!pasti) {
        return;
      }

      const { data, error } = await db
        .from("walkie_talkie")
        .insert({
          profile_id: profile.id,
          penugasan_id: penugasan.id,
          status: "MENUNGGU",
          tarikh_pendaftaran:
            new Date().toISOString()
        })
        .select("*")
        .single();

      if (error) {
        if (
          error.code === "23505" ||
          String(error.message)
            .toLowerCase()
            .includes("duplicate")
        ) {
          throw new Error(
            "Anda sudah mempunyai permohonan set yang aktif."
          );
        }

        throw error;
      }

      state.permohonan = data;

      paparStatus(
        "Permohonan set walkie-talkie berjaya dihantar kepada TSM.",
        "success"
      );

      await paparModul();
    } catch (error) {
      console.error(
        "Ralat permohonan walkie-talkie:",
        error
      );

      paparStatus(
        error.message ||
          "Permohonan set gagal dihantar.",
        "error"
      );
    } finally {
      state.sedangProses = false;
      setButangLoading(false);
    }
  }

  /* =======================================================
     PAPARAN MODUL
  ======================================================= */

  function binaPaparanTiadaTugasan() {
    return `
      <div class="walkie-empty">
        <div class="walkie-empty-icon">
          📻
        </div>

        <strong>
          Tiada penugasan hari ini
        </strong>

        <p>
          Permohonan set walkie-talkie hanya boleh dibuat
          apabila anda mempunyai penugasan aktif.
        </p>
      </div>
    `;
  }

  function binaPaparanBelumMemohon(penugasan) {
    return `
      <div class="walkie-info-grid">

        <div>
          <span class="walkie-label">
            Penugasan
          </span>

          <strong>
            ${escapeHtml(
              penugasan.jenis_tugas || "-"
            )}
          </strong>
        </div>

        <div>
          <span class="walkie-label">
            Lokasi
          </span>

          <strong>
            ${escapeHtml(
              penugasan.lokasi || "-"
            )}
          </strong>
        </div>

        <div>
          <span class="walkie-label">
            Status Permohonan
          </span>

          <span class="walkie-badge walkie-tiada">
            BELUM MEMOHON
          </span>
        </div>

      </div>

      <button
        id="btnMohonWalkie"
        class="btn-main"
        type="button"
        onclick="SKPOWalkie.daftar()"
      >
        MOHON SET WALKIE-TALKIE
      </button>
    `;
  }

  function binaPaparanPermohonan(
    permohonan,
    penugasan
  ) {
    const status =
      normalisasi(permohonan.status);

    const noSet =
      permohonan.no_set || "-";

    let keterangan = "";

    if (status === "MENUNGGU") {
      keterangan =
        "Permohonan sedang menunggu semakan dan pelepasan oleh TSM.";
    }

    if (status === "DILEPASKAN") {
      keterangan =
        "Set telah dilepaskan. Sila pastikan set dan aksesori diterima dalam keadaan baik.";
    }

    if (status === "DIPULANGKAN") {
      keterangan =
        "Pemulangan set telah disahkan oleh TSM.";
    }

    if (status === "DITOLAK") {
      keterangan =
        permohonan.sebab_penolakan
          ? `Permohonan ditolak: ${escapeHtml(
              permohonan.sebab_penolakan
            )}`
          : "Permohonan set telah ditolak oleh TSM.";
    }

    return `
      <div class="walkie-info-grid">

        <div>
          <span class="walkie-label">
            Penugasan
          </span>

          <strong>
            ${escapeHtml(
              penugasan.jenis_tugas || "-"
            )}
          </strong>
        </div>

        <div>
          <span class="walkie-label">
            Lokasi
          </span>

          <strong>
            ${escapeHtml(
              penugasan.lokasi || "-"
            )}
          </strong>
        </div>

        <div>
          <span class="walkie-label">
            Status
          </span>

          <span class="walkie-badge ${kelasStatus(status)}">
            ${escapeHtml(status)}
          </span>
        </div>

        <div>
          <span class="walkie-label">
            Nombor Set
          </span>

          <strong>
            ${escapeHtml(noSet)}
          </strong>
        </div>

        <div>
          <span class="walkie-label">
            Aksesori
          </span>

          <strong>
            ${escapeHtml(
              formatAksesori(
                permohonan.aksesori
              )
            )}
          </strong>
        </div>

        <div>
          <span class="walkie-label">
            Tarikh Permohonan
          </span>

          <strong>
            ${formatTarikhMasa(
              permohonan.tarikh_pendaftaran ||
              permohonan.created_at
            )}
          </strong>
        </div>

        ${
          permohonan.masa_dilepaskan
            ? `
              <div>
                <span class="walkie-label">
                  Masa Dilepaskan
                </span>

                <strong>
                  ${formatTarikhMasa(
                    permohonan.masa_dilepaskan
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          permohonan.masa_dipulangkan
            ? `
              <div>
                <span class="walkie-label">
                  Masa Dipulangkan
                </span>

                <strong>
                  ${formatTarikhMasa(
                    permohonan.masa_dipulangkan
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          permohonan.keadaan_set
            ? `
              <div>
                <span class="walkie-label">
                  Keadaan Set
                </span>

                <strong>
                  ${escapeHtml(
                    permohonan.keadaan_set
                  )}
                </strong>
              </div>
            `
            : ""
        }

      </div>

      <div class="walkie-notis ${kelasStatus(status)}">
        ${keterangan}
      </div>

      ${
        permohonan.catatan_penolakan
          ? `
            <div class="walkie-catatan">
              <strong>Catatan TSM:</strong>

              ${escapeHtml(
                permohonan.catatan_penolakan
              )}
            </div>
          `
          : ""
      }

      ${
        permohonan.catatan_pemulangan
          ? `
            <div class="walkie-catatan">
              <strong>Catatan Pemulangan:</strong>

              ${escapeHtml(
                permohonan.catatan_pemulangan
              )}
            </div>
          `
          : ""
      }
    `;
  }

  async function paparModul() {
    const kandungan =
      dapatkanElemen("kandunganWalkiePetugas");

    if (!kandungan) {
      return;
    }

    kandungan.innerHTML = `
      <div class="walkie-loading">
        Sedang mendapatkan maklumat set...
      </div>
    `;

    try {
      await dapatkanPenggunaSemasa();
      await dapatkanProfil();

      const penugasan =
        await dapatkanPenugasanHariIni();

      if (!penugasan) {
        kandungan.innerHTML =
          binaPaparanTiadaTugasan();

        return;
      }

      const permohonan =
        await dapatkanPermohonanAktif();

      if (!permohonan) {
        kandungan.innerHTML =
          binaPaparanBelumMemohon(
            penugasan
          );

        return;
      }

      kandungan.innerHTML =
        binaPaparanPermohonan(
          permohonan,
          penugasan
        );
    } catch (error) {
      console.error(
        "Ralat memaparkan modul walkie-talkie:",
        error
      );

      kandungan.innerHTML = `
        <div class="walkie-error">
          ${
            escapeHtml(
              error.message ||
              "Maklumat set gagal diperoleh."
            )
          }
        </div>
      `;
    }
  }

  async function muatSemula() {
    state.penugasan = null;
    state.permohonan = null;

    await paparModul();
  }

  /* =======================================================
     PERUBAHAN SESI
  ======================================================= */

  if (db?.auth) {
    db.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          state.user = null;
          state.profile = null;
          state.penugasan = null;
          state.permohonan = null;

          const kandungan =
            dapatkanElemen(
              "kandunganWalkiePetugas"
            );

          if (kandungan) {
            kandungan.innerHTML = "";
          }

          return;
        }

        if (
          event === "SIGNED_IN" &&
          session?.user
        ) {
          state.user = session.user;

          await paparModul();
        }
      }
    );
  }

  /* =======================================================
     FUNGSI AWAM
  ======================================================= */

  window.SKPOWalkie = {
    mula: paparModul,
    daftar: daftarPermohonan,
    muatSemula,
    state
  };
})();
