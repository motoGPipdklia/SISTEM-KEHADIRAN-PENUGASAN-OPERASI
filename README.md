# SKPO V2 — GitHub Pages + Supabase

Pakej ini mengandungi frontend dan kod Supabase lengkap untuk:

- Petugas: login, tugasan, GPS, Check-In, Check-Out dan pelaporan.
- Permohonan Walkie-Talkie oleh Pemegang Set.
- Urusetia: pengesahan atau penolakan kehadiran.
- Pentadbir: dashboard, statistik, daftar pengguna dan reset Device ID.
- TSM: pelepasan, penolakan dan pemulangan set.

## Struktur fail

```text
SKPO_LENGKAP/
├── index.html
├── admin.html
├── penyelia.html
├── tsm.html
├── .nojekyll
├── css/
│   ├── style.css
│   ├── index.css
│   ├── admin.css
│   ├── penyelia.css
│   └── tsm.css
├── js/
│   ├── api-config.js
│   ├── supabase-client.js
│   ├── index.js
│   ├── walkie-petugas.js
│   ├── admin.js
│   ├── penyelia.js
│   └── tsm.js
└── supabase/
    ├── sql/
    │   ├── 01_schema_skpo.sql
    │   └── 02_rls_rpc_skpo.sql
    └── functions/
        └── tambah-petugas/
            └── index.ts
```

## 1. Masukkan Publishable Key

Buka `js/api-config.js` dan gantikan:

```text
MASUKKAN_PUBLISHABLE_KEY_ANDA_DI_SINI
```

dengan Publishable Key projek Supabase.

Jangan gunakan Secret Key, Service Role Key atau kata laluan database.

## 2. Sediakan pangkalan data

Dalam Supabase, buka **SQL Editor** dan jalankan mengikut urutan:

1. `supabase/sql/01_schema_skpo.sql`
2. `supabase/sql/02_rls_rpc_skpo.sql`

Jika jadual lama mempunyai struktur berbeza, buat backup sebelum menjalankan SQL.

## 3. Cipta akaun Pentadbir pertama

Dalam Supabase Authentication, cipta pengguna dengan email dalaman:

```text
197898@skpo.local
```

Kemudian salin UUID pengguna tersebut dan jalankan:

```sql
insert into public.profiles (
  id,
  no_badan,
  pangkat,
  nama,
  peranan,
  aktif
) values (
  'UUID_PENGGUNA_DARI_AUTH',
  '197898',
  'PANGKAT',
  'NAMA PENTADBIR',
  'PENTADBIR',
  true
)
on conflict (id) do update set
  peranan = 'PENTADBIR',
  aktif = true;
```

## 4. Deploy Edge Function

Deploy fungsi berikut sebagai `tambah-petugas`:

```text
supabase/functions/tambah-petugas/index.ts
```

Fungsi ini diperlukan supaya Pentadbir boleh mencipta akaun pengguna baharu
tanpa mendedahkan Service Role Key dalam GitHub Pages.

## 5. Muat naik ke GitHub

Muat naik semua kandungan folder pakej ke bahagian utama repository. Pastikan
folder `css`, `js` dan `supabase` turut dimuat naik.

Aktifkan GitHub Pages menggunakan:

```text
Branch: main
Folder: /(root)
```

Selepas deployment selesai, tekan `Ctrl + Shift + R`.

## Akaun dan email dalaman

Semua pengguna login menggunakan No Badan, tetapi sistem menukarkannya secara
dalaman kepada email Supabase:

```text
NO BADAN: 197898
EMAIL AUTH: 197898@skpo.local
```

Jangan masukkan kata laluan ke dalam jadual `profiles`. Kata laluan hanya
diuruskan oleh Supabase Authentication.

## Peranan yang disokong

```text
PETUGAS
PENYELIA
URUSETIA
PENTADBIR
TSM
```

## Catatan keselamatan

- GPS dan radius disemak semula oleh RPC Supabase.
- Pelaporan hanya boleh dibuat selepas status `HADIR` dan sebelum Check-Out.
- Pelaporan hanya untuk Penyelia atau Pemegang Set.
- TSM sahaja boleh melepaskan atau mengesahkan pemulangan set.
- Pentadbir sahaja boleh mendaftarkan pengguna dan reset Device ID.
- RLS mesti kekal aktif.
