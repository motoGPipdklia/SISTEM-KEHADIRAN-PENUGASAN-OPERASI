let penyeliaLogin=null;
let semuaRekod=[];
let timerRefresh=null;
let rekodPertukaran=null;
let petugasGantiDipilih=null;
let modPetugasGanti='CARI';
const SELANG_REFRESH=15000;

function loginPenyeliaUI(){
  const noBadan=document.getElementById('noBadan').value.trim();
  const password=document.getElementById('password').value.trim();
  const status=document.getElementById('loginStatus');
  const btn=document.getElementById('btnLogin');
  if(!noBadan||!password){status.className='status error';status.textContent='Sila masukkan No Badan dan kata laluan.';return;}
  btn.disabled=true;status.className='status warning';status.textContent='Sedang menyemak...';
  google.script.run.withSuccessHandler(function(res){
    btn.disabled=false;
    if(res&&res.status===true){
      penyeliaLogin=res;sessionStorage.setItem('skpoPenyelia',JSON.stringify(res));
      bukaDashboard();
    }else{status.className='status error';status.textContent=(res&&res.mesej)||'Login gagal.';}
  }).withFailureHandler(function(err){btn.disabled=false;status.className='status error';status.textContent='Ralat sistem: '+err.message;}).loginPenyelia(noBadan,password);
}

function bukaDashboard(){
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('dashboardSection').classList.remove('hidden');
  document.getElementById('profile').innerHTML='<strong>'+escapeHtml(penyeliaLogin.pangkat||'')+' '+escapeHtml(penyeliaLogin.nama||'-')+'</strong><br>No Badan: '+escapeHtml(penyeliaLogin.noBadan||'-');
  muatSenarai();
  if(timerRefresh)clearInterval(timerRefresh);
  timerRefresh=setInterval(muatSenarai,SELANG_REFRESH);
}

function muatSenarai(){
  if(!penyeliaLogin)return;
  const status=document.getElementById('senaraiStatus');
  const btn=document.getElementById('btnRefresh');
  btn.disabled=true;status.className='status warning';status.textContent='Sedang mendapatkan rekod menunggu pengesahan...';
  google.script.run.withSuccessHandler(function(res){
    btn.disabled=false;
    if(res&&res.status===true){
      semuaRekod=Array.isArray(res.rekod)?res.rekod:[];
      status.className='status success';status.textContent=res.mesej||'Senarai dikemas kini.';
      paparRekod();
    }else{semuaRekod=[];status.className='status error';status.textContent=(res&&res.mesej)||'Senarai tidak dapat diperoleh.';paparRekod();}
  }).withFailureHandler(function(err){btn.disabled=false;status.className='status error';status.textContent='Ralat sistem: '+err.message;}).dapatkanSenaraiMenungguPengesahan(penyeliaLogin.noBadan);
}

function paparRekod(){
  const q=document.getElementById('carian').value.trim().toLowerCase();
  const data=semuaRekod.filter(function(r){return !q||[r.nama,r.noBadan,r.pangkat,r.jenisTugas,r.tempatTugas,r.penyelia,r.pemegangSet].join(' ').toLowerCase().includes(q);});
  document.getElementById('jumlah').textContent=data.length;
  const senarai=document.getElementById('senarai');
  if(!data.length){senarai.innerHTML='<div class="empty">Tiada rekod menunggu pengesahan.</div>';return;}
  senarai.innerHTML=data.map(function(r){return '<div class="record" id="rekod-'+escapeAttr(r.idCheckIn)+'">'+
    '<h3>'+escapeHtml((r.pangkat||'')+' '+(r.nama||'-'))+'</h3><div class="grid">'+
    baris('No Badan',r.noBadan)+baris('Tarikh',r.tarikh)+baris('Masa Check-In',r.masa)+baris('Jenis Tugas',r.jenisTugas)+baris('Tempat Tugas',r.tempatTugas)+baris('Penyelia Tugas',r.penyelia)+baris('Pemegang Set',r.pemegangSet)+baris('Ketepatan GPS',r.ketepatanGPS? r.ketepatanGPS+' m':'-')+baris('Jarak',r.jarak? r.jarak+' m':'-')+
    '</div><div class="actions"><button class="btn-ok" onclick="prosesRekod(\''+escapeJs(r.idCheckIn)+'\',\'SAHKAN\')">SAHKAN</button><button class="btn-no" onclick="prosesRekod(\''+escapeJs(r.idCheckIn)+'\',\'TOLAK\')">TOLAK</button><button class="btn-change" onclick="bukaModalTukar(\''+escapeJs(r.idCheckIn)+'\')">TUKAR PETUGAS</button></div></div>';}).join('');
}

function prosesRekod(id,tindakan){
  if(!penyeliaLogin)return;
  const teks=tindakan==='SAHKAN'?'sahkan':'tolak';
  if(!confirm('Adakah anda pasti mahu '+teks+' rekod ini?'))return;
  const kad=document.getElementById('rekod-'+id);if(kad)kad.style.opacity='.55';
  google.script.run.withSuccessHandler(function(res){
    if(res&&res.status===true){muatSenarai();}else{if(kad)kad.style.opacity='1';alert((res&&res.mesej)||'Tindakan tidak berjaya.');}
  }).withFailureHandler(function(err){if(kad)kad.style.opacity='1';alert('Ralat sistem: '+err.message);}).kemasKiniPengesahanCheckIn(id,tindakan,penyeliaLogin.noBadan);
}


function bukaModalTukar(idCheckIn){
  if(!penyeliaLogin)return;
  rekodPertukaran=semuaRekod.find(function(r){return String(r.idCheckIn)===String(idCheckIn);});
  if(!rekodPertukaran){alert('Rekod asal tidak dijumpai.');return;}
  petugasGantiDipilih=null;
  pilihModPetugas('CARI');
  document.getElementById('noBadanGanti').value='';
  ['daftarNoBadan','daftarPangkat','daftarNama','daftarPassword','daftarTelefon','daftarBahagian','daftarDaerah'].forEach(function(id){
    document.getElementById(id).value='';
  });
  document.getElementById('sebabPertukaran').value='';
  document.getElementById('catatanPertukaran').value='';
  document.getElementById('btnSimpanTukar').disabled=true;
  document.getElementById('petugasGantiPreview').classList.add('hidden');
  document.getElementById('statusPertukaran').className='';
  document.getElementById('statusPertukaran').textContent='';
  document.getElementById('petugasAsalPreview').innerHTML=
    '<strong>Petugas Asal</strong><br>'+
    escapeHtml((rekodPertukaran.pangkat||'')+' '+(rekodPertukaran.nama||'-'))+
    '<br>No Badan: '+escapeHtml(rekodPertukaran.noBadan||'-')+
    '<br>Tugas: '+escapeHtml(rekodPertukaran.jenisTugas||'-')+
    '<br>Tempat: '+escapeHtml(rekodPertukaran.tempatTugas||'-');
  document.getElementById('modalTukar').classList.remove('hidden');
  setTimeout(function(){document.getElementById('noBadanGanti').focus();},100);
}

function tutupModalTukar(){
  document.getElementById('modalTukar').classList.add('hidden');
  rekodPertukaran=null;
  petugasGantiDipilih=null;
}


function pilihModPetugas(mod){
  modPetugasGanti=mod;
  petugasGantiDipilih=null;
  document.getElementById('modCari').classList.toggle('hidden',mod!=='CARI');
  document.getElementById('modDaftar').classList.toggle('hidden',mod!=='DAFTAR');
  document.getElementById('tabCari').classList.toggle('active',mod==='CARI');
  document.getElementById('tabDaftar').classList.toggle('active',mod==='DAFTAR');
  document.getElementById('petugasGantiPreview').classList.add('hidden');
  document.getElementById('statusPertukaran').className='';
  document.getElementById('statusPertukaran').textContent='';
  document.getElementById('btnSimpanTukar').disabled=(mod==='CARI');
  document.getElementById('btnSimpanTukar').textContent=
    mod==='DAFTAR' ? 'DAFTAR DAN GANTIKAN' : 'SIMPAN PERTUKARAN';
}

function cariGanti(){
  if(!rekodPertukaran||!penyeliaLogin)return;
  const no=document.getElementById('noBadanGanti').value.trim();
  const status=document.getElementById('statusPertukaran');
  const btn=document.getElementById('btnCariGanti');
  if(!no){status.className='status error';status.textContent='Sila masukkan No Badan petugas ganti.';return;}
  btn.disabled=true;
  status.className='status warning';
  status.textContent='Sedang menyemak petugas ganti...';
  petugasGantiDipilih=null;
  document.getElementById('btnSimpanTukar').disabled=true;
  document.getElementById('petugasGantiPreview').classList.add('hidden');
  google.script.run.withSuccessHandler(function(res){
    btn.disabled=false;
    if(res&&res.status===true){
      petugasGantiDipilih=res.petugas;
      const p=document.getElementById('petugasGantiPreview');
      p.innerHTML='<strong>Petugas Ganti</strong><br>'+
        escapeHtml((res.petugas.pangkat||'')+' '+(res.petugas.nama||'-'))+
        '<br>No Badan: '+escapeHtml(res.petugas.noBadan||'-');
      p.classList.remove('hidden');
      status.className='status success';
      status.textContent=res.mesej||'Petugas ganti boleh digunakan.';
      document.getElementById('btnSimpanTukar').disabled=false;
    }else{
      status.className='status error';
      status.textContent=(res&&res.mesej)||'Petugas ganti tidak boleh digunakan.';
    }
  }).withFailureHandler(function(err){
    btn.disabled=false;
    status.className='status error';
    status.textContent='Ralat sistem: '+err.message;
  }).cariPetugasGanti(no,rekodPertukaran.idCheckIn,penyeliaLogin.noBadan);
}

function simpanPertukaran(){
  if(!rekodPertukaran||!penyeliaLogin)return;

  const sebab=document.getElementById('sebabPertukaran').value;
  const catatan=document.getElementById('catatanPertukaran').value.trim();
  const status=document.getElementById('statusPertukaran');
  const btn=document.getElementById('btnSimpanTukar');

  if(!sebab){
    status.className='status error';
    status.textContent='Sila pilih sebab pertukaran.';
    return;
  }

  if(modPetugasGanti==='CARI'){
    if(!petugasGantiDipilih)return;

    if(!confirm('Sahkan pertukaran '+rekodPertukaran.noBadan+' kepada '+petugasGantiDipilih.noBadan+'?'))return;

    btn.disabled=true;
    status.className='status warning';
    status.textContent='Sedang menyimpan pertukaran...';

    google.script.run.withSuccessHandler(function(res){
      if(res&&res.status===true){
        status.className='status success';
        status.textContent=res.mesej||'Pertukaran berjaya.';
        setTimeout(function(){tutupModalTukar();muatSenarai();},1000);
      }else{
        btn.disabled=false;
        status.className='status error';
        status.textContent=(res&&res.mesej)||'Pertukaran tidak berjaya.';
      }
    }).withFailureHandler(function(err){
      btn.disabled=false;
      status.className='status error';
      status.textContent='Ralat sistem: '+err.message;
    }).tukarPetugasOlehPenyelia(
      rekodPertukaran.idCheckIn,
      petugasGantiDipilih.noBadan,
      sebab,
      catatan,
      penyeliaLogin.noBadan
    );

    return;
  }

  const dataBaharu={
    noBadan:document.getElementById('daftarNoBadan').value.trim(),
    pangkat:document.getElementById('daftarPangkat').value.trim(),
    nama:document.getElementById('daftarNama').value.trim(),
    password:document.getElementById('daftarPassword').value.trim(),
    telefon:document.getElementById('daftarTelefon').value.trim(),
    bahagian:document.getElementById('daftarBahagian').value.trim(),
    daerah:document.getElementById('daftarDaerah').value.trim()
  };

  if(!dataBaharu.noBadan||!dataBaharu.pangkat||!dataBaharu.nama||!dataBaharu.password){
    status.className='status error';
    status.textContent='No Badan, pangkat, nama dan kata laluan wajib diisi.';
    return;
  }

  if(!confirm(
    'Daftar '+dataBaharu.noBadan+' sebagai petugas baharu dan gantikan '+rekodPertukaran.noBadan+'?'
  ))return;

  btn.disabled=true;
  status.className='status warning';
  status.textContent='Sedang mendaftar dan menggantikan petugas...';

  google.script.run.withSuccessHandler(function(res){
    if(res&&res.status===true){
      status.className='status success';
      status.textContent=res.mesej||'Petugas baharu berjaya didaftarkan.';
      setTimeout(function(){tutupModalTukar();muatSenarai();},1200);
    }else{
      btn.disabled=false;
      status.className='status error';
      status.textContent=(res&&res.mesej)||'Pendaftaran tidak berjaya.';
    }
  }).withFailureHandler(function(err){
    btn.disabled=false;
    status.className='status error';
    status.textContent='Ralat sistem: '+err.message;
  }).daftarDanTukarPetugasOlehPenyelia(
    rekodPertukaran.idCheckIn,
    dataBaharu,
    sebab,
    catatan,
    penyeliaLogin.noBadan
  );
}

document.getElementById('noBadanGanti').addEventListener('input',function(){
  petugasGantiDipilih=null;
  document.getElementById('btnSimpanTukar').disabled=true;
  document.getElementById('petugasGantiPreview').classList.add('hidden');
});
document.getElementById('modalTukar').addEventListener('click',function(e){
  if(e.target===this)tutupModalTukar();
});

function logoutPenyelia(){
  if(timerRefresh)clearInterval(timerRefresh);timerRefresh=null;sessionStorage.removeItem('skpoPenyelia');penyeliaLogin=null;semuaRekod=[];
  document.getElementById('dashboardSection').classList.add('hidden');document.getElementById('loginSection').classList.remove('hidden');document.getElementById('password').value='';document.getElementById('loginStatus').className='';document.getElementById('loginStatus').textContent='';
}
function baris(label,nilai){return '<div class="label">'+escapeHtml(label)+':</div><div>'+escapeHtml(nilai||'-')+'</div>';}
function escapeHtml(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function escapeAttr(v){return String(v||'').replace(/[^A-Za-z0-9_-]/g,'_');}
function escapeJs(v){return String(v||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
document.getElementById('password').addEventListener('keydown',function(e){if(e.key==='Enter')loginPenyeliaUI();});
(function pulihSesi(){try{const simpan=sessionStorage.getItem('skpoPenyelia');if(simpan){penyeliaLogin=JSON.parse(simpan);if(penyeliaLogin&&penyeliaLogin.noBadan)bukaDashboard();}}catch(e){sessionStorage.removeItem('skpoPenyelia');}})();
