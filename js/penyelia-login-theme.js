"use strict";

/*
  Membersihkan borang login selepas pengguna log keluar tanpa mengubah
  fungsi utama Urusetia dalam js/penyelia.js.
*/
document.addEventListener("click", event => {
  const butangLogout = event.target.closest(
    'button[onclick*="logoutPenyelia"], a[onclick*="logoutPenyelia"]'
  );

  if (!butangLogout) return;

  setTimeout(() => {
    const noBadan = document.getElementById("noBadan");
    const password = document.getElementById("password");
    const status = document.getElementById("loginStatus");

    if (noBadan) noBadan.value = "";
    if (password) password.value = "";

    if (status) {
      status.innerHTML = "";
      status.className = "status hidden";
    }

    noBadan?.focus();
  }, 0);
});
