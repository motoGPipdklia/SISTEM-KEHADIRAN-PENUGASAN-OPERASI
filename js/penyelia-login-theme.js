"use strict";

/*
  Membersihkan borang login selepas pengguna log keluar tanpa mengubah
  fungsi utama Urusetia dalam js/penyelia.js.
*/
(function pasangPembersihanLogoutUrusetia() {
  const logoutAsal = window.logoutPenyelia;

  if (typeof logoutAsal !== "function") return;

  window.logoutPenyelia = async function logoutPenyeliaBersih(...args) {
    const hasil = await logoutAsal.apply(this, args);
    const noBadan = document.getElementById("noBadan");
    const password = document.getElementById("password");
    const status = document.getElementById("loginStatus");

    if (noBadan) noBadan.value = "";
    if (password) password.value = "";

    if (status) {
      status.innerHTML = "";
      status.className = "status hidden";
      status.style.display = "none";
    }

    noBadan?.focus();
    return hasil;
  };
})();
