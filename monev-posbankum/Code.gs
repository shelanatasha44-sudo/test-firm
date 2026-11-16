/**
 * FORM MONEV POS BANTUAN HUKUM (POSBANKUM) DESA/KELURAHAN
 * Web app Google Apps Script. Setiap pengisian:
 *   1. membuat PDF yang tata letaknya sama dengan form cetak,
 *   2. menyimpannya ke Google Drive akun pemasang (doranbhp@gmail.com) dalam folder rapi
 *      <Folder Induk>/<Kabupaten/Kota>/<Kec. ...>/<Desa/Kelurahan ...>/,
 *   3. menyimpan foto dokumentasi di subfolder "Dokumentasi" (tidak masuk ke PDF),
 *   4. mencatat satu baris ke spreadsheet rekap.
 * Cara pasang: lihat README.md di folder ini.
 */

// ====== PENGATURAN (boleh diubah) ======
var CONFIG = {
  // Nama folder induk di Google Drive. Dibuat otomatis jika belum ada.
  ROOT_FOLDER_NAME: 'MONEV POSBANKUM DESA-KELURAHAN SUMUT',
  // Isi ID folder jika ingin memakai folder yang sudah ada (opsional; ID ada di URL folder Drive).
  ROOT_FOLDER_ID: '',
  REKAP_FOLDER_NAME: '00. REKAP',
  SPREADSHEET_NAME: 'Rekap Monev Posbankum',
  DOC_SUBFOLDER: 'Dokumentasi',

  INSTANSI: 'KEMENTERIAN HUKUM REPUBLIK INDONESIA',   // tampil di aplikasi
  DOC_KOP: false, // true = PDF diberi kop instansi di atas judul (template asli tanpa kop)
  UNIT: 'KANTOR WILAYAH SUMATERA UTARA',
  ALAMAT: '', // baris alamat kop (opsional)
  PROVINSI: 'Sumatera Utara',
  // Logo kop: isi ID berkas gambar di Drive akun ini (disarankan), atau URL gambar publik. Kosong = tanpa logo.
  LOGO_FILE_ID: '',
  LOGO_URL: '',

  TIMEZONE: 'Asia/Jakarta',
  MAX_PHOTOS: 6
};

// ====== ISI FORM (sesuai form cetak) ======
var FORM_SCHEMA = {
  kabupatenKota: [
    'Kabupaten Asahan', 'Kabupaten Batu Bara', 'Kabupaten Dairi', 'Kabupaten Deli Serdang',
    'Kabupaten Humbang Hasundutan', 'Kabupaten Karo', 'Kabupaten Labuhanbatu', 'Kabupaten Labuhanbatu Selatan',
    'Kabupaten Labuhanbatu Utara', 'Kabupaten Langkat', 'Kabupaten Mandailing Natal', 'Kabupaten Nias',
    'Kabupaten Nias Barat', 'Kabupaten Nias Selatan', 'Kabupaten Nias Utara', 'Kabupaten Padang Lawas',
    'Kabupaten Padang Lawas Utara', 'Kabupaten Pakpak Bharat', 'Kabupaten Samosir', 'Kabupaten Serdang Bedagai',
    'Kabupaten Simalungun', 'Kabupaten Tapanuli Selatan', 'Kabupaten Tapanuli Tengah', 'Kabupaten Tapanuli Utara',
    'Kabupaten Toba', 'Kota Binjai', 'Kota Gunungsitoli', 'Kota Medan', 'Kota Padangsidimpuan',
    'Kota Pematangsiantar', 'Kota Sibolga', 'Kota Tanjungbalai', 'Kota Tebing Tinggi'
  ],
  sarana: [
    { no: 1, kategori: 'Ruang Layanan', items: [
      { id: 's1a', label: 'Ruang Konsultasi Hukum' }, { id: 's1b', label: 'Ventilasi' }, { id: 's1c', label: 'Dispenser' }] },
    { no: 2, kategori: 'Meja dan Kursi', items: [
      { id: 's2a', label: 'Meja' }, { id: 's2b', label: 'Kursi Petugas' }, { id: 's2c', label: 'Kursi Pengunjung' }] },
    { no: 3, kategori: 'Papan Informasi', items: [
      { id: 's3a', label: 'Plang/Banner Posbankum' }, { id: 's3b', label: 'Informasi Pelayanan' },
      { id: 's3c', label: 'Jadwal Pelayanan' }, { id: 's3d', label: 'Alur Pelayanan' }] },
    { no: 4, kategori: 'Brosur dan Media Cetak', items: [{ id: 's4a', label: 'Brosur Edukatif' }] },
    { no: 5, kategori: 'Perlengkapan Khusus', items: [{ id: 's5a', label: 'Buku Register' }] },
    { no: 6, kategori: 'SDM', items: [{ id: 's6a', label: 'Paralegal' }] },
    { no: 7, kategori: 'Kelengkapan Sarana Lainnya', items: [{ id: 's7a', label: 'Titik G Maps' }] }
  ],
  pelaporan: [
    { id: 'p1', label: 'Layanan Konsultasi dan Informasi Hukum' },
    { id: 'p2', label: 'Layanan Bantuan Hukum dan Advokasi' },
    { id: 'p3', label: 'Layanan Perdamaian di Luar Pengadilan' },
    { id: 'p4', label: 'Layanan Rujukan Advokat' }
  ],
  minRows: 3
};

// ====== WEB APP ======
function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Form Monev Posbankum Desa/Kelurahan')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** Dipanggil dari Index.html: kode bersama untuk pratinjau dokumen di browser. */
function sharedJs() {
  return [
    'var FORM_SCHEMA = ' + JSON.stringify(FORM_SCHEMA) + ';',
    esc_.toString(), fmtTanggal_.toString(), buildDocHtml_.toString()
  ].join('\n');
}

/** Dipanggil dari Index.html: pengaturan yang boleh dilihat browser. */
function clientConfig() {
  return {
    instansi: CONFIG.INSTANSI, unit: CONFIG.UNIT, alamat: CONFIG.ALAMAT, provinsi: CONFIG.PROVINSI,
    logo: CONFIG.LOGO_FILE_ID ? '' : CONFIG.LOGO_URL, maxPhotos: CONFIG.MAX_PHOTOS,
    kop: CONFIG.DOC_KOP
  };
}

/** Menerima satu pengisian form, menyimpan semuanya ke Drive, dan mengembalikan PDF-nya. */
function submitMonev(d) {
  d = normalize_(d);
  var err = validate_(d);
  if (err) throw new Error(err);

  var now = new Date();
  var id = 'MONEV-' + Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss') + '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase();
  d.id = id;
  d.submittedAt = Utilities.formatDate(now, CONFIG.TIMEZONE, 'dd/MM/yyyy HH.mm') + ' WIB';

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var root = rootFolder_();
    var desaLabel = d.identitas.jenisWilayah + ' ' + d.identitas.desa;
    var kab = child_(root, safe_(d.identitas.kabupaten));
    var kec = child_(kab, 'Kec. ' + safe_(d.identitas.kecamatan));
    var folder = child_(kec, safe_(desaLabel));

    var base = 'Form Monev Posbankum - ' + safe_(desaLabel) + ' - Kec. ' + safe_(d.identitas.kecamatan) +
      ' - ' + d.identitas.tanggal;
    base = uniqueName_(folder, base, '.pdf', now);

    // Foto dokumentasi
    var photoFiles = [];
    if (d.foto.length) {
      var docs = child_(folder, CONFIG.DOC_SUBFOLDER);
      d.foto.forEach(function (p, i) {
        var b = dataUrlBlob_(p.dataUrl, base + ' - Foto ' + (i + 1));
        if (b) {
          var f = docs.createFile(b);
          if (p.caption) f.setDescription(p.caption);
          photoFiles.push(f);
        }
      });
    }

    // PDF
    var html = buildDocHtml_(d, docOptions_());
    var pdf = Utilities.newBlob(html, 'text/html', base + '.html').getAs('application/pdf').setName(base + '.pdf');
    var pdfFile = folder.createFile(pdf);
    pdfFile.setDescription('ID ' + id + ' · dikirim ' + d.submittedAt + ' · diisi oleh ' + d.identitas.namaPengisi);

    // Rekap
    var path = [root.getName(), kab.getName(), kec.getName(), folder.getName()].join(' / ');
    appendRekap_(root, d, folder, pdfFile, photoFiles.length);

    return {
      ok: true, id: id, path: path, fileName: pdfFile.getName(),
      folderUrl: folder.getUrl(), pdfUrl: pdfFile.getUrl(),
      pdfBase64: Utilities.base64Encode(pdf.getBytes())
    };
  } finally {
    lock.releaseLock();
  }
}

/** Jalankan sekali dari editor (Run ▸ setup) untuk membuat folder induk & spreadsheet rekap dan memberi izin. */
function setup() {
  var root = rootFolder_();
  var ss = rekapSheet_(root);
  Logger.log('Folder induk: ' + root.getUrl());
  Logger.log('Spreadsheet rekap: ' + ss.getParent().getUrl());
}

// ====== DOKUMEN (dipakai server untuk PDF dan browser untuk pratinjau) ======
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function fmtTanggal_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  var bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September',
    'Oktober', 'November', 'Desember'];
  return Number(m[3]) + ' ' + bulan[Number(m[2]) - 1] + ' ' + m[1];
}

function buildDocHtml_(d, o) {
  var S = FORM_SCHEMA, id = d.identitas || {}, CK = '&#8730;';
  var B = 'border:1px solid #000;';
  var td = function (txt, st) { return '<td style="' + B + 'padding:3px 6px;' + (st || '') + '">' + txt + '</td>'; };
  var head = 'background:#95b3d7;font-weight:bold;text-align:center;';
  var mark = function (r) {
    r = r || {};
    return td(r.status === 'ada' ? CK : '', 'text-align:center;font-weight:bold;') +
      td(r.status === 'tidak' ? CK : '', 'text-align:center;font-weight:bold;') +
      td(r.status === 'ada' && r.jumlah !== '' && r.jumlah != null ? esc_(r.jumlah) : '', 'text-align:center;');
  };
  var rows = [];
  rows.push('<tr>' + td('No.', 'font-weight:bold;width:7%;vertical-align:top;" rowspan="2') +
    td('Sarana dan Prasarana', head + '" colspan="2') +
    td('Ada', 'font-weight:bold;text-align:center;width:11%;" rowspan="2') +
    td('Tidak Ada', 'font-weight:bold;text-align:center;width:13%;" rowspan="2') +
    td('Jumlah', 'font-weight:bold;text-align:center;width:11%;" rowspan="2') + '</tr>');
  rows.push('<tr>' + td('Kategori Fasilitas', 'font-weight:bold;text-align:center;width:26%;') +
    td('Jenis Fasilitas', 'font-weight:bold;text-align:center;width:32%;') + '</tr>');
  S.sarana.forEach(function (g) {
    g.items.forEach(function (it, i) {
      var first = i === 0, last = i === g.items.length - 1;
      var keep = (first ? '' : 'border-top:none;') + (last ? '' : 'border-bottom:none;');
      rows.push('<tr>' + td(first ? g.no + '.' : '', 'text-align:center;' + keep) +
        td(first ? esc_(g.kategori) : '', keep) + td(esc_(it.label)) + mark((d.sarana || {})[it.id]) + '</tr>');
    });
  });
  rows.push('<tr>' + td('') + td('Pelaporan Layanan', head + '" colspan="5') + '</tr>');
  rows.push('<tr>' + td('No.', 'font-weight:bold;text-align:center;') +
    td('Pelaporan layanan di Aplikasi Posbankum', 'font-weight:bold;" colspan="2') +
    td('Ada', 'font-weight:bold;text-align:center;') + td('Tidak Ada', 'font-weight:bold;text-align:center;') +
    td('Jumlah', 'font-weight:bold;text-align:center;') + '</tr>');
  S.pelaporan.forEach(function (it, i) {
    rows.push('<tr>' + td((i + 1) + '.', 'text-align:center;') + td(esc_(it.label), '" colspan="2') +
      mark((d.pelaporan || {})[it.id]) + '</tr>');
  });
  var list = function (title, arr) {
    arr = (arr || []).filter(function (x) { return String(x || '').trim(); });
    rows.push('<tr>' + td('') + td(esc_(title), head + '" colspan="5') + '</tr>');
    var n = Math.max(S.minRows, arr.length);
    for (var i = 0; i < n; i++) {
      rows.push('<tr>' + td((i + 1) + '.', 'text-align:center;vertical-align:top;') +
        td(arr[i] ? esc_(arr[i]).replace(/\n/g, '<br>') : '&nbsp;', '" colspan="5') + '</tr>');
    }
  };
  list('Kendala Posbankum', d.kendala);
  list('Permasalahan Yang Terjadi di Desa/Kelurahan', d.permasalahan);

  var info = [['Provinsi', o.provinsi], ['Kabupaten/Kota', id.kabupaten], ['Kecamatan', id.kecamatan],
    ['Desa/Kelurahan', (id.jenisWilayah ? id.jenisWilayah + ' ' : '') + (id.desa || '')],
    ['Kepala Desa/Lurah', id.kepalaDesa]].map(function (r) {
    return '<tr><td style="padding:1px 0;width:34%;font-weight:bold;">' + r[0] + '</td><td style="padding:1px 0;width:2%;">:</td><td style="padding:1px 0;">' + esc_(r[1]) + '</td></tr>';
  }).join('');

  var kop = '';
  if (o.kop && (o.instansi || o.unit)) {
    kop = '<table style="width:100%;border-collapse:collapse;border-bottom:3px double #000;margin-bottom:10px;"><tr>' +
      (o.logo ? '<td style="width:70px;padding:0 0 6px 0;vertical-align:middle;"><img src="' + o.logo + '" style="width:64px;height:auto;"></td>' : '') +
      '<td style="text-align:center;padding:0 0 6px 0;vertical-align:middle;">' +
      '<div style="font-size:13pt;font-weight:bold;letter-spacing:.5px;">' + esc_(o.instansi) + '</div>' +
      '<div style="font-size:12pt;font-weight:bold;">' + esc_(o.unit) + '</div>' +
      (o.alamat ? '<div style="font-size:8.5pt;">' + esc_(o.alamat) + '</div>' : '') + '</td>' +
      (o.logo ? '<td style="width:70px;"></td>' : '') + '</tr></table>';
  }

  return '<!doctype html><html><head><meta charset="utf-8"><title>Form Monev Posbankum</title>' +
    '<style>@page{size:A4;margin:15mm 13mm 10mm 19mm;}body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#000;margin:0;}' +
    'table{border-collapse:collapse;}</style></head><body>' + kop +
    '<div style="text-align:center;font-weight:bold;font-size:12pt;margin:0 0 12px;">FORM MONEV POS BANTUAN HUKUM DESA/KELURAHAN</div>' +
    '<table style="width:100%;margin-bottom:8px;font-size:10.5pt;">' + info + '</table>' +
    '<table style="width:100%;font-size:10pt;">' + rows.join('') + '</table>' +
    '</body></html>';
}

// ====== BANTUAN SERVER ======
function docOptions_() {
  var logo = '';
  try {
    if (CONFIG.LOGO_FILE_ID) {
      var b = DriveApp.getFileById(CONFIG.LOGO_FILE_ID).getBlob();
      logo = 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
    } else if (CONFIG.LOGO_URL) {
      var r = UrlFetchApp.fetch(CONFIG.LOGO_URL).getBlob();
      logo = 'data:' + r.getContentType() + ';base64,' + Utilities.base64Encode(r.getBytes());
    }
  } catch (e) { logo = ''; }
  return { instansi: CONFIG.INSTANSI, unit: CONFIG.UNIT, alamat: CONFIG.ALAMAT, provinsi: CONFIG.PROVINSI, logo: logo,
    kop: CONFIG.DOC_KOP };
}

function normalize_(d) {
  d = d || {};
  var s = function (v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, max || 200); };
  var id = d.identitas || {};
  var out = {
    identitas: {
      kabupaten: s(id.kabupaten), kecamatan: s(id.kecamatan), desa: s(id.desa),
      jenisWilayah: id.jenisWilayah === 'Kelurahan' ? 'Kelurahan' : 'Desa',
      kepalaDesa: s(id.kepalaDesa), tanggal: s(id.tanggal, 10),
      namaPengisi: s(id.namaPengisi), jabatanPengisi: s(id.jabatanPengisi), kontak: s(id.kontak, 40)
    },
    sarana: {}, pelaporan: {}, kendala: [], permasalahan: [], foto: []
  };
  var mark = function (src, dst, ids) {
    ids.forEach(function (k) {
      var r = (src || {})[k] || {};
      var st = r.status === 'ada' || r.status === 'tidak' ? r.status : '';
      var j = st === 'ada' && /^\d{1,5}$/.test(String(r.jumlah)) ? String(Number(r.jumlah)) : '';
      dst[k] = { status: st, jumlah: j };
    });
  };
  var sIds = []; FORM_SCHEMA.sarana.forEach(function (g) { g.items.forEach(function (i) { sIds.push(i.id); }); });
  mark(d.sarana, out.sarana, sIds);
  mark(d.pelaporan, out.pelaporan, FORM_SCHEMA.pelaporan.map(function (i) { return i.id; }));
  ['kendala', 'permasalahan'].forEach(function (k) {
    out[k] = (d[k] || []).map(function (x) { return s(x, 1000); }).filter(String).slice(0, 20);
  });
  out.foto = (d.foto || []).slice(0, CONFIG.MAX_PHOTOS).filter(function (p) {
    return p && /^data:image\/(jpeg|png);base64,/.test(String(p.dataUrl || ''));
  }).map(function (p) { return { dataUrl: String(p.dataUrl), caption: s(p.caption, 120) }; });
  return out;
}

function validate_(d) {
  var i = d.identitas;
  var need = [['kabupaten', 'Kabupaten/Kota'], ['kecamatan', 'Kecamatan'], ['desa', 'Nama Desa/Kelurahan'],
    ['kepalaDesa', 'Kepala Desa/Lurah'], ['tanggal', 'Tanggal Monev'], ['namaPengisi', 'Nama pengisi form']];
  for (var k = 0; k < need.length; k++) if (!i[need[k][0]]) return need[k][1] + ' wajib diisi.';
  if (FORM_SCHEMA.kabupatenKota.indexOf(i.kabupaten) === -1) return 'Kabupaten/Kota tidak dikenal.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.tanggal)) return 'Format tanggal tidak valid.';
  var empty = [];
  Object.keys(d.sarana).forEach(function (k) { if (!d.sarana[k].status) empty.push(k); });
  Object.keys(d.pelaporan).forEach(function (k) { if (!d.pelaporan[k].status) empty.push(k); });
  if (empty.length) return 'Masih ada ' + empty.length + ' isian Ada/Tidak Ada yang belum dipilih.';
  var bytes = d.foto.reduce(function (a, p) { return a + p.dataUrl.length; }, 0);
  if (bytes > 20 * 1024 * 1024) return 'Ukuran foto terlalu besar. Kurangi jumlah foto.';
  return '';
}

function rootFolder_() {
  if (CONFIG.ROOT_FOLDER_ID) return DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('ROOT_FOLDER_ID');
  if (saved) {
    try { var f = DriveApp.getFolderById(saved); if (!f.isTrashed()) return f; } catch (e) { /* buat ulang */ }
  }
  var it = DriveApp.getRootFolder().getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  var root = it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(CONFIG.ROOT_FOLDER_NAME);
  props.setProperty('ROOT_FOLDER_ID', root.getId());
  return root;
}

function child_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function safe_(s) {
  return String(s || '').replace(/[\\\/:*?"<>|#%]+/g, '-').replace(/\s+/g, ' ').trim()
    .replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }).slice(0, 80);
}

function uniqueName_(folder, base, ext, now) {
  if (!folder.getFilesByName(base + ext).hasNext()) return base;
  return base + ' (' + Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH.mm.ss') + ')';
}

function dataUrlBlob_(url, name) {
  var m = /^data:(image\/(jpeg|png));base64,(.+)$/.exec(String(url || ''));
  if (!m) return null;
  return Utilities.newBlob(Utilities.base64Decode(m[3]), m[1], name + (m[2] === 'png' ? '.png' : '.jpg'));
}

function rekapSheet_(root) {
  var folder = child_(root, CONFIG.REKAP_FOLDER_NAME);
  var it = folder.getFilesByName(CONFIG.SPREADSHEET_NAME);
  var ss;
  if (it.hasNext()) {
    ss = SpreadsheetApp.open(it.next());
  } else {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
  }
  var sh = ss.getSheets()[0];
  if (sh.getLastRow() === 0) {
    var h = rekapHeader_();
    sh.setName('Rekap');
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setFontColor('#ffffff')
      .setBackground('#0b2447').setWrap(true).setVerticalAlignment('middle');
    sh.setFrozenRows(1);
    sh.setFrozenColumns(5);
  }
  return sh;
}

function rekapHeader_() {
  var h = ['Waktu Kirim', 'ID', 'Kabupaten/Kota', 'Kecamatan', 'Desa/Kelurahan', 'Kepala Desa/Lurah', 'Tanggal Monev',
    'Nama Pengisi', 'Jabatan Pengisi', 'No. HP Pengisi'];
  FORM_SCHEMA.sarana.forEach(function (g) {
    g.items.forEach(function (i) { h.push(i.label + ' (Ada/Tidak)', i.label + ' (Jumlah)'); });
  });
  FORM_SCHEMA.pelaporan.forEach(function (i) { h.push(i.label + ' (Ada/Tidak)', i.label + ' (Jumlah)'); });
  return h.concat(['Skor Sarana (%)', 'Kendala Posbankum', 'Permasalahan di Desa/Kelurahan', 'Jumlah Foto', 'Folder', 'PDF']);
}

function appendRekap_(root, d, folder, pdfFile, nFoto) {
  var sh = rekapSheet_(root), i = d.identitas;
  var st = function (r) { return r.status === 'ada' ? 'Ada' : 'Tidak Ada'; };
  var row = [d.submittedAt, d.id, i.kabupaten, 'Kec. ' + i.kecamatan, i.jenisWilayah + ' ' + i.desa, i.kepalaDesa,
    fmtTanggal_(i.tanggal), i.namaPengisi, i.jabatanPengisi, i.kontak];
  var ada = 0, total = 0;
  FORM_SCHEMA.sarana.forEach(function (g) {
    g.items.forEach(function (it) {
      var r = d.sarana[it.id]; total++; if (r.status === 'ada') ada++;
      row.push(st(r), r.jumlah === '' ? '' : Number(r.jumlah));
    });
  });
  FORM_SCHEMA.pelaporan.forEach(function (it) {
    var r = d.pelaporan[it.id]; row.push(st(r), r.jumlah === '' ? '' : Number(r.jumlah));
  });
  var num = function (a) { return a.map(function (x, k) { return (k + 1) + '. ' + x; }).join('\n'); };
  row.push(Math.round(ada / total * 100), num(d.kendala), num(d.permasalahan), nFoto,
    folder.getUrl(), pdfFile.getUrl());
  // Kolom teks diawali tanda petik agar isian seperti "=..." tidak dibaca sebagai rumus
  row = row.map(function (v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; });
  sh.appendRow(row);
}
