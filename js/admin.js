let admin = null;
let dataSemua = [];

function esc(value){

  return String(value || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

}


function login(){

  const no =
    document.getElementById(
      "noBadan"
    ).value.trim();

  const kataLaluan =
    document.getElementById(
      "password"
    ).value.trim();

  if(!no || !kataLaluan){

    loginStatus.innerHTML =
      '<span class="error">' +
      'Sila lengkapkan maklumat login.' +
      '</span>';

    return;

  }

  btnLogin.disabled = true;

  loginStatus.innerHTML =
    '<span class="warning">' +
    'Sedang menyemak...' +
    '</span>';

  google.script.run

    .withSuccessHandler(function(res){

      btnLogin.disabled = false;

      if(res && res.status === true){

        admin = res;

        localStorage.setItem(
          "skpoAdmin",
          JSON.stringify(res)
        );

        buka();

      }else{

        loginStatus.innerHTML =
          '<span class="error">' +
          esc(
            res && res.mesej
              ? res.mesej
              : "Login gagal."
          ) +
          '</span>';

      }

    })

    .withFailureHandler(function(error){

      btnLogin.disabled = false;

      loginStatus.innerHTML =
        '<span class="error">' +
        esc(error.message) +
        '</span>';

    })

    .loginPentadbir(
      no,
      kataLaluan
    );

}


function buka(){

  loginPage.style.display =
    "none";

  dashboard.style.display =
    "block";

  adminName.textContent =
    (admin.pangkat || "") +
    " " +
    (admin.nama || "") +
    " (" +
    (admin.noBadan || "") +
    ")";

  if(!tarikh.value){

    const hariIni =
      new Date();

    const offset =
      hariIni.getTimezoneOffset();

    tarikh.value =
      new Date(
        hariIni.getTime() -
        offset * 60000
      )
      .toISOString()
      .slice(0,10);

  }

  muatData(true);

}


function muatData(muatPilihan){

  status.innerHTML =
    '<span class="warning">' +
    'Sedang memuatkan data...' +
    '</span>';

  google.script.run

    .withSuccessHandler(function(res){

      if(!res || res.status !== true){

        status.innerHTML =
          '<span class="error">' +
          esc(
            res && res.mesej
              ? res.mesej
              : "Data gagal dimuatkan."
          ) +
          '</span>';

        return;

      }

      dataSemua =
        res.laporan || [];

      if(muatPilihan){
        binaPilihanPenapis();
      }

      papar();

      status.innerHTML =
        '<span class="success">' +
        'Data berjaya dikemas kini.' +
        '</span>';

    })

    .withFailureHandler(function(error){

      status.innerHTML =
        '<span class="error">' +
        esc(error.message) +
        '</span>';

    })

    .dapatkanDashboardPentadbir(
      admin.noBadan,
      tarikh.value
    );

}


function binaPilihanPenapis(){

  const jenisSemasa =
    jenisTugas.value;

  const tempatSemasa =
    tempatTugas.value;

  const senaraiJenis =
    [...new Set(
      dataSemua
        .map(function(rekod){
          return rekod.jenisTugas || "";
        })
        .filter(Boolean)
    )].sort();

  const senaraiTempat =
    [...new Set(
      dataSemua
        .map(function(rekod){
          return rekod.tempatTugas || "";
        })
        .filter(Boolean)
    )].sort();

  jenisTugas.innerHTML =
    '<option value="">SEMUA JENIS TUGAS</option>' +
    senaraiJenis.map(function(nilai){

      return (
        '<option value="' +
        esc(nilai) +
        '">' +
        esc(nilai) +
        '</option>'
      );

    }).join("");

  tempatTugas.innerHTML =
    '<option value="">SEMUA TEMPAT TUGAS</option>' +
    senaraiTempat.map(function(nilai){

      return (
        '<option value="' +
        esc(nilai) +
        '">' +
        esc(nilai) +
        '</option>'
      );

    }).join("");

  if(
    senaraiJenis.includes(
      jenisSemasa
    )
  ){
    jenisTugas.value =
      jenisSemasa;
  }

  if(
    senaraiTempat.includes(
      tempatSemasa
    )
  ){
    tempatTugas.value =
      tempatSemasa;
  }

}


function dataDitapis(){

  const carianNilai =
    carian.value
      .trim()
      .toUpperCase();

  const jenisNilai =
    jenisTugas.value
      .trim()
      .toUpperCase();

  const tempatNilai =
    tempatTugas.value
      .trim()
      .toUpperCase();

  const statusNilai =
    statusPenapis.value
      .trim()
      .toUpperCase();

  return dataSemua.filter(
    function(rekod){

      const gabungan = [
        rekod.noBadan,
        rekod.pangkat,
        rekod.nama,
        rekod.callSign,
        rekod.jenisTugas,
        rekod.tempatTugas,
        rekod.pemegangSet,
        rekod.statusCheckIn
      ]
        .join(" ")
        .toUpperCase();

      if(
        carianNilai &&
        !gabungan.includes(
          carianNilai
        )
      ){
        return false;
      }

      if(
        jenisNilai &&
        String(
          rekod.jenisTugas || ""
        ).toUpperCase() !==
        jenisNilai
      ){
        return false;
      }

      if(
        tempatNilai &&
        String(
          rekod.tempatTugas || ""
        ).toUpperCase() !==
        tempatNilai
      ){
        return false;
      }

      if(statusNilai){

        if(
          statusNilai === "CHECK-OUT" &&
          rekod.sudahCheckOut !== true
        ){
          return false;
        }

        if(
          statusNilai !== "CHECK-OUT" &&
          String(
            rekod.statusCheckIn || ""
          ).toUpperCase() !==
          statusNilai
        ){
          return false;
        }

      }

      return true;

    }
  );

}


function kemasKiniStatistik(
  senarai
){

  /*
    Petugas berstatus DIGANTI masih dipaparkan
    dalam jadual, tetapi tidak dimasukkan dalam
    mana-mana pengiraan statistik.
  */

  const petugasAktif =
    senarai.filter(function(r){

      return String(
        r.statusCheckIn || ""
      )
        .trim()
        .toUpperCase() !== "DIGANTI";

    });

  const jumlahAktif = petugasAktif.length;

  const jumlahHadir =
    petugasAktif.filter(function(r){

      return String(
        r.statusCheckIn || ""
      )
        .trim()
        .toUpperCase() === "HADIR";

    }).length;

  const jumlahBelumHadir =
    petugasAktif.filter(function(r){

      const statusSemasa = String(
        r.statusCheckIn || ""
      )
        .trim()
        .toUpperCase();

      return !statusSemasa || statusSemasa === "BELUM HADIR";

    }).length;

  const peratusKehadiran =
    jumlahAktif > 0
      ? Math.round((jumlahHadir / jumlahAktif) * 100)
      : 0;

  jumlah.textContent = jumlahAktif;
  hadir.textContent = jumlahHadir;
  belumHadir.textContent = jumlahBelumHadir;

  jumlahPemegangSet.textContent =
    petugasAktif.filter(function(r){

      const nilai =
        String(r.pemegangSet || "")
          .trim()
          .toUpperCase();

      return [
        "YA",
        "YES",
        "Y",
        "1",
        "PEMEGANG SET",
        "BENAR",
        "TRUE"
      ].includes(nilai);

    }).length;

  progressPercent.textContent = peratusKehadiran + "%";
  progressFill.style.width = peratusKehadiran + "%";
  progressText.textContent =
    jumlahHadir + " / " + jumlahAktif + " Petugas Hadir";

  progressFill.parentElement.setAttribute(
    "aria-valuenow",
    peratusKehadiran
  );

  menunggu.textContent =
    petugasAktif.filter(function(r){

      return String(
        r.statusCheckIn || ""
      )
        .trim()
        .toUpperCase() ===
        "MENUNGGU PENGESAHAN PENYELIA";

    }).length;

  ditolak.textContent =
    petugasAktif.filter(function(r){

      return String(
        r.statusCheckIn || ""
      )
        .trim()
        .toUpperCase() === "DITOLAK";

    }).length;

  checkout.textContent =
    petugasAktif.filter(function(r){

      return r.sudahCheckOut === true;

    }).length;

  bertugas.textContent =
    petugasAktif.filter(function(r){

      return r.masihBertugas === true;

    }).length;

}


function papar(){

  const senarai =
    dataDitapis();

  kemasKiniStatistik(
    senarai
  );

  tbody.innerHTML =
    senarai.length
      ? senarai.map(
          function(rekod,index){

            return (

              "<tr>" +

                "<td>" +
                (index + 1) +
                "</td>" +

                "<td>" +
                esc(
                  rekod.noBadan || "-"
                ) +
                "</td>" +

                "<td>" +
                esc(
                  (
                    (rekod.pangkat || "") +
                    " " +
                    (rekod.nama || "")
                  ).trim() || "-"
                ) +
                "</td>" +

                "<td>" +
                esc(
                  rekod.callSign || "-"
                ) +
                "</td>" +

                "<td>" +
                esc(
                  rekod.jenisTugas || "-"
                ) +
                "</td>" +

                "<td>" +
                esc(
                  rekod.tempatTugas || "-"
                ) +
                "</td>" +

                "<td>" +
                badgePemegangSet(
                  rekod.pemegangSet
                ) +
                "</td>" +

                "<td>" +
                esc(
                  rekod.masaCheckIn || "-"
                ) +
                "</td>" +

                "<td>" +
                badge(
                  rekod.statusCheckIn
                ) +
                "</td>" +

                "<td>" +
                esc(
                  rekod.masaCheckOut || "-"
                ) +
                "</td>" +

                "<td>" +
                esc(
                  rekod.tempohBertugas || "-"
                ) +
                "</td>" +

                "<td>" +
                (
                  String(
                    rekod.statusCheckIn || ""
                  ).toUpperCase() === "DIGANTI"
                    ? '<span class="badge badge-red">DIGANTI</span>'
                    : rekod.sudahCheckOut
                      ? '<span class="badge badge-gray">SELESAI BERTUGAS</span>'
                      : rekod.masihBertugas
                        ? '<span class="badge badge-green">MASIH BERTUGAS</span>'
                        : '<span class="badge badge-gray">TIDAK AKTIF</span>'
                ) +
                "</td>" +

                "<td>" +
                badgeDevice(
                  rekod.statusDevice
                ) +
                "</td>" +

                "<td>" +
                '<button class="reset-device" onclick="resetDeviceId(\'' +
                esc(rekod.noBadan || "") +
                '\')" title="Reset Device ID dan jadikan status petugas BELUM HADIR">' +
                'RESET DEVICE' +
                '</button>' +
                "</td>" +

              "</tr>"

            );

          }
        ).join("")
      : '<tr><td colspan="14" style="text-align:center;padding:30px">Tiada rekod mengikut penapis dipilih.</td></tr>';

}


function badge(nilai){

  nilai =
    String(nilai || "")
      .toUpperCase();

  if(nilai === "HADIR"){

    return (
      '<span class="badge badge-green">' +
      'HADIR' +
      '</span>'
    );

  }

  if(nilai === "DITOLAK"){

    return (
      '<span class="badge badge-red">' +
      'DITOLAK' +
      '</span>'
    );

  }

  if(
    nilai ===
    "MENUNGGU PENGESAHAN PENYELIA"
  ){

    return (
      '<span class="badge badge-yellow">' +
      'MENUNGGU' +
      '</span>'
    );

  }

  if(nilai === "DIGANTI"){

    return (
      '<span class="badge badge-red">' +
      'DIGANTI' +
      '</span>'
    );

  }

  return (
    '<span class="badge badge-gray">' +
    esc(
      nilai || "BELUM HADIR"
    ) +
    '</span>'
  );

}


function penapisSemasa(){

  return {
    tarikh:
      tarikh.value,

    jenisTugas:
      jenisTugas.value,

    tempatTugas:
      tempatTugas.value,

    status:
      statusPenapis.value
  };

}


function muatLaporanPdf(){

  btnPdf.disabled = true;

  status.innerHTML =
    '<span class="warning">' +
    'Sedang menjana PDF A4 potret...' +
    '</span>';

  google.script.run

    .withSuccessHandler(function(res){

      btnPdf.disabled = false;

      if(
        !res ||
        res.status !== true
      ){

        status.innerHTML =
          '<span class="error">' +
          esc(
            res && res.mesej
              ? res.mesej
              : "PDF gagal dijana."
          ) +
          '</span>';

        return;

      }

      muatTurunBase64(
        res.base64,
        res.mimeType,
        res.namaFail
      );

      status.innerHTML =
        '<span class="success">' +
        'Laporan PDF berjaya dijana.' +
        '</span>';

    })

    .withFailureHandler(function(error){

      btnPdf.disabled = false;

      status.innerHTML =
        '<span class="error">' +
        esc(error.message) +
        '</span>';

    })

    .janaLaporanPdfPentadbir(
      admin.noBadan,
      penapisSemasa()
    );

}


function exportExcel(){

  btnExcel.disabled = true;

  status.innerHTML =
    '<span class="warning">' +
    'Sedang menjana fail Excel...' +
    '</span>';

  google.script.run

    .withSuccessHandler(function(res){

      btnExcel.disabled = false;

      if(
        !res ||
        res.status !== true
      ){

        status.innerHTML =
          '<span class="error">' +
          esc(
            res && res.mesej
              ? res.mesej
              : "Fail Excel gagal dijana."
          ) +
          '</span>';

        return;

      }

      muatTurunBase64(
        res.base64,
        res.mimeType,
        res.namaFail
      );

      status.innerHTML =
        '<span class="success">' +
        'Fail Excel berjaya dijana.' +
        '</span>';

    })

    .withFailureHandler(function(error){

      btnExcel.disabled = false;

      status.innerHTML =
        '<span class="error">' +
        esc(error.message) +
        '</span>';

    })

    .eksportLaporanExcelPentadbir(
      admin.noBadan,
      penapisSemasa()
    );

}


function muatTurunBase64(
  base64,
  mimeType,
  namaFail
){

  const binari =
    atob(base64);

  const bytes =
    new Uint8Array(
      binari.length
    );

  for(
    let i = 0;
    i < binari.length;
    i++
  ){
    bytes[i] =
      binari.charCodeAt(i);
  }

  const blob =
    new Blob(
      [bytes],
      {
        type:
          mimeType ||
          "application/octet-stream"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const pautan =
    document.createElement("a");

  pautan.href = url;
  pautan.download =
    namaFail || "laporan";

  document.body.appendChild(
    pautan
  );

  pautan.click();
  pautan.remove();

  setTimeout(function(){
    URL.revokeObjectURL(url);
  },1000);

}



function badgePemegangSet(nilai){

  const nilaiBersih =
    String(nilai || "")
      .trim()
      .toUpperCase();

  const ya = [
    "YA",
    "YES",
    "Y",
    "1",
    "PEMEGANG SET",
    "BENAR",
    "TRUE"
  ].includes(nilaiBersih);

  return ya
    ? '<span class="badge badge-green">YA</span>'
    : '<span class="badge badge-gray">TIDAK</span>';

}


function bukaModulTSM(){

  const url =
    "tsm.html";

  window.open(
    url,
    "_blank"
  );

}


function badgeDevice(nilai){

  nilai =
    String(
      nilai || "BELUM DIDAFTARKAN"
    ).toUpperCase();

  if(nilai === "AKTIF"){

    return (
      '<span class="badge badge-green">' +
      'AKTIF' +
      '</span>'
    );

  }

  if(
    nilai === "DISEKAT" ||
    nilai === "SEKAT"
  ){

    return (
      '<span class="badge badge-red">' +
      'DISEKAT' +
      '</span>'
    );

  }

  return (
    '<span class="badge badge-gray">' +
    'BELUM DIDAFTARKAN' +
    '</span>'
  );

}


function resetDeviceId(
  noBadanPetugas
){

  if(
    !admin ||
    !noBadanPetugas
  ){
    return;
  }

  const sah =
    confirm(
      "RESET DEVICE untuk No Badan " +
      noBadanPetugas +
      "?\\n\\nTindakan ini akan:" +
      "\\n• Memadam Device ID lama" +
      "\\n• Menetapkan status petugas kepada BELUM HADIR" +
      "\\n• Memadam rekod Check-In dan Check-Out hari ini" +
      "\\n• Membenarkan Check-In semula menggunakan telefon baharu" +
      "\\n\\nTeruskan?"
    );

  if(!sah){
    return;
  }

  status.innerHTML =
    '<span class="warning">' +
    'Sedang reset Device ID dan status kehadiran...' +
    '</span>';

  google.script.run

    .withSuccessHandler(function(res){

      if(
        res &&
        res.status === true
      ){

        status.innerHTML =
          '<span class="success">' +
          '<strong>RESET DEVICE BERJAYA.</strong><br>' +
          esc(
            res.mesej ||
            "Device ID telah direset dan status petugas kini BELUM HADIR."
          ) +
          '</span>';

        /*
          Muat semula keseluruhan data supaya status Device,
          status kehadiran dan statistik dashboard dikemas kini.
        */
        muatData(true);

      }else{

        status.innerHTML =
          '<span class="error">' +
          esc(
            res && res.mesej
              ? res.mesej
              : "Reset Device ID gagal."
          ) +
          '</span>';

      }

    })

    .withFailureHandler(function(error){

      status.innerHTML =
        '<span class="error">' +
        esc(error.message) +
        '</span>';

    })

    .resetDeviceIdPentadbir(
      admin.noBadan,
      noBadanPetugas
    );

}


function logout(){

  localStorage.removeItem(
    "skpoAdmin"
  );

  admin = null;
  dataSemua = [];

  dashboard.style.display =
    "none";

  loginPage.style.display =
    "block";

  password.value = "";

}


password.addEventListener(
  "keydown",
  function(event){

    if(event.key === "Enter"){
      login();
    }

  }
);


window.addEventListener(
  "load",
  function(){

    try{

      const simpanan =
        JSON.parse(
          localStorage.getItem(
            "skpoAdmin"
          ) || "null"
        );

      if(
        simpanan &&
        simpanan.noBadan
      ){

        admin =
          simpanan;

        buka();

      }

    }catch(error){

      localStorage.removeItem(
        "skpoAdmin"
      );

    }

  }
);
