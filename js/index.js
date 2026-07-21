// ===============================
// DEVICE ID PELAYAR
// ===============================

function dapatkanDeviceId(){

  const kunci =
    "skpoDeviceId";

  let deviceId =
    localStorage.getItem(
      kunci
    );

  if(!deviceId){

    let rawak = "";

    if(
      window.crypto &&
      typeof window.crypto.randomUUID ===
      "function"
    ){

      rawak =
        window.crypto.randomUUID();

    }else{

      rawak =
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
          .replace(
            /[xy]/g,
            function(aksara){

              const nombor =
                Math.random() * 16 | 0;

              const nilai =
                aksara === "x"
                  ? nombor
                  : (
                      nombor & 0x3 |
                      0x8
                    );

              return nilai.toString(16);

            }
          );

    }

    deviceId =
      "DEV-" +
      rawak.toUpperCase();

    localStorage.setItem(
      kunci,
      deviceId
    );

  }

  return deviceId;

}



let userLogin = null;
let lokasiGPS = null;
let tugas = null;
let jarakSemasa = null;
let lokasiDibenarkan = false;
let sedangMenghantar = false;

let lokasiGPSCheckout = null;
let jarakCheckout = null;
let lokasiCheckoutDibenarkan = false;
let sedangMenghantarCheckout = false;
let timerSemakStatus = null;

let statusKehadiranSemasa = "";
let sudahCheckOutSemasa = false;

const RADIUS_SUBTEK = 30;
const SELANG_SEMAKAN_STATUS = 15000;


// ===============================
// LOGIN
// ===============================

function login(){

  const noBadan =
    document.getElementById("noBadan")
      .value
      .trim();

  const password =
    document.getElementById("password")
      .value
      .trim();

  const status =
    document.getElementById("status");

  const btnLogin =
    document.getElementById("btnLogin");


  if(!noBadan || !password){

    status.innerHTML =
      '<span class="status-error">' +
      'Sila masukkan No Badan dan kata laluan.' +
      '</span>';

    return;

  }


  status.innerHTML =
    '<span class="status-warning">' +
    'Sedang menyemak...' +
    '</span>';

  btnLogin.disabled = true;


  google.script.run

    .withSuccessHandler(function(res){

      btnLogin.disabled = false;


      if(res && res.status === true){

        userLogin = res;

        localStorage.setItem(
          "user",
          JSON.stringify(res)
        );


        document.getElementById(
          "loginBox"
        ).style.display = "none";


        document.getElementById(
          "dashboard"
        ).style.display = "block";


        document.getElementById(
          "pangkatPetugas"
        ).textContent =
          res.pangkat || "PANGKAT TIDAK DINYATAKAN";


        document.getElementById(
          "namaPetugas"
        ).textContent =
          res.nama || "-";


        document.getElementById(
          "noBadanPetugas"
        ).textContent =
          "No Badan: " +
          (res.noBadan || "-");


        status.innerHTML = "";


        dapatkanTugasHariIni(
          res.noBadan
        );

        mulaSemakanStatusAutomatik();

      }else{

        status.innerHTML =
          '<span class="status-error">' +

          escapeHtml(
            res && res.mesej
              ? res.mesej
              : "Login gagal."
          ) +

          '</span>';

      }

    })

    .withFailureHandler(function(error){

      btnLogin.disabled = false;

      status.innerHTML =
        '<span class="status-error">' +
        "Ralat sistem: " +
        escapeHtml(error.message) +
        '</span>';

    })

    .loginPetugas(
      noBadan,
      password
    );

}



// ===============================
// KELAYAKAN PELAPORAN
// ===============================

function nilaiYaPelaporan(nilai){

  return [
    "YA",
    "YES",
    "Y",
    "1",
    "BENAR",
    "TRUE"
  ].includes(
    String(nilai || "")
      .trim()
      .toUpperCase()
  );

}


function petugasLayakHantarLaporan(dataTugas){

  if(
    !dataTugas ||
    dataTugas.status !== true
  ){
    return false;
  }

  return (
    nilaiYaPelaporan(
      dataTugas.penyelia
    ) ||
    nilaiYaPelaporan(
      dataTugas.pemegangSet
    )
  );

}


function kemasKiniButangPelaporan(dataTugas){

  const btnLaporan =
    document.getElementById(
      "btnLaporan"
    );

  const layakJawatan =
    petugasLayakHantarLaporan(
      dataTugas
    );

  const kehadiranDisahkan =
    String(
      statusKehadiranSemasa || ""
    ).trim().toUpperCase() === "HADIR";

  const bolehHantar =
    layakJawatan &&
    kehadiranDisahkan &&
    sudahCheckOutSemasa !== true;

  /*
    Petugas yang bukan Penyelia atau
    Pemegang Set tidak melihat butang.
  */
  btnLaporan.style.display =
    layakJawatan
      ? "block"
      : "none";

  btnLaporan.disabled =
    !bolehHantar;

  if(!layakJawatan){

    btnLaporan.textContent =
      "HANTAR PELAPORAN";

  }else if(sudahCheckOutSemasa === true){

    btnLaporan.textContent =
      "PELAPORAN DITUTUP SELEPAS CHECK-OUT";

  }else if(!kehadiranDisahkan){

    btnLaporan.textContent =
      "PELAPORAN MENUNGGU PENGESAHAN URUSETIA";

  }else{

    btnLaporan.textContent =
      "HANTAR PELAPORAN";

  }

}


// ===============================
// DAPATKAN TUGAS
// ===============================

function dapatkanTugasHariIni(noBadan){

  const statusTugas =
    document.getElementById(
      "statusTugas"
    );

  const btnCheckin =
    document.getElementById(
      "btnCheckin"
    );


  statusTugas.innerHTML =
    '<span class="status-warning">' +
    'Sedang mendapatkan tugasan...' +
    '</span>';

  btnCheckin.disabled = true;


  document.getElementById(
    "callSignTugas"
  ).textContent = "Memuatkan...";

  document.getElementById(
    "jenisTugas"
  ).textContent = "Memuatkan...";

  document.getElementById(
    "lokasiTugas"
  ).textContent = "Memuatkan...";

  document.getElementById(
    "penyeliaTugas"
  ).textContent = "Memuatkan...";

  document.getElementById(
    "pemegangSetTugas"
  ).textContent = "Memuatkan...";


  google.script.run

    .withSuccessHandler(function(data){

      if(data && data.status === true){

        tugas = data;


        document.getElementById(
          "callSignTugas"
        ).textContent =
          data.callSign || "-";


        document.getElementById(
          "jenisTugas"
        ).textContent =
          data.jenisTugas || "-";


        document.getElementById(
          "lokasiTugas"
        ).textContent =
          data.lokasi || "-";


        document.getElementById(
          "penyeliaTugas"
        ).textContent =
          data.penyelia || "-";


        document.getElementById(
          "pemegangSetTugas"
        ).textContent =
          data.pemegangSet || "-";


        statusTugas.innerHTML =
          '<span class="status-success">' +
          'Tugasan hari ini dijumpai.' +
          '</span>';


        kemasKiniButangPelaporan(
          data
        );

        semakStatusSetWalkieTalkie();
        semakStatusCheckInPetugas();

      }else{

        tugas = null;

        kemasKiniButangPelaporan(
          null
        );
        resetPaparanSetWalkieTalkie();

        kosongkanMaklumatTugas();

        const statusDiganti =
          adakahStatusDiganti(data);

        if(statusDiganti){

          statusTugas.innerHTML =
            '<span class="status-error">' +
            '<strong>STATUS PETUGAS: DIGANTI</strong><br>' +
            'Anda telah digantikan dengan petugas lain bagi penugasan hari ini.' +
            '</span>';

          btnCheckin.disabled = true;
          btnCheckin.textContent =
            "CHECK-IN TIDAK DIBENARKAN";

          const btnCheckout =
            document.getElementById(
              "btnCheckout"
            );

          btnCheckout.disabled = true;
          btnCheckout.textContent =
            "CHECK-OUT TIDAK DIBENARKAN";

          const statusKehadiran =
            document.getElementById(
              "statusKehadiran"
            );

          statusKehadiran.className =
            "status-box error";

          statusKehadiran.innerHTML =
            "<strong>Anda tidak lagi berada dalam senarai petugas aktif.</strong><br>" +
            "Status penugasan anda ialah DIGANTI.";

          const statusCheckout =
            document.getElementById(
              "statusCheckout"
            );

          statusCheckout.className =
            "status-box error";

          statusCheckout.innerHTML =
            "Check-Out tidak dibenarkan untuk petugas berstatus DIGANTI.";

        }else{

          statusTugas.innerHTML =
            '<span class="status-error">' +

            escapeHtml(
              data && data.mesej
                ? data.mesej
                : "Tiada tugasan hari ini."
            ) +

            '</span>';

          btnCheckin.disabled = true;

        }

      }

    })

    .withFailureHandler(function(error){

      tugas = null;

      kosongkanMaklumatTugas();

      statusTugas.innerHTML =
        '<span class="status-error">' +
        "Ralat mendapatkan tugasan: " +
        escapeHtml(error.message) +
        '</span>';

      btnCheckin.disabled = true;

    })

    .dapatkanTugas(noBadan);

}


// ===============================
// SEMAK STATUS CHECK-IN
// ===============================

function semakStatusCheckInPetugas(){

  if(!userLogin){
    return;
  }


  const btnCheckin =
    document.getElementById(
      "btnCheckin"
    );

  const statusKehadiran =
    document.getElementById(
      "statusKehadiran"
    );


  btnCheckin.disabled = true;

  statusKehadiran.className =
    "status-box warning";

  statusKehadiran.innerHTML =
    "Sedang menyemak status kehadiran...";


  google.script.run

    .withSuccessHandler(function(res){

      if(
        res &&
        res.status === true &&
        res.sudahCheckIn === true
      ){

        btnCheckin.disabled = true;

        btnCheckin.textContent =
          "CHECK-IN TELAH DIREKODKAN";

        const statusSemasa =
          String(
            res.statusKehadiran || ""
          ).toUpperCase();

        statusKehadiranSemasa =
          statusSemasa;

        kemasKiniButangPelaporan(
          tugas
        );


        if(statusSemasa === "DITOLAK"){

          statusKehadiran.className =
            "status-box error";

        }else if(
          statusSemasa ===
          "MENUNGGU PENGESAHAN URUSETIA"
        ){

          statusKehadiran.className =
            "status-box warning";

        }else{

          statusKehadiran.className =
            "status-box success";

        }


        statusKehadiran.innerHTML =

          "<strong>Check-In telah direkodkan.</strong><br>" +

          "Masa: " +
          escapeHtml(res.masa || "-") +

          "<br>Status: " +
          escapeHtml(
            res.statusKehadiran || "-"
          );

        semakStatusCheckOutPetugas();

      }else{

        /*
          Jika Pentadbir telah membuat RESET DEVICE,
          rekod Check-In hari ini telah dipadamkan.
          Dashboard petugas perlu kembali kepada
          status BELUM HADIR dan membenarkan Check-In semula.
        */

        statusKehadiranSemasa = "";
        sudahCheckOutSemasa = false;

        kemasKiniButangPelaporan(
          tugas
        );

        btnCheckin.disabled = false;

        btnCheckin.textContent =
          "CHECK-IN KEHADIRAN";

        statusKehadiran.style.display =
          "block";

        statusKehadiran.className =
          "status-box warning";

        statusKehadiran.innerHTML =
          "<strong>Status Kehadiran: BELUM HADIR</strong><br>" +
          "Sila buat Check-In kehadiran menggunakan peranti yang dibenarkan.";

        const btnCheckout =
          document.getElementById(
            "btnCheckout"
          );

        btnCheckout.disabled = true;

        btnCheckout.textContent =
          "CHECK-OUT TIDAK DIBENARKAN";

        const statusCheckout =
          document.getElementById(
            "statusCheckout"
          );

        statusCheckout.style.display =
          "block";

        statusCheckout.className =
          "status-box warning";

        statusCheckout.innerHTML =
          "Check-Out hanya dibenarkan selepas Check-In disahkan.";

        /*
          Kosongkan data GPS lama supaya rekod sebelumnya
          tidak boleh dihantar semula secara tidak sengaja.
        */
        lokasiGPS = null;
        jarakSemasa = null;
        lokasiDibenarkan = false;
        sedangMenghantar = false;

        lokasiGPSCheckout = null;
        jarakCheckout = null;
        lokasiCheckoutDibenarkan = false;
        sedangMenghantarCheckout = false;

      }

    })

    .withFailureHandler(function(error){

      btnCheckin.disabled = false;

      statusKehadiran.className =
        "status-box error";

      statusKehadiran.innerHTML =
        "Ralat menyemak status: " +
        escapeHtml(error.message);

    })

    .semakStatusCheckIn(
      userLogin.noBadan
    );

}


// ===============================
// BUKA CHECK-IN
// ===============================

function mulaCheckin(){

  if(!tugas || tugas.status !== true){

    alert(
      "Tiada tugasan yang sah untuk hari ini."
    );

    return;

  }


  lokasiGPS = null;
  jarakSemasa = null;
  lokasiDibenarkan = false;
  sedangMenghantar = false;


  document.getElementById(
    "dashboard"
  ).style.display = "none";


  document.getElementById(
    "checkin"
  ).style.display = "block";


  document.getElementById(
    "tugasCheckin"
  ).innerHTML =

    binaBarisMaklumat(
      "Call Sign:",
      tugas.callSign
    ) +

    binaBarisMaklumat(
      "Jenis Tugas:",
      tugas.jenisTugas
    ) +

    binaBarisMaklumat(
      "Tempat Tugas:",
      tugas.lokasi
    ) +

    binaBarisMaklumat(
      "Penyelia:",
      tugas.penyelia
    ) +

    binaBarisMaklumat(
      "Pemegang Set:",
      tugas.pemegangSet
    );


  document.getElementById(
    "gpsStatus"
  ).innerHTML =
    "Sila dapatkan lokasi GPS semasa.";


  document.getElementById(
    "koordinat"
  ).innerHTML = "";


  document.getElementById(
    "jarakStatus"
  ).innerHTML = "";


  const statusHantar =
    document.getElementById(
      "statusHantar"
    );

  statusHantar.style.display = "none";
  statusHantar.innerHTML = "";


  document.getElementById(
    "btnDapatGPS"
  ).disabled = false;


  const btnHantar =
    document.getElementById(
      "btnHantar"
    );

  btnHantar.disabled = true;
  btnHantar.textContent =
    "HANTAR KEHADIRAN";

}


// ===============================
// DAPATKAN GPS
// ===============================

function dapatkanGPS(){

  const gpsStatus =
    document.getElementById(
      "gpsStatus"
    );

  const koordinat =
    document.getElementById(
      "koordinat"
    );

  const jarakStatus =
    document.getElementById(
      "jarakStatus"
    );

  const btnGPS =
    document.getElementById(
      "btnDapatGPS"
    );

  const btnHantar =
    document.getElementById(
      "btnHantar"
    );


  lokasiGPS = null;
  jarakSemasa = null;
  lokasiDibenarkan = false;

  btnHantar.disabled = true;


  if(!navigator.geolocation){

    gpsStatus.innerHTML =
      '<span class="status-error">' +
      'Peranti ini tidak menyokong GPS.' +
      '</span>';

    return;

  }


  gpsStatus.innerHTML =
    '<span class="status-warning">' +
    'Mendapatkan lokasi GPS...' +
    '</span>';


  koordinat.innerHTML = "";
  jarakStatus.innerHTML = "";
  btnGPS.disabled = true;


  navigator.geolocation.getCurrentPosition(

    function(position){

      btnGPS.disabled = false;


      lokasiGPS = {

        lat:Number(
          position.coords.latitude
        ),

        lng:Number(
          position.coords.longitude
        ),

        accuracy:Number(
          position.coords.accuracy
        )

      };


      gpsStatus.innerHTML =
        '<span class="status-success">' +
        'GPS berjaya diperoleh.' +
        '</span>';


      koordinat.innerHTML =

        "Latitude: " +
        lokasiGPS.lat.toFixed(7) +

        "<br>Longitude: " +
        lokasiGPS.lng.toFixed(7) +

        "<br>Ketepatan GPS: " +
        lokasiGPS.accuracy.toFixed(1) +
        " meter";


      semakRadiusLokasi();

    },

    function(error){

      btnGPS.disabled = false;


      let mesej =
        "Lokasi GPS tidak berjaya diperoleh.";


      if(error.code === 1){

        mesej =
          "Kebenaran lokasi ditolak. " +
          "Sila benarkan akses lokasi.";

      }else if(error.code === 2){

        mesej =
          "Lokasi tidak dapat dikesan. " +
          "Sila aktifkan GPS.";

      }else if(error.code === 3){

        mesej =
          "Masa mendapatkan GPS tamat. " +
          "Sila cuba semula.";

      }


      gpsStatus.innerHTML =
        '<span class="status-error">' +
        escapeHtml(mesej) +
        '</span>';

    },

    {
      enableHighAccuracy:true,
      timeout:20000,
      maximumAge:0
    }

  );

}


// ===============================
// SEMAK RADIUS SUBTEK
// ===============================

function semakRadiusLokasi(){

  if(!lokasiGPS || !tugas){
    return;
  }


  const latSubtek =
    Number(tugas.lat);

  const lngSubtek =
    Number(tugas.lng);


  if(
    !Number.isFinite(latSubtek) ||
    !Number.isFinite(lngSubtek) ||
    latSubtek === 0 ||
    lngSubtek === 0
  ){

    lokasiDibenarkan = false;

    document.getElementById(
      "jarakStatus"
    ).innerHTML =

      '<span class="status-error">' +
      'Koordinat lokasi SUBTEK tidak sah.' +
      '</span>';

    document.getElementById(
      "btnHantar"
    ).disabled = true;

    return;

  }


  jarakSemasa = kiraJarakMeter(

    lokasiGPS.lat,
    lokasiGPS.lng,

    latSubtek,
    lngSubtek

  );


  let html = "";


  if(lokasiGPS.accuracy > 50){

    lokasiDibenarkan = false;

    html =

      "<span class='status-error'>" +

      "Ketepatan GPS terlalu lemah.<br>" +

      "Sila bergerak ke kawasan terbuka " +
      "dan dapatkan lokasi GPS sekali lagi." +

      "</span>";

  }

  else if(jarakSemasa <= RADIUS_SUBTEK){

    lokasiDibenarkan = true;

    html =

      "<span class='status-success'>" +

      "Lokasi SUBTEK berjaya disahkan.<br>" +

      "Pengesahan kehadiran sedia untuk dihantar." +

      "</span>";

  }

  else{

    lokasiDibenarkan = false;

    html =

      "<span class='status-error'>" +

      "Anda berada di luar kawasan SUBTEK.<br>" +

      "Pengesahan kehadiran hanya dibenarkan " +
      "dalam lingkungan 30 meter dari SUBTEK." +

      "</span>";

  }


  document.getElementById(
    "jarakStatus"
  ).innerHTML = html;


  document.getElementById(
    "btnHantar"
  ).disabled =
    !lokasiDibenarkan;

}


// ===============================
// HANTAR KEHADIRAN
// ===============================

function hantarKehadiran(){

  if(sedangMenghantar){
    return;
  }


  if(!userLogin){

    alert(
      "Maklumat pengguna tidak dijumpai."
    );

    return;

  }


  if(!tugas){

    alert(
      "Maklumat tugasan tidak dijumpai."
    );

    return;

  }


  if(!lokasiGPS){

    alert(
      "Sila dapatkan lokasi GPS dahulu."
    );

    return;

  }


  if(!lokasiDibenarkan){

    alert(

      "Kehadiran tidak boleh dihantar.\n\n" +

      "Anda mesti berada dalam lingkungan " +
      "30 meter dari lokasi SUBTEK."

    );

    return;

  }


  const btnHantar =
    document.getElementById(
      "btnHantar"
    );

  const btnGPS =
    document.getElementById(
      "btnDapatGPS"
    );

  const btnKembali =
    document.getElementById(
      "btnKembali"
    );

  const statusHantar =
    document.getElementById(
      "statusHantar"
    );


  sedangMenghantar = true;

  btnHantar.disabled = true;
  btnGPS.disabled = true;
  btnKembali.disabled = true;

  btnHantar.textContent =
    "SEDANG MENGHANTAR...";


  statusHantar.className =
    "status-box warning";

  statusHantar.innerHTML =
    "Sedang menyimpan rekod kehadiran...";


  const dataKehadiran = {

    noBadan:
      userLogin.noBadan,

    lat:
      lokasiGPS.lat,

    lng:
      lokasiGPS.lng,

    accuracy:
      lokasiGPS.accuracy,

    deviceId:
      dapatkanDeviceId()

  };


  google.script.run

    .withSuccessHandler(function(res){

      sedangMenghantar = false;
      btnKembali.disabled = false;


      if(res && res.status === true){

        lokasiDibenarkan = false;

        btnHantar.disabled = true;
        btnGPS.disabled = true;

        btnHantar.textContent =
          "CHECK-IN BERJAYA";


        statusHantar.className =
          "status-box success";

        statusHantar.innerHTML =

          "<strong>Check-In berjaya dihantar.</strong><br>" +

          "Masa: " +
          escapeHtml(res.masa || "-") +

          "<br>Status: " +
          escapeHtml(
            res.statusKehadiran ||
            "MENUNGGU PENGESAHAN PENYELIA"
          );


        document.getElementById(
          "gpsStatus"
        ).innerHTML =

          '<span class="status-success">' +
          'Rekod kehadiran telah disimpan.' +
          '</span>';


        setTimeout(function(){

          kembaliDashboard();

          semakStatusCheckInPetugas();

        }, 1800);

      }else{

        if(
          res &&
          res.ditolakAutomatik === true
        ){

          lokasiDibenarkan = false;

          btnGPS.disabled = true;
          btnHantar.disabled = true;

          btnHantar.textContent =
            "CHECK-IN DITOLAK";

          statusHantar.className =
            "status-box error";

          statusHantar.innerHTML =

            "<strong>CHECK-IN DITOLAK SECARA AUTOMATIK</strong><br>" +

            escapeHtml(
              res.mesej ||
              "Device ID yang sama telah digunakan oleh No Badan lain."
            ) +

            "<br><br>Status: DITOLAK";

          document.getElementById(
            "gpsStatus"
          ).innerHTML =
            '<span class="status-error">' +
            'Rekod telah dihantar terus ke Pentadbir.' +
            '</span>';

          setTimeout(function(){

            kembaliDashboard();
            semakStatusCheckInPetugas();

          }, 2500);

          return;

        }

        btnGPS.disabled = false;

        btnHantar.disabled =
          !lokasiDibenarkan;

        btnHantar.textContent =
          "HANTAR KEHADIRAN";


        statusHantar.className =
          "status-box error";

        statusHantar.innerHTML =
          escapeHtml(
            res && res.mesej
              ? res.mesej
              : "Check-In tidak berjaya dihantar."
          );


        if(
          res &&
          res.sudahCheckIn === true
        ){

          btnGPS.disabled = true;
          btnHantar.disabled = true;

          btnHantar.textContent =
            "CHECK-IN TELAH DIREKODKAN";

        }

      }

    })

    .withFailureHandler(function(error){

      sedangMenghantar = false;

      btnGPS.disabled = false;
      btnKembali.disabled = false;

      btnHantar.disabled =
        !lokasiDibenarkan;

      btnHantar.textContent =
        "HANTAR KEHADIRAN";


      statusHantar.className =
        "status-box error";

      statusHantar.innerHTML =
        "Ralat sistem: " +
        escapeHtml(error.message);

    })

    .simpanCheckIn(
      dataKehadiran
    );

}




// ===============================
// SEMAK STATUS CHECK-OUT
// ===============================

function semakStatusCheckOutPetugas(){

  if(!userLogin){
    return;
  }

  const btnCheckout =
    document.getElementById(
      "btnCheckout"
    );

  const statusCheckout =
    document.getElementById(
      "statusCheckout"
    );

  btnCheckout.disabled = true;

  statusCheckout.className =
    "status-box warning";

  statusCheckout.innerHTML =
    "Sedang menyemak status Check-Out...";

  google.script.run

    .withSuccessHandler(function(res){

      if(
        res &&
        res.status === true &&
        res.sudahCheckOut === true
      ){

        sudahCheckOutSemasa = true;

        kemasKiniButangPelaporan(
          tugas
        );

        btnCheckout.disabled = true;

        btnCheckout.textContent =
          "CHECK-OUT TELAH DIREKODKAN";

        statusCheckout.className =
          "status-box success";

        statusCheckout.innerHTML =

          "<strong>Check-Out telah direkodkan.</strong><br>" +

          "Masa: " +
          escapeHtml(res.masa || "-") +

          "<br>Tempoh Bertugas: " +
          escapeHtml(res.tempohBertugas || "-") +

          "<br>Status: <strong>SELESAI TUGAS</strong>";

      }else if(
        res &&
        res.checkOutDibenarkan === true
      ){

        sudahCheckOutSemasa = false;

        kemasKiniButangPelaporan(
          tugas
        );

        btnCheckout.disabled = false;

        btnCheckout.textContent =
          "CHECK-OUT KEHADIRAN";

        statusCheckout.className =
          "status-box warning";

        statusCheckout.innerHTML =
          "Check-Out boleh dibuat selepas selesai tugas. GPS perlu berada dalam lingkungan radius 30 meter dari SUBTEK.";

      }else{

        sudahCheckOutSemasa =
          Boolean(
            res &&
            res.sudahCheckOut === true
          );

        kemasKiniButangPelaporan(
          tugas
        );

        btnCheckout.disabled = true;

        btnCheckout.textContent =
          "CHECK-OUT TIDAK DIBENARKAN";

        statusCheckout.className =
          "status-box error";

        statusCheckout.innerHTML =
          escapeHtml(
            res && res.mesej
              ? res.mesej
              : "Check-Out tidak dibenarkan."
          );

      }

    })

    .withFailureHandler(function(error){

      btnCheckout.disabled = true;

      statusCheckout.className =
        "status-box error";

      statusCheckout.innerHTML =
        "Ralat menyemak Check-Out: " +
        escapeHtml(error.message);

    })

    .semakStatusCheckOut(
      userLogin.noBadan
    );

}


// ===============================
// BUKA CHECK-OUT
// ===============================

function mulaCheckout(){

  if(!tugas || tugas.status !== true){

    alert(
      "Tiada tugasan yang sah untuk hari ini."
    );

    return;

  }

  lokasiGPSCheckout = null;
  jarakCheckout = null;
  lokasiCheckoutDibenarkan = false;
  sedangMenghantarCheckout = false;

  document.getElementById(
    "dashboard"
  ).style.display = "none";

  document.getElementById(
    "checkout"
  ).style.display = "block";

  document.getElementById(
    "tugasCheckout"
  ).innerHTML =

    binaBarisMaklumat(
      "Call Sign:",
      tugas.callSign
    ) +

    binaBarisMaklumat(
      "Jenis Tugas:",
      tugas.jenisTugas
    ) +

    binaBarisMaklumat(
      "Tempat Tugas:",
      tugas.lokasi
    );

  document.getElementById(
    "gpsStatusCheckout"
  ).innerHTML =
    "Sila dapatkan lokasi GPS semasa.";

  document.getElementById(
    "koordinatCheckout"
  ).innerHTML = "";

  document.getElementById(
    "jarakStatusCheckout"
  ).innerHTML = "";

  const statusHantar =
    document.getElementById(
      "statusHantarCheckout"
    );

  statusHantar.style.display = "none";
  statusHantar.innerHTML = "";

  document.getElementById(
    "btnDapatGPSCheckout"
  ).disabled = false;

  const btnHantar =
    document.getElementById(
      "btnHantarCheckout"
    );

  btnHantar.disabled = true;
  btnHantar.textContent =
    "HANTAR CHECK-OUT";

}


// ===============================
// DAPATKAN GPS CHECK-OUT
// ===============================

function dapatkanGPSCheckout(){

  const gpsStatus =
    document.getElementById(
      "gpsStatusCheckout"
    );

  const koordinat =
    document.getElementById(
      "koordinatCheckout"
    );

  const jarakStatus =
    document.getElementById(
      "jarakStatusCheckout"
    );

  const btnGPS =
    document.getElementById(
      "btnDapatGPSCheckout"
    );

  const btnHantar =
    document.getElementById(
      "btnHantarCheckout"
    );

  lokasiGPSCheckout = null;
  jarakCheckout = null;
  lokasiCheckoutDibenarkan = false;

  btnHantar.disabled = true;

  if(!navigator.geolocation){

    gpsStatus.innerHTML =
      '<span class="status-error">' +
      'Peranti ini tidak menyokong GPS.' +
      '</span>';

    return;

  }

  gpsStatus.innerHTML =
    '<span class="status-warning">' +
    'Mendapatkan lokasi GPS...' +
    '</span>';

  koordinat.innerHTML = "";
  jarakStatus.innerHTML = "";
  btnGPS.disabled = true;

  navigator.geolocation.getCurrentPosition(

    function(position){

      btnGPS.disabled = false;

      lokasiGPSCheckout = {
        lat:Number(position.coords.latitude),
        lng:Number(position.coords.longitude),
        accuracy:Number(position.coords.accuracy)
      };

      gpsStatus.innerHTML =
        '<span class="status-success">' +
        'GPS Check-Out berjaya diperoleh.' +
        '</span>';

      koordinat.innerHTML =

        "Latitude: " +
        lokasiGPSCheckout.lat.toFixed(7) +

        "<br>Longitude: " +
        lokasiGPSCheckout.lng.toFixed(7) +

        "<br>Ketepatan GPS: " +
        lokasiGPSCheckout.accuracy.toFixed(1) +
        " meter";

      semakRadiusCheckout();

    },

    function(error){

      btnGPS.disabled = false;

      let mesej =
        "Lokasi GPS tidak berjaya diperoleh.";

      if(error.code === 1){
        mesej =
          "Kebenaran lokasi ditolak. Sila benarkan akses lokasi.";
      }else if(error.code === 2){
        mesej =
          "Lokasi tidak dapat dikesan. Sila aktifkan GPS.";
      }else if(error.code === 3){
        mesej =
          "Masa mendapatkan GPS tamat. Sila cuba semula.";
      }

      gpsStatus.innerHTML =
        '<span class="status-error">' +
        escapeHtml(mesej) +
        '</span>';

    },

    {
      enableHighAccuracy:true,
      timeout:20000,
      maximumAge:0
    }

  );

}


// ===============================
// SEMAK RADIUS CHECK-OUT
// ===============================

function semakRadiusCheckout(){

  if(!lokasiGPSCheckout || !tugas){
    return;
  }

  const latSubtek = Number(tugas.lat);
  const lngSubtek = Number(tugas.lng);

  jarakCheckout = kiraJarakMeter(
    lokasiGPSCheckout.lat,
    lokasiGPSCheckout.lng,
    latSubtek,
    lngSubtek
  );

  let html = "";

  if(lokasiGPSCheckout.accuracy > 50){

    lokasiCheckoutDibenarkan = false;

    html =
      "<span class='status-error'>" +
      "Ketepatan GPS terlalu lemah.<br>" +
      "Sila dapatkan lokasi sekali lagi di kawasan terbuka." +
      "</span>";

  }else if(jarakCheckout <= RADIUS_SUBTEK){

    lokasiCheckoutDibenarkan = true;

    html =
      "<span class='status-success'>" +
      "Lokasi Check-Out berjaya disahkan.<br>" +
      "Sila tekan pada butang hantar check-out." +
      "</span>";

  }else{

    lokasiCheckoutDibenarkan = false;

    html =
      "<span class='status-error'>" +
      "Anda berada di luar lingkungan 30 meter dari SUBTEK." +
      "</span>";

  }

  document.getElementById(
    "jarakStatusCheckout"
  ).innerHTML = html;

  document.getElementById(
    "btnHantarCheckout"
  ).disabled =
    !lokasiCheckoutDibenarkan;

}


// ===============================
// HANTAR CHECK-OUT
// ===============================

function hantarCheckout(){

  if(sedangMenghantarCheckout){
    return;
  }

  if(
    !userLogin ||
    !tugas ||
    !lokasiGPSCheckout ||
    !lokasiCheckoutDibenarkan
  ){

    alert(
      "Sila lengkapkan pengesahan GPS Check-Out."
    );

    return;

  }

  const btnHantar =
    document.getElementById(
      "btnHantarCheckout"
    );

  const btnGPS =
    document.getElementById(
      "btnDapatGPSCheckout"
    );

  const btnKembali =
    document.getElementById(
      "btnKembaliCheckout"
    );

  const statusHantar =
    document.getElementById(
      "statusHantarCheckout"
    );

  sedangMenghantarCheckout = true;

  btnHantar.disabled = true;
  btnGPS.disabled = true;
  btnKembali.disabled = true;

  btnHantar.textContent =
    "SEDANG MENGHANTAR...";

  statusHantar.className =
    "status-box warning";

  statusHantar.innerHTML =
    "Sedang menyimpan rekod Check-Out...";

  google.script.run

    .withSuccessHandler(function(res){

      sedangMenghantarCheckout = false;
      btnKembali.disabled = false;

      if(res && res.status === true){

        lokasiCheckoutDibenarkan = false;

        btnHantar.disabled = true;
        btnGPS.disabled = true;

        btnHantar.textContent =
          "CHECK-OUT BERJAYA";

        statusHantar.className =
          "status-box success";

        statusHantar.innerHTML =

          "<strong>Check-Out berjaya.</strong><br>" +

          "Masa: " +
          escapeHtml(res.masa || "-") +

          "<br>Tempoh Bertugas: " +
          escapeHtml(res.tempohBertugas || "-") +

          "<br>Status: <strong>SELESAI TUGAS</strong>";

        setTimeout(function(){

          kembaliDashboardCheckout();
          semakStatusCheckInPetugas();

        }, 1800);

      }else{

        btnGPS.disabled = false;

        btnHantar.disabled =
          !lokasiCheckoutDibenarkan;

        btnHantar.textContent =
          "HANTAR CHECK-OUT";

        statusHantar.className =
          "status-box error";

        statusHantar.innerHTML =
          escapeHtml(
            res && res.mesej
              ? res.mesej
              : "Check-Out tidak berjaya."
          );

        if(res && res.sudahCheckOut === true){

          btnGPS.disabled = true;
          btnHantar.disabled = true;

          btnHantar.textContent =
            "CHECK-OUT TELAH DIREKODKAN";

        }

      }

    })

    .withFailureHandler(function(error){

      sedangMenghantarCheckout = false;

      btnGPS.disabled = false;
      btnKembali.disabled = false;

      btnHantar.disabled =
        !lokasiCheckoutDibenarkan;

      btnHantar.textContent =
        "HANTAR CHECK-OUT";

      statusHantar.className =
        "status-box error";

      statusHantar.innerHTML =
        "Ralat sistem: " +
        escapeHtml(error.message);

    })

    .simpanCheckOut({
      noBadan:userLogin.noBadan,
      lat:lokasiGPSCheckout.lat,
      lng:lokasiGPSCheckout.lng,
      accuracy:lokasiGPSCheckout.accuracy,
      deviceId:dapatkanDeviceId()
    });

}


// ===============================
// KEMBALI DARIPADA CHECK-OUT
// ===============================

function kembaliDashboardCheckout(){

  document.getElementById(
    "checkout"
  ).style.display = "none";

  document.getElementById(
    "laporan"
  ).style.display = "none";

  document.getElementById(
    "dashboard"
  ).style.display = "block";

}



// ===============================
// PELAPORAN PETUGAS
// ===============================

function bukaLaporan(){

  if(
    !userLogin ||
    !tugas ||
    tugas.status !== true
  ){
    alert(
      "Tiada tugasan yang sah untuk membuat laporan."
    );
    return;
  }

  if(
    !petugasLayakHantarLaporan(
      tugas
    )
  ){
    alert(
      "Pelaporan hanya dibenarkan kepada petugas " +
      "yang ditetapkan sebagai PENYELIA atau " +
      "PEMEGANG SET bagi penugasan hari ini."
    );
    return;
  }

  if(
    String(
      statusKehadiranSemasa || ""
    ).trim().toUpperCase() !== "HADIR"
  ){
    alert(
      "Pelaporan hanya boleh dibuat selepas " +
      "kehadiran disahkan oleh Urusetia."
    );
    return;
  }

  if(sudahCheckOutSemasa === true){
    alert(
      "Pelaporan tidak boleh dibuat selepas Check-Out direkodkan."
    );
    return;
  }

  document.getElementById("dashboard").style.display = "none";
  document.getElementById("laporan").style.display = "block";

  document.getElementById("tugasLaporan").innerHTML =
    binaBarisMaklumat("Call Sign:",tugas.callSign) +
    binaBarisMaklumat("Jenis Tugas:",tugas.jenisTugas) +
    binaBarisMaklumat("Tempat Tugas:",tugas.lokasi) +
    binaBarisMaklumat("Penyelia:",tugas.penyelia);

  kemasKiniTarikhMasaLaporan();

  document.getElementById("jumlahPengunjung").value = "";
  document.getElementById("jumlahKenderaan").value = "";
  document.getElementById("vvipVip").value = "";
  document.getElementById("perkaraMenarik").value = "";

  const statusLaporan = document.getElementById("statusLaporan");
  statusLaporan.style.display = "none";
  statusLaporan.innerHTML = "";

  const btn = document.getElementById("btnHantarLaporan");
  btn.disabled = false;
  btn.textContent = "HANTAR LAPORAN KEPADA URUSETIA";
}

function kemasKiniTarikhMasaLaporan(){
  document.getElementById("tarikhMasaLaporan").textContent =
    new Date().toLocaleString("ms-MY",{
      day:"2-digit",month:"2-digit",year:"numeric",
      hour:"2-digit",minute:"2-digit",second:"2-digit"
    });
}

function tutupLaporan(){
  document.getElementById("laporan").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
}

function hantarLaporan(){

  if(
    !userLogin ||
    !tugas
  ){
    return;
  }

  const statusLaporan =
    document.getElementById(
      "statusLaporan"
    );

  if(
    !petugasLayakHantarLaporan(
      tugas
    )
  ){

    statusLaporan.className =
      "status-box error";

    statusLaporan.innerHTML =
      "Pelaporan hanya dibenarkan kepada " +
      "petugas yang ditetapkan sebagai " +
      "PENYELIA atau PEMEGANG SET.";

    return;
  }

  if(
    String(
      statusKehadiranSemasa || ""
    ).trim().toUpperCase() !== "HADIR"
  ){

    statusLaporan.className =
      "status-box error";

    statusLaporan.innerHTML =
      "Pelaporan hanya boleh dihantar selepas " +
      "kehadiran disahkan oleh Urusetia.";

    return;
  }

  if(sudahCheckOutSemasa === true){

    statusLaporan.className =
      "status-box error";

    statusLaporan.innerHTML =
      "Pelaporan tidak boleh dibuat selepas " +
      "Check-Out direkodkan.";

    return;
  }

  const jumlahPengunjung = document.getElementById("jumlahPengunjung").value.trim();
  const jumlahKenderaan = document.getElementById("jumlahKenderaan").value.trim();
  const vvipVip = document.getElementById("vvipVip").value.trim();
  const perkaraMenarik = document.getElementById("perkaraMenarik").value.trim();
  const btn = document.getElementById("btnHantarLaporan");

  if(jumlahPengunjung === "" || jumlahKenderaan === ""){
    statusLaporan.className = "status-box error";
    statusLaporan.innerHTML = "Sila masukkan jumlah pengunjung dan jumlah kenderaan.";
    return;
  }

  if(Number(jumlahPengunjung) < 0 || Number(jumlahKenderaan) < 0){
    statusLaporan.className = "status-box error";
    statusLaporan.innerHTML = "Jumlah pengunjung dan kenderaan tidak boleh kurang daripada 0.";
    return;
  }

  if(!vvipVip || !perkaraMenarik){
    statusLaporan.className = "status-box error";
    statusLaporan.innerHTML =
      'Ruangan VVIP / VIP dan Perkara Menarik wajib diisi. Jika tiada, masukkan "TIADA".';
    return;
  }

  if(!confirm("Hantar laporan ini terus kepada URUSETIA?")) return;

  btn.disabled = true;
  btn.textContent = "SEDANG MENGHANTAR...";
  statusLaporan.className = "status-box warning";
  statusLaporan.innerHTML = "Sedang menyimpan dan menghantar laporan kepada URUSETIA...";

  google.script.run
    .withSuccessHandler(function(res){
      if(res && res.status === true){
        statusLaporan.className = "status-box success";
        statusLaporan.innerHTML =
          "<strong>LAPORAN BERJAYA DIHANTAR.</strong><br>" +
          "Tarikh: " + escapeHtml(res.tarikh || "-") +
          "<br>Masa: " + escapeHtml(res.masa || "-") +
          "<br>Status: BELUM DIBACA";

        btn.textContent = "LAPORAN TELAH DIHANTAR";

        setTimeout(function(){
          tutupLaporan();
        },2200);
      }else{
        btn.disabled = false;
        btn.textContent = "HANTAR LAPORAN KEPADA URUSETIA";
        statusLaporan.className = "status-box error";
        statusLaporan.innerHTML =
          escapeHtml(res && res.mesej ? res.mesej : "Laporan gagal dihantar.");
      }
    })
    .withFailureHandler(function(error){
      btn.disabled = false;
      btn.textContent = "HANTAR LAPORAN KEPADA URUSETIA";
      statusLaporan.className = "status-box error";
      statusLaporan.innerHTML = "Ralat sistem: " + escapeHtml(error.message);
    })
    .simpanLaporanPetugas({
      noBadan:userLogin.noBadan,
      jumlahPengunjung:Number(jumlahPengunjung),
      jumlahKenderaan:Number(jumlahKenderaan),
      vvipVip:vvipVip,
      perkaraMenarik:perkaraMenarik
    });
}

// ===============================
// KIRA JARAK
// ===============================

function kiraJarakMeter(
  lat1,
  lng1,
  lat2,
  lng2
){

  const radiusBumi =
    6371000;


  const dLat =
    darjahKeRadian(
      lat2 - lat1
    );


  const dLng =
    darjahKeRadian(
      lng2 - lng1
    );


  const a =

    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +

    Math.cos(
      darjahKeRadian(lat1)
    ) *

    Math.cos(
      darjahKeRadian(lat2)
    ) *

    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );


  return radiusBumi * c;

}


function darjahKeRadian(nilai){

  return nilai *
    Math.PI /
    180;

}


// ===============================
// SEMAK SEMULA DASHBOARD
// ===============================


// ===============================
// MODUL SET WALKIE-TALKIE
// ===============================

let rekodSetSemasa = null;


function resetPaparanSetWalkieTalkie(){

  rekodSetSemasa = null;

  const statusSet =
    document.getElementById("statusSetWalkie");

  const btnDaftar =
    document.getElementById("btnDaftarSet");

  const btnPulang =
    document.getElementById("btnPulangSet");

  statusSet.style.display = "none";
  statusSet.innerHTML = "";

  btnDaftar.style.display = "none";
  btnDaftar.disabled = true;

  btnPulang.style.display = "none";
  btnPulang.disabled = true;

}


function semakStatusSetWalkieTalkie(){

  if(!userLogin || !tugas){
    resetPaparanSetWalkieTalkie();
    return;
  }

  const statusSet =
    document.getElementById("statusSetWalkie");

  const btnDaftar =
    document.getElementById("btnDaftarSet");

  const btnPulang =
    document.getElementById("btnPulangSet");

  statusSet.className = "status-box warning";
  statusSet.innerHTML =
    "Sedang menyemak status set Walkie-Talkie...";

  btnDaftar.style.display = "none";
  btnDaftar.disabled = true;

  btnPulang.style.display = "none";
  btnPulang.disabled = true;

  google.script.run

    .withSuccessHandler(function(res){

      if(!res || res.status !== true){

        resetPaparanSetWalkieTalkie();

        if(res && res.mesej){
          statusSet.className = "status-box error";
          statusSet.innerHTML = escapeHtml(res.mesej);
        }

        return;
      }

      if(res.pemegangSet !== true){

        resetPaparanSetWalkieTalkie();
        return;
      }

      rekodSetSemasa = res;

      const statusSemasa =
        String(res.statusSet || "").toUpperCase();

      if(
        res.sudahMendaftar !== true ||
        statusSemasa === "BELUM MENDAFTAR"
      ){

        statusSet.className = "status-box warning";
        statusSet.innerHTML =
          "<strong>Status Set: BELUM MENDAFTAR</strong><br>" +
          "Anda merupakan Pemegang Set bagi penugasan hari ini.";

        btnDaftar.style.display = "block";
        btnDaftar.disabled = false;

        return;
      }

      let kelas = "warning";

      if(
        statusSemasa === "SET DILEPASKAN" ||
        statusSemasa === "SET TELAH DIPULANGKAN"
      ){
        kelas = "success";
      }else if(
        statusSemasa === "PERMOHONAN DITOLAK"
      ){
        kelas = "error";
      }

      statusSet.className = "status-box " + kelas;

      let html =
        "<strong>Status Set: " +
        escapeHtml(res.statusSet || "-") +
        "</strong>";

      if(res.noSiriSet){
        html +=
          "<br>No Siri Set: " +
          escapeHtml(res.noSiriSet);
      }

      if(res.masaPelepasan){
        html +=
          "<br>Masa Pelepasan: " +
          escapeHtml(res.masaPelepasan);
      }

      if(res.disahkanOleh){
        html +=
          "<br>Disahkan Oleh: " +
          escapeHtml(res.disahkanOleh);
      }

      if(res.sebabDitolak){
        html +=
          "<br>Sebab Ditolak: " +
          escapeHtml(res.sebabDitolak);
      }

      if(res.masaPemulangan){
        html +=
          "<br>Masa Pemulangan: " +
          escapeHtml(res.masaPemulangan);
      }

      if(res.diterimaOleh){
        html +=
          "<br>Diterima Oleh: " +
          escapeHtml(res.diterimaOleh);
      }

      statusSet.innerHTML = html;

      if(statusSemasa === "PERMOHONAN DITOLAK"){

        btnDaftar.style.display = "block";
        btnDaftar.disabled = true;
        btnDaftar.textContent =
          "PERMOHONAN SET DITOLAK";

      }else if(statusSemasa === "SET DILEPASKAN"){

        btnPulang.style.display = "block";
        btnPulang.disabled = false;

      }else if(
        statusSemasa ===
        "MENUNGGU PENGESAHAN PEMULANGAN"
      ){

        btnPulang.style.display = "block";
        btnPulang.disabled = true;
        btnPulang.textContent =
          "MENUNGGU PENGESAHAN PEMULANGAN";

      }

    })

    .withFailureHandler(function(error){

      statusSet.className = "status-box error";
      statusSet.innerHTML =
        "Ralat menyemak status set: " +
        escapeHtml(error.message);

    })

    .semakStatusSetPetugas(
      userLogin.noBadan
    );

}


function bukaPendaftaranSet(){

  if(!userLogin || !tugas){
    alert("Maklumat petugas atau tugasan tidak dijumpai.");
    return;
  }

  document.getElementById(
    "dashboard"
  ).style.display = "none";

  document.getElementById(
    "pendaftaranSet"
  ).style.display = "block";

  document.getElementById(
    "maklumatPendaftaranSet"
  ).innerHTML =

    binaBarisMaklumat(
      "No Badan:",
      userLogin.noBadan
    ) +

    binaBarisMaklumat(
      "Nama:",
      userLogin.nama
    ) +

    binaBarisMaklumat(
      "Call Sign:",
      tugas.callSign
    ) +

    binaBarisMaklumat(
      "Jenis Tugas:",
      tugas.jenisTugas
    ) +

    binaBarisMaklumat(
      "Tempat Tugas:",
      tugas.lokasi
    );

  document.getElementById("noSiriSet").value = "";
  document.getElementById("noSiriBateri").value = "";
  document.getElementById("noSiriCharger").value = "";
  document.getElementById("catatanSet").value = "";

  document
    .querySelectorAll(
      'input[name="aksesoriSet"]'
    )
    .forEach(function(input){
      input.checked = false;
    });

  const status =
    document.getElementById(
      "statusPendaftaranSet"
    );

  status.style.display = "none";
  status.innerHTML = "";

  const btn =
    document.getElementById(
      "btnHantarPendaftaranSet"
    );

  btn.disabled = false;
  btn.textContent =
    "HANTAR PENDAFTARAN KEPADA TSM";

}


function tutupPendaftaranSet(){

  document.getElementById(
    "pendaftaranSet"
  ).style.display = "none";

  document.getElementById(
    "dashboard"
  ).style.display = "block";

}


function hantarPendaftaranSet(){

  if(!userLogin || !tugas){
    return;
  }

  const noSiriSet =
    document.getElementById(
      "noSiriSet"
    ).value.trim();

  const noSiriBateri =
    document.getElementById(
      "noSiriBateri"
    ).value.trim();

  const noSiriCharger =
    document.getElementById(
      "noSiriCharger"
    ).value.trim();

  const catatan =
    document.getElementById(
      "catatanSet"
    ).value.trim();

  const aksesori =
    Array.from(
      document.querySelectorAll(
        'input[name="aksesoriSet"]:checked'
      )
    ).map(function(input){
      return input.value;
    });

  const status =
    document.getElementById(
      "statusPendaftaranSet"
    );

  const btn =
    document.getElementById(
      "btnHantarPendaftaranSet"
    );

  const btnKembali =
    document.getElementById(
      "btnKembaliPendaftaranSet"
    );

  if(!noSiriSet){

    status.className = "status-box error";
    status.innerHTML =
      "Sila masukkan No Siri Set.";

    return;
  }

  if(!catatan){

    status.className = "status-box error";
    status.innerHTML =
      'Sila isi ruangan Catatan. Jika tiada, masukkan "TIADA".';

    return;
  }

  const pasti = confirm(
    "Adakah anda pasti mahu menghantar pendaftaran set Walkie-Talkie ini kepada TSM?"
  );

  if(!pasti){
    return;
  }

  btn.disabled = true;
  btnKembali.disabled = true;

  btn.textContent =
    "SEDANG MENGHANTAR...";

  status.className = "status-box warning";
  status.innerHTML =
    "Sedang menghantar pendaftaran set...";

  google.script.run

    .withSuccessHandler(function(res){

      btnKembali.disabled = false;

      if(res && res.status === true){

        btn.disabled = true;
        btn.textContent =
          "PENDAFTARAN TELAH DIHANTAR";

        status.className = "status-box success";
        status.innerHTML =
          "<strong>Pendaftaran berjaya dihantar.</strong><br>" +
          "Status: " +
          escapeHtml(
            res.statusSet ||
            "MENUNGGU PENGESAHAN TSM"
          );

        setTimeout(function(){

          tutupPendaftaranSet();
          semakStatusSetWalkieTalkie();

        }, 1800);

      }else{

        btn.disabled = false;
        btn.textContent =
          "HANTAR PENDAFTARAN KEPADA TSM";

        status.className = "status-box error";
        status.innerHTML =
          escapeHtml(
            res && res.mesej
              ? res.mesej
              : "Pendaftaran set tidak berjaya."
          );

      }

    })

    .withFailureHandler(function(error){

      btn.disabled = false;
      btnKembali.disabled = false;

      btn.textContent =
        "HANTAR PENDAFTARAN KEPADA TSM";

      status.className = "status-box error";
      status.innerHTML =
        "Ralat sistem: " +
        escapeHtml(error.message);

    })

    .daftarSetWalkieTalkie({

      noBadan:
        userLogin.noBadan,

      noSiriSet:
        noSiriSet,

      noSiriBateri:
        noSiriBateri,

      noSiriCharger:
        noSiriCharger,

      aksesori:
        aksesori,

      catatan:
        catatan

    });

}


function mohonPemulanganSetPetugas(){

  if(
    !userLogin ||
    !rekodSetSemasa ||
    !rekodSetSemasa.idPendaftaran
  ){

    alert(
      "Maklumat pendaftaran set tidak dijumpai."
    );

    return;
  }

  const pasti = confirm(
    "Adakah anda pasti mahu menghantar permohonan pemulangan set kepada TSM?"
  );

  if(!pasti){
    return;
  }

  const btn =
    document.getElementById(
      "btnPulangSet"
    );

  btn.disabled = true;
  btn.textContent =
    "SEDANG MENGHANTAR...";

  google.script.run

    .withSuccessHandler(function(res){

      if(res && res.status === true){

        alert(
          res.mesej ||
          "Permohonan pemulangan berjaya dihantar."
        );

        semakStatusSetWalkieTalkie();

      }else{

        btn.disabled = false;
        btn.textContent =
          "PULANGKAN SET WALKIE-TALKIE";

        alert(
          res && res.mesej
            ? res.mesej
            : "Permohonan pemulangan tidak berjaya."
        );

      }

    })

    .withFailureHandler(function(error){

      btn.disabled = false;
      btn.textContent =
        "PULANGKAN SET WALKIE-TALKIE";

      alert(
        "Ralat sistem: " +
        error.message
      );

    })

    .mohonPemulanganSet(
      rekodSetSemasa.idPendaftaran,
      userLogin.noBadan
    );

}


function refreshDashboard(){

  if(!userLogin){
    return;
  }

  const btn =
    document.getElementById(
      "btnRefreshStatus"
    );

  btn.disabled = true;
  btn.textContent =
    "SEDANG MENYEMAK...";


  dapatkanTugasHariIni(
    userLogin.noBadan
  );

  semakStatusSetWalkieTalkie();


  setTimeout(function(){

    btn.disabled = false;
    btn.textContent =
      "SEMAK SEMULA STATUS";

  }, 1200);

}


// ===============================
// SEMAK STATUS SECARA AUTOMATIK
// ===============================

function mulaSemakanStatusAutomatik(){

  hentikanSemakanStatusAutomatik();


  timerSemakStatus =
    setInterval(function(){

      if(
        userLogin &&
        document.getElementById(
          "dashboard"
        ).style.display === "block"
      ){

        /*
          Muat semula tugasan dan status supaya perubahan
          RESET DEVICE oleh Pentadbir dipaparkan secara automatik.
        */
        dapatkanTugasHariIni(
          userLogin.noBadan
        );

      }

    }, SELANG_SEMAKAN_STATUS);

}


function hentikanSemakanStatusAutomatik(){

  if(timerSemakStatus){

    clearInterval(
      timerSemakStatus
    );

    timerSemakStatus = null;

  }

}


// ===============================
// KEMBALI
// ===============================

function kembaliDashboard(){

  document.getElementById(
    "checkin"
  ).style.display = "none";


  document.getElementById(
    "dashboard"
  ).style.display = "block";

}


// ===============================
// LOG KELUAR
// ===============================

function logout(){

  hentikanSemakanStatusAutomatik();

  localStorage.removeItem("user");


  userLogin = null;
  lokasiGPS = null;
  tugas = null;
  jarakSemasa = null;
  lokasiDibenarkan = false;
  sedangMenghantar = false;


  document.getElementById(
    "dashboard"
  ).style.display = "none";


  document.getElementById(
    "checkin"
  ).style.display = "none";


  document.getElementById(
    "checkout"
  ).style.display = "none";


  document.getElementById(
    "loginBox"
  ).style.display = "block";


  document.getElementById(
    "password"
  ).value = "";


  document.getElementById(
    "status"
  ).innerHTML = "";

}


// ===============================
// SEMAK STATUS PETUGAS DIGANTI
// ===============================

function adakahStatusDiganti(data){

  if(!data){
    return false;
  }

  const statusPetugas =
    String(
      data.statusPetugas ||
      data.statusPenugasan ||
      data.statusTugas ||
      ""
    )
      .trim()
      .toUpperCase();

  const mesej =
    String(
      data.mesej || ""
    )
      .trim()
      .toUpperCase();

  return (
    data.diganti === true ||
    statusPetugas === "DIGANTI" ||
    mesej.indexOf("DIGANTI") !== -1
  );

}


// ===============================
// KOSONGKAN MAKLUMAT TUGAS
// ===============================

function kosongkanMaklumatTugas(){

  document.getElementById(
    "callSignTugas"
  ).textContent = "-";

  document.getElementById(
    "jenisTugas"
  ).textContent = "-";

  document.getElementById(
    "lokasiTugas"
  ).textContent = "-";

  document.getElementById(
    "penyeliaTugas"
  ).textContent = "-";

  document.getElementById(
    "pemegangSetTugas"
  ).textContent = "-";

}


// ===============================
// BINA BARIS MAKLUMAT
// ===============================

function binaBarisMaklumat(
  label,
  nilai
){

  return (

    "<div class='info-row'>" +

      "<div class='info-label'>" +
        escapeHtml(label) +
      "</div>" +

      "<div class='info-value'>" +
        escapeHtml(nilai || "-") +
      "</div>" +

    "</div>"

  );

}


// ===============================
// ENTER UNTUK LOGIN
// ===============================

document.getElementById(
  "password"
).addEventListener(
  "keydown",
  function(event){

    if(event.key === "Enter"){

      login();

    }

  }
);


// ===============================
// KESELAMATAN TEKS
// ===============================

function escapeHtml(value){

  return String(value || "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");

}
