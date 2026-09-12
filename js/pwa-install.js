"use strict";

let deferredInstallPrompt = null;


/* =========================================================
   KESAN PERANTI
========================================================= */

function pwaIsIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}


function pwaIsStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}


/* =========================================================
   ELEMEN UI
========================================================= */

function pwaInstallButton() {
  return document.getElementById("btnInstallPwa");
}


function pwaIOSHint() {
  return document.getElementById("iosInstallHint");
}


/* =========================================================
   STATUS PAPARAN
========================================================= */

function kemasKiniPaparanPwa() {
  const btn = pwaInstallButton();
  const iosHint = pwaIOSHint();

  if (pwaIsStandalone()) {
    if (btn) {
      btn.hidden = true;
    }

    if (iosHint) {
      iosHint.hidden = true;
    }

    return;
  }

  if (pwaIsIOS()) {
    if (btn) {
      btn.hidden = true;
    }

    if (iosHint) {
      iosHint.hidden = false;
    }

    return;
  }

  if (iosHint) {
    iosHint.hidden = true;
  }
}


/* =========================================================
   CHROME / EDGE INSTALL EVENT
========================================================= */

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();

  deferredInstallPrompt = event;

  const btn = pwaInstallButton();

  if (btn && !pwaIsStandalone()) {
    btn.hidden = false;
  }
});


/* =========================================================
   SELEPAS APP DIPASANG
========================================================= */

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;

  const btn = pwaInstallButton();

  if (btn) {
    btn.hidden = true;
  }
});


/* =========================================================
   PASANG APLIKASI
========================================================= */

async function installSKPOMotoGP() {

  if (pwaIsStandalone()) {
    return;
  }

  if (pwaIsIOS()) {
    const hint = pwaIOSHint();

    if (hint) {
      hint.hidden = false;
      hint.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    return;
  }

  if (!deferredInstallPrompt) {
    alert(
      "Pilihan pemasangan belum tersedia. " +
      "Pastikan sistem dibuka menggunakan Chrome atau Edge melalui HTTPS."
    );

    return;
  }

  deferredInstallPrompt.prompt();

  try {
    await deferredInstallPrompt.userChoice;
  } catch (error) {
    console.warn("Pemasangan PWA dibatalkan atau gagal:", error);
  }

  deferredInstallPrompt = null;

  kemasKiniPaparanPwa();
}


/*
 * Boleh dipanggil daripada kod lain jika diperlukan.
 */
window.installSKPOMotoGP = installSKPOMotoGP;


/* =========================================================
   ?install=1 DARIPADA PORTAL
========================================================= */

const pwaParams = new URLSearchParams(window.location.search);

const datangDariPortal =
  pwaParams.get("install") === "1";


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  const btn = pwaInstallButton();

  if (btn) {
    btn.addEventListener(
      "click",
      installSKPOMotoGP
    );
  }

  kemasKiniPaparanPwa();


  /* =====================================================
     DAFTAR SERVICE WORKER
  ====================================================== */

  if ("serviceWorker" in navigator) {

    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        console.log(
          "SKPO MotoGP Service Worker aktif:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error(
          "Service Worker MotoGP gagal didaftarkan:",
          error
        );
      });
  }
});


/* =========================================================
   JIKA DATANG DARIPADA PORTAL
========================================================= */

if (datangDariPortal) {

  window.addEventListener(
    "beforeinstallprompt",
    () => {

      setTimeout(() => {

        const btn = pwaInstallButton();

        if (btn) {

          btn.hidden = false;

          btn.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });

        }

      }, 250);

    }
  );

}
