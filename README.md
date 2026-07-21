# SKPO — Susunan Fail GitHub Pages

Pakej ini mengandungi fail yang telah dikemas kini dalam sesi migrasi semasa.
Semasa memuat naik, kekalkan fail JavaScript lain yang sudah berada dalam
repository anda.

## Struktur repository

```text
SISTEM-KEHADIRAN-PENUGASAN-OPERASI/
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
└── js/
    ├── api-config.js
    ├── supabase-client.js
    ├── index.js
    ├── walkie-petugas.js
    ├── admin.js
    ├── penyelia.js
    └── tsm.js
```

## Susunan CSS

### index.html

```html
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/index.css">
```

### admin.html

```html
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/admin.css">
```

### penyelia.html

```html
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/penyelia.css">
```

### tsm.html

```html
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/tsm.css">
```

`style.css` mesti dimuatkan dahulu. Fail khusus halaman mesti berada selepasnya.

## Susunan JavaScript

Letakkan semua JavaScript pada penghujung `<body>`.

### index.html

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/api-config.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/index.js"></script>
<script src="js/walkie-petugas.js"></script>
```

### admin.html

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/api-config.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/admin.js"></script>
```

### penyelia.html

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/api-config.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/penyelia.js"></script>
```

### tsm.html

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/api-config.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/tsm.js"></script>
```

Urutan ini penting: pustaka Supabase, konfigurasi, sambungan, kemudian kod halaman.

## Cara memuat naik

1. Ekstrak fail ZIP.
2. Buka repository GitHub.
3. Pilih **Add file → Upload files**.
4. Muat naik kandungan folder pakej, bukan folder luarnya.
5. Jangan padam `api-config.js`, `supabase-client.js`, `walkie-petugas.js`,
   `admin.js`, `penyelia.js` atau `tsm.js` yang sudah ada jika ia tidak terdapat
   dalam pakej kemas kini ini.
6. Commit perubahan dan tunggu GitHub Pages selesai membina laman.
7. Muat semula laman menggunakan `Ctrl + Shift + R`.

## Perhatian keselamatan

`api-config.js` hanya boleh mengandungi Project URL dan Publishable/Anon Key.
Jangan masukkan Secret Key, Service Role Key atau kata laluan pangkalan data.
