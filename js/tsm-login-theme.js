"use strict";

/*
  Tambahan kecil khusus untuk paparan login TSM.
  Membersihkan status lama selepas pengguna menekan LOG KELUAR.
*/
document.addEventListener("click", event => {
  const butangLogout = event.target.closest(
    'button[onclick*="logoutTSM"], a[onclick*="logoutTSM"]'
  );

  if (!butangLogout) return;

  setTimeout(() => {
    const status = document.getElementById("loginStatus");
    const noBadan = document.getElementById("noBadan");

    if (status) {
      status.innerHTML = "";
      status.className = "status hidden";
    }

    if (noBadan) noBadan.value = "";
  }, 0);
});
