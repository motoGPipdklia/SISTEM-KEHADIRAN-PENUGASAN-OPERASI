let tsm = null;
    let dataSemua = [];
    let rekodDipilih = null;


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
        document.getElementById("noBadan")
          .value.trim();

      const kataLaluan =
        document.getElementById("password")
          .value.trim();

      const statusLogin =
        document.getElementById("loginStatus");

      const btn =
        document.getElementById("btnLogin");

      if(!no || !kataLaluan){

        statusLogin.innerHTML =
          '<span class="error">Sila lengkapkan maklumat login.</span>';

        return;

      }

      btn.disabled = true;

      statusLogin.innerHTML =
        '<span class="warning">Sedang menyemak...</span>';

      google.script.run

        .withSuccessHandler(function(res){

          btn.disabled = false;

          if(res && res.status === true){

            tsm = res;

            localStorage.setItem(
              "skpoTSM",
              JSON.stringify(res)
            );

            bukaDashboard();

          }else{

            statusLogin.innerHTML =
              '<span class="error">' +
              esc(
                res && res.mesej
                  ? res.mesej
                  : "Login TSM gagal."
              ) +
              '</span>';

          }

        })

        .withFailureHandler(function(error){

          btn.disabled = false;

          statusLogin.innerHTML =
            '<span class="error">' +
            esc(error.message) +
            '</span>';

        })

        .loginTSM(
          no,
          kataLaluan
        );

    }


    function bukaDashboard(){

      document.getElementById(
        "loginPage"
      ).style.display = "none";

      document.getElementById(
        "dashboard"
      ).style.display = "block";

      document.getElementById(
        "tsmName"
      ).textContent =
        [
          tsm.pangkat || "",
          tsm.nama || "",
          "(" + (tsm.noBadan || "") + ")"
        ]
          .filter(Boolean)
          .join(" ");

      muatData();

    }


    function muatData(){

      const status =
        document.getElementById("status");

      status.innerHTML =
        '<span class="warning">Sedang memuatkan data...</span>';

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
            Array.isArray(res.rekod)
              ? res.rekod
              : [];

          papar();

          status.innerHTML =
            '<span class="success">Data berjaya dikemas kini.</span>';

        })

        .withFailureHandler(function(error){

          status.innerHTML =
            '<span class="error">' +
            esc(error.message) +
            '</span>';

        })

        .dapatkanSenaraiPendaftaranSetTSM(
          tsm.noBadan
        );

    }


    function dataDitapis(){

      const statusNilai =
        document.getElementById("statusPenapis")
          .value.trim().toUpperCase();

      const tarikhNilai =
        document.getElementById("tarikhPenapis")
          .value.trim();

      const carianNilai =
        document.getElementById("carian")
          .value.trim().toUpperCase();

      return dataSemua.filter(function(r){

        if(
          statusNilai &&
          String(r.statusSet || "")
            .toUpperCase() !== statusNilai
        ){
          return false;
        }

        if(
          tarikhNilai &&
          String(r.tarikh || "")
            .slice(0,10) !== tarikhNilai
        ){
          return false;
        }

        if(carianNilai){

          const gabungan = [
            r.noBadan,
            r.pangkat,
            r.nama,
            r.callSign,
            r.jenisTugas,
            r.tempatTugas,
            r.noSiriSet,
            r.noSiriBateri,
            r.noSiriCharger,
            r.statusSet
          ]
            .join(" ")
            .toUpperCase();

          if(!gabungan.includes(carianNilai)){
            return false;
          }

        }

        return true;

      });

    }


    function papar(){

      const senarai =
        dataDitapis();

      kemasKiniStatistik(senarai);

      document.getElementById("tbody").innerHTML =
        senarai.length
          ? senarai.map(function(r,index){

              return (
                "<tr>" +

                  "<td>" +
                  (index + 1) +
                  "</td>" +

                  "<td>" +
                  esc(r.tarikh || "-") +
                  "<br>" +
                  esc(r.masaPermohonan || "-") +
                  "</td>" +

                  "<td>" +
                  esc(r.noBadan || "-") +
                  "</td>" +

                  "<td>" +
                  esc(
                    ((r.pangkat || "") + " " + (r.nama || "")).trim() || "-"
                  ) +
                  "</td>" +

                  "<td>" +
                  esc(r.callSign || "-") +
                  "</td>" +

                  "<td>" +
                  esc(r.jenisTugas || "-") +
                  "<br>" +
                  esc(r.tempatTugas || "-") +
                  "</td>" +

                  "<td>" +
                  esc(r.noSiriSet || "-") +
                  "</td>" +

                  "<td>" +
                  "Bateri: " + esc(r.noSiriBateri || "-") +
                  "<br>Charger: " + esc(r.noSiriCharger || "-") +
                  "</td>" +

                  "<td>" +
                  esc(r.aksesori || "-") +
                  "</td>" +

                  "<td>" +
                  esc(r.catatanPetugas || "-") +
                  "</td>" +

                  "<td>" +
                  badgeStatus(r.statusSet) +
                  "</td>" +

                  "<td>" +
                  binaMaklumatProses(r) +
                  "</td>" +

                  "<td>" +
                  binaButangTindakan(r) +
                  "</td>" +

                "</tr>"
              );

            }).join("")
          : '<tr><td colspan="13" style="text-align:center;padding:30px">Tiada rekod mengikut penapis dipilih.</td></tr>';

    }


    function kemasKiniStatistik(senarai){

      jumlahSemua.textContent =
        senarai.length;

      jumlahMenunggu.textContent =
        senarai.filter(function(r){
          return String(r.statusSet || "").toUpperCase() ===
            "MENUNGGU PENGESAHAN TSM";
        }).length;

      jumlahDilepaskan.textContent =
        senarai.filter(function(r){
          return String(r.statusSet || "").toUpperCase() ===
            "SET DILEPASKAN";
        }).length;

      jumlahMenungguPulang.textContent =
        senarai.filter(function(r){
          return String(r.statusSet || "").toUpperCase() ===
            "MENUNGGU PENGESAHAN PEMULANGAN";
        }).length;

      jumlahDipulangkan.textContent =
        senarai.filter(function(r){
          return String(r.statusSet || "").toUpperCase() ===
            "SET TELAH DIPULANGKAN";
        }).length;

    }


    function badgeStatus(nilai){

      const status =
        String(nilai || "").toUpperCase();

      if(status === "SET DILEPASKAN"){
        return '<span class="badge badge-green">SET DILEPASKAN</span>';
      }

      if(status === "SET TELAH DIPULANGKAN"){
        return '<span class="badge badge-blue">SET TELAH DIPULANGKAN</span>';
      }

      if(status === "PERMOHONAN DITOLAK"){
        return '<span class="badge badge-red">PERMOHONAN DITOLAK</span>';
      }

      if(
        status === "MENUNGGU PENGESAHAN TSM" ||
        status === "MENUNGGU PENGESAHAN PEMULANGAN"
      ){
        return '<span class="badge badge-yellow">' +
          esc(status) +
          '</span>';
      }

      return '<span class="badge badge-gray">' +
        esc(status || "-") +
        '</span>';

    }


    function binaMaklumatProses(r){

      let html = "";

      if(r.masaPelepasan){
        html +=
          "Pelepasan: " +
          esc(r.masaPelepasan);
      }

      if(r.disahkanOleh){
        html +=
          "<br>Disahkan: " +
          esc(r.disahkanOleh);
      }

      if(r.sebabDitolak){
        html +=
          "<br>Sebab: " +
          esc(r.sebabDitolak);
      }

      if(r.masaPermohonanPemulangan){
        html +=
          "<br>Mohon Pulang: " +
          esc(r.masaPermohonanPemulangan);
      }

      if(r.masaPemulangan){
        html +=
          "<br>Pemulangan: " +
          esc(r.masaPemulangan);
      }

      if(r.diterimaOleh){
        html +=
          "<br>Diterima: " +
          esc(r.diterimaOleh);
      }

      if(r.keadaanSet){
        html +=
          "<br>Keadaan: " +
          esc(r.keadaanSet);
      }

      if(r.kerosakan){
        html +=
          "<br>Kerosakan: " +
          esc(r.kerosakan);
      }

      return html || "-";

    }


    function binaButangTindakan(r){

      const status =
        String(r.statusSet || "").toUpperCase();

      if(status === "MENUNGGU PENGESAHAN TSM"){

        return (
          '<button class="small-button green" onclick="sahkanPelepasan(\'' +
          esc(r.idPendaftaran) +
          '\')">SAHKAN & LEPASKAN</button>' +

          '<button class="small-button red" onclick="bukaModalTolak(\'' +
          esc(r.idPendaftaran) +
          '\')">TOLAK</button>'
        );

      }

      if(status === "MENUNGGU PENGESAHAN PEMULANGAN"){

        return (
          '<button class="small-button blue" onclick="bukaModalPemulangan(\'' +
          esc(r.idPendaftaran) +
          '\')">SAHKAN PEMULANGAN</button>'
        );

      }

      return '<span class="badge badge-gray">TELAH DIPROSES</span>';

    }


    function cariRekod(id){

      return dataSemua.find(function(r){
        return String(r.idPendaftaran || "") === String(id || "");
      }) || null;

    }


    function sahkanPelepasan(id){

      const rekod =
        cariRekod(id);

      if(!rekod){
        alert("Rekod pendaftaran tidak dijumpai.");
        return;
      }

      const pasti = confirm(
        "Adakah anda pasti mahu mengesahkan dan melepaskan set " +
        (rekod.noSiriSet || "") +
        " kepada " +
        (rekod.nama || "") +
        "?"
      );

      if(!pasti){
        return;
      }

      status.innerHTML =
        '<span class="warning">Sedang mengesahkan pelepasan set...</span>';

      google.script.run

        .withSuccessHandler(function(res){

          if(res && res.status === true){

            status.innerHTML =
              '<span class="success">' +
              esc(res.mesej || "Set berjaya dilepaskan.") +
              '</span>';

            muatData();

          }else{

            status.innerHTML =
              '<span class="error">' +
              esc(
                res && res.mesej
                  ? res.mesej
                  : "Pengesahan set tidak berjaya."
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

        .kemasKiniPelepasanSet(
          id,
          "SAHKAN",
          tsm.noBadan,
          ""
        );

    }


    function bukaModalTolak(id){

      rekodDipilih =
        cariRekod(id);

      if(!rekodDipilih){
        return;
      }

      maklumatTolak.innerHTML =
        binaBaris("No Badan:",rekodDipilih.noBadan) +
        binaBaris("Nama:",rekodDipilih.nama) +
        binaBaris("Call Sign:",rekodDipilih.callSign) +
        binaBaris("No Siri Set:",rekodDipilih.noSiriSet);

      sebabDitolak.value = "";
      statusModalTolak.innerHTML = "";

      modalTolak.style.display =
        "block";

    }


    function tutupModalTolak(){

      modalTolak.style.display =
        "none";

      rekodDipilih = null;

    }


    function hantarTolak(){

      if(!rekodDipilih){
        return;
      }

      const sebab =
        sebabDitolak.value.trim();

      if(!sebab){

        statusModalTolak.innerHTML =
          '<span class="error">Sila nyatakan sebab permohonan ditolak.</span>';

        return;

      }

      btnSahkanTolak.disabled = true;

      statusModalTolak.innerHTML =
        '<span class="warning">Sedang memproses...</span>';

      google.script.run

        .withSuccessHandler(function(res){

          btnSahkanTolak.disabled = false;

          if(res && res.status === true){

            tutupModalTolak();
            muatData();

          }else{

            statusModalTolak.innerHTML =
              '<span class="error">' +
              esc(
                res && res.mesej
                  ? res.mesej
                  : "Permohonan tidak berjaya ditolak."
              ) +
              '</span>';

          }

        })

        .withFailureHandler(function(error){

          btnSahkanTolak.disabled = false;

          statusModalTolak.innerHTML =
            '<span class="error">' +
            esc(error.message) +
            '</span>';

        })

        .kemasKiniPelepasanSet(
          rekodDipilih.idPendaftaran,
          "TOLAK",
          tsm.noBadan,
          sebab
        );

    }


    function bukaModalPemulangan(id){

      rekodDipilih =
        cariRekod(id);

      if(!rekodDipilih){
        return;
      }

      maklumatPemulangan.innerHTML =
        binaBaris("No Badan:",rekodDipilih.noBadan) +
        binaBaris("Nama:",rekodDipilih.nama) +
        binaBaris("Call Sign:",rekodDipilih.callSign) +
        binaBaris("No Siri Set:",rekodDipilih.noSiriSet) +
        binaBaris("Aksesori:",rekodDipilih.aksesori);

      keadaanSet.value = "";
      kerosakan.value = "";
      catatanTSM.value = "";
      statusModalPemulangan.innerHTML = "";

      modalPemulangan.style.display =
        "block";

    }


    function tutupModalPemulangan(){

      modalPemulangan.style.display =
        "none";

      rekodDipilih = null;

    }


    function hantarPengesahanPemulangan(){

      if(!rekodDipilih){
        return;
      }

      const keadaan =
        keadaanSet.value.trim();

      const kerosakanNilai =
        kerosakan.value.trim();

      const catatan =
        catatanTSM.value.trim();

      if(!keadaan){

        statusModalPemulangan.innerHTML =
          '<span class="error">Sila pilih keadaan set.</span>';

        return;

      }

      if(!kerosakanNilai){

        statusModalPemulangan.innerHTML =
          '<span class="error">Sila isi ruangan kerosakan. Jika tiada, masukkan TIADA.</span>';

        return;

      }

      if(!catatan){

        statusModalPemulangan.innerHTML =
          '<span class="error">Sila isi catatan TSM. Jika tiada, masukkan TIADA.</span>';

        return;

      }

      const pasti = confirm(
        "Adakah anda pasti mahu mengesahkan pemulangan set ini?"
      );

      if(!pasti){
        return;
      }

      btnSahkanPemulangan.disabled = true;

      statusModalPemulangan.innerHTML =
        '<span class="warning">Sedang mengesahkan pemulangan...</span>';

      google.script.run

        .withSuccessHandler(function(res){

          btnSahkanPemulangan.disabled = false;

          if(res && res.status === true){

            tutupModalPemulangan();
            muatData();

          }else{

            statusModalPemulangan.innerHTML =
              '<span class="error">' +
              esc(
                res && res.mesej
                  ? res.mesej
                  : "Pengesahan pemulangan tidak berjaya."
              ) +
              '</span>';

          }

        })

        .withFailureHandler(function(error){

          btnSahkanPemulangan.disabled = false;

          statusModalPemulangan.innerHTML =
            '<span class="error">' +
            esc(error.message) +
            '</span>';

        })

        .sahkanPemulanganSet(
          {
            idPendaftaran:
              rekodDipilih.idPendaftaran,

            keadaanSet:
              keadaan,

            kerosakan:
              kerosakanNilai,

            catatanTSM:
              catatan
          },
          tsm.noBadan
        );

    }


    function binaBaris(label,nilai){

      return (
        '<div class="info-row">' +
          '<div class="info-label">' +
            esc(label) +
          '</div>' +
          '<div>' +
            esc(nilai || "-") +
          '</div>' +
        '</div>'
      );

    }


    function kosongkanPenapis(){

      statusPenapis.value = "";
      tarikhPenapis.value = "";
      carian.value = "";

      papar();

    }


    function logout(){

      localStorage.removeItem(
        "skpoTSM"
      );

      tsm = null;
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
                "skpoTSM"
              ) || "null"
            );

          if(
            simpanan &&
            simpanan.noBadan
          ){

            tsm = simpanan;
            bukaDashboard();

          }

        }catch(error){

          localStorage.removeItem(
            "skpoTSM"
          );

        }

      }
    );
