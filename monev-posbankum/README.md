# Form Monev Posbankum Desa/Kelurahan

Aplikasi web (Google Apps Script) untuk mengisi **Form Monev Pos Bantuan Hukum Desa/Kelurahan**.
Desa/kelurahan mengisi form dari HP atau komputer. Setiap form yang dikirim:

1. menjadi **PDF** yang tata letaknya sama dengan template Word (A4, Arial, header biru),
   dari identitas sampai *Permasalahan Yang Terjadi di Desa/Kelurahan*, lalu blok tanda tangan,
2. tersimpan otomatis di **Google Drive akun yang memasang aplikasi** (doranbhp@gmail.com),
3. tanda tangan pengisi (digores dengan jari di HP) otomatis ditempatkan rapi di blok tanda tangan PDF:
   "<tempat>, <tanggal> / Pemeriksa Layanan / tanda tangan / (nama) / jabatan",
4. foto dokumentasi (opsional) dan gambar tanda tangan tersimpan di subfolder `Dokumentasi`,
5. tercatat satu baris di spreadsheet rekap.

Setelah mengirim, pengisi bisa langsung **Unduh PDF** atau **Cetak**.

## Struktur folder di Drive

```
Form (Web)/   ← folder induk (ROOT_FOLDER_ID), milik doranbhp@gmail.com
├── 00. REKAP/
│   └── Rekap Monev Posbankum            (Google Sheets, 1 baris per pengisian)
├── Kabupaten Deli Serdang/
│   └── Kec. Percut Sei Tuan/
│       └── Desa Bandar Klippa/
│           ├── Form Monev Posbankum - Desa Bandar Klippa - Kec. Percut Sei Tuan - 2026-11-16.pdf
│           └── Dokumentasi/
│               ├── Form Monev Posbankum - ... - Foto 1.jpg
│               └── Form Monev Posbankum - ... - Tanda Tangan.png
└── Kota Medan/ ...
```

Kalau desa yang sama mengirim lagi di tanggal yang sama, berkas lama tidak ditimpa: berkas baru diberi jam di belakang namanya.
Folder induk sudah diatur ke folder **Form (Web)** (`ROOT_FOLDER_ID`). Kosongkan `ROOT_FOLDER_ID` jika ingin dibuatkan folder baru bernama `ROOT_FOLDER_NAME`.

## Cara pasang (sekali saja, dari akun doranbhp@gmail.com)

1. Masuk ke https://script.google.com dengan akun **doranbhp@gmail.com**, lalu klik **New project**.
   Beri nama proyek, misalnya `Form Monev Posbankum`.
2. Pada berkas `Code.gs`, hapus isinya, lalu tempel seluruh isi `Code.gs` dari folder ini.
3. Klik **+** di samping *Files*, pilih **HTML**, beri nama **`Index`** (tanpa `.html`), lalu tempel seluruh isi `Index.html`.
4. (Opsional) **Project Settings**, centang *Show "appsscript.json" manifest file in editor*, lalu ganti isinya dengan `appsscript.json` dari folder ini.
5. Pilih fungsi **`setup`** di toolbar, klik **Run**, lalu setujui izin (Drive dan Sheets).
   Folder induk dan spreadsheet rekap akan dibuat di Drive.
   Jika muncul layar "Google hasn’t verified this app": klik *Advanced*, lalu *Go to … (unsafe)*. Ini wajar untuk skrip buatan sendiri.
6. Klik **Deploy**, lalu **New deployment**, ikon roda gigi, dan pilih **Web app**:
   - *Execute as*: **Me (doranbhp@gmail.com)**
   - *Who has access*: **Anyone**
7. Klik **Deploy** dan salin **Web app URL** (berakhiran `/exec`). Link inilah yang dibagikan ke desa/kelurahan.
   Bisa dipendekkan dengan bit.ly atau dibuat QR code.

Pengisi **tidak perlu login Google**. Semua berkas tersimpan atas nama doranbhp@gmail.com.

### Mengubah aplikasi setelah dipasang

Edit kodenya, lalu **Deploy**, **Manage deployments**, ikon pensil, *Version: New version*, dan **Deploy**.
URL tetap sama.

## Pengaturan (`CONFIG` di `Code.gs`)

| Kunci | Fungsi |
|---|---|
| `ROOT_FOLDER_NAME` | Nama folder induk di Drive |
| `ROOT_FOLDER_ID` | Pakai folder yang sudah ada (ID dari URL folder) |
| `SPREADSHEET_NAME` | Nama spreadsheet rekap |
| `INSTANSI`, `UNIT` | Teks instansi di tampilan aplikasi |
| `REQUIRE_TTD` | `true` = tanda tangan wajib sebelum kirim |
| `TTD_LABEL` | Tulisan di atas tanda tangan pada PDF (default `Pemeriksa Layanan`, sesuai template) |
| `DOC_KOP` | `true` = PDF diberi kop instansi di atas judul (template asli tanpa kop) |
| `LOGO_FILE_ID` / `LOGO_URL` | Logo di aplikasi & kop PDF (opsional) |
| `MAX_PHOTOS` | Maksimal foto dokumentasi per pengisian |

Daftar kabupaten/kota, sarana-prasarana, dan jenis pelaporan ada di `FORM_SCHEMA`.
Kalau ditambah atau diubah, PDF, pratinjau, dan kolom rekap ikut menyesuaikan.
Jika kolom rekap berubah, ganti nama atau hapus spreadsheet lama agar header baru dibuat.

## Isi form

- **Identitas**: Provinsi (Sumatera Utara), Kabupaten/Kota (33 pilihan), Kecamatan, Desa/Kelurahan, Kepala Desa/Lurah, tanggal monev.
- **Pengisi form**: nama dan jabatan (tercetak di bawah tanda tangan), No. HP (hanya untuk rekap), tempat penandatanganan (otomatis terisi nama desa/kelurahan, bisa diubah).
- **Sarana dan Prasarana** (14 fasilitas) dan **Pelaporan Layanan** (4 layanan): pilih *Ada* atau *Tidak Ada*. Kolom *Jumlah* aktif bila *Ada*. Di PDF tercetak tanda √ di kolom yang dipilih.
- **Kendala Posbankum** dan **Permasalahan di Desa/Kelurahan**: daftar poin, minimal 3 baris tercetak seperti template.
- **Tanda tangan**: bantalan layar penuh untuk jari. Ada tombol urungkan/hapus, layar tidak ikut bergeser saat menggores, coretan tidak hilang saat HP diputar, dan hasilnya dipotong rapat ke goresan supaya posisinya rapi di dokumen.
- **Foto dokumentasi** (opsional): disimpan di Drive, tidak masuk PDF.

Isian tersimpan otomatis di perangkat pengisi, jadi tidak hilang kalau halaman tertutup sebelum dikirim.
