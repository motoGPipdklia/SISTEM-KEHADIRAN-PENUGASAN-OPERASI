# SKPO — GitHub Pages Migration

Pakej ini telah memisahkan kod asal kepada struktur berikut:

```text
SKPO_GitHub_Pages_Migrasi/
├── index.html
├── admin.html
├── penyelia.html
├── tsm.html
├── css/
│   ├── style.css
│   ├── index.css
│   ├── admin.css
│   ├── penyelia.css
│   └── tsm.css
├── js/
│   ├── api-config.js
│   ├── index.js
│   ├── admin.js
│   ├── penyelia.js
│   └── tsm.js
├── assets/images/
├── .nojekyll
└── .gitignore
```

## Yang telah dimigrasikan

- CSS dalaman `<style>` dipindahkan ke `css/[halaman].css`.
- JavaScript dalaman `<script>` dipindahkan ke `js/[halaman].js`.
- Pautan Apps Script `<?= webAppUrl ?>` ditukar kepada pautan relatif GitHub Pages.
- Semua fail HTML memanggil CSS dan JavaScript luaran.
- Struktur folder sesuai untuk GitHub Pages.

## Penting: backend belum dimigrasikan

GitHub Pages tidak boleh menjalankan `Code.gs` atau `google.script.run`.

Oleh itu, paparan laman boleh dibuka tetapi fungsi berikut belum berfungsi sehingga
backend Supabase/REST API disambungkan:

- Login
- Dapatkan tugasan
- Check-In dan Check-Out
- Pengesahan Urusetia/Penyelia
- Pelaporan
- Pentadbir
- TSM dan Walkie-Talkie

Konfigurasi backend akan diletakkan dalam:

```text
js/api-config.js
```

Langkah seterusnya ialah membina database Supabase dan menggantikan setiap
`google.script.run` dengan panggilan API.

## Cara muat naik ke GitHub

1. Backup repository sedia ada.
2. Muat naik semua kandungan folder ini ke root repository.
3. Pastikan GitHub Pages menggunakan `main` dan `/(root)`.
4. Commit perubahan.
5. Tunggu deployment siap.
6. Buka laman dengan Ctrl + Shift + R.

## Ringkasan fail

```json
{
  "index": {
    "source": "index_Pelaporan_Login_Dibetulkan.html",
    "css_lines": 248,
    "js_lines": 3101,
    "html_lines": 265
  },
  "admin": {
    "source": "admin_Modul_Walkie_Talkie_Dikemaskini.html",
    "css_lines": 375,
    "js_lines": 1114,
    "html_lines": 183
  },
  "penyelia": {
    "source": "penyelia(5).html",
    "css_lines": 1,
    "js_lines": 268,
    "html_lines": 109
  },
  "tsm": {
    "source": "tsm.html",
    "css_lines": 350,
    "js_lines": 905,
    "html_lines": 184
  }
}
```
