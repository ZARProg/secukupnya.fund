# Secukupnya.fund

Pencatat pemasukan dan pengeluaran pribadi (React, Vite, TypeScript, Tailwind).
Datamu bisa disimpan di **Google Sheets milikmu sendiri**, di **browser ini saja**, atau keduanya, dan bisa diimpor dari file **Excel (.xlsx)**.

## Menjalankan

`index.html` tidak bisa dibuka dengan klik dua kali (layar akan kosong), karena kodenya perlu diproses Vite dulu.

```bash
npm install
npm run dev
```

Buka alamat yang tampil di terminal (biasanya http://localhost:5173). Perlu Node.js 18 atau lebih baru.

Perintah lain: `npm run build`, `npm run preview` (lihat hasil build di http://localhost:4173), `npm run lint`, `npm run typecheck`.

## Sumber data

### Google Sheets (opsional)

1. Buat Google Sheet baru. Sheet `Expense` dan `Income` dibuat otomatis kalau belum ada.
2. Buka **Extensions → Apps Script**, hapus isi editor, lalu tempel isi [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Di aplikasi, tombol **Salin kode Apps Script** (menu Sumber data) menyalin file yang sama.
3. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone**. Setujui izin yang diminta.
4. Salin URL yang berakhiran `/exec`, buka menu **Sumber data** di aplikasi, tempel, lalu klik **Hubungkan**.

Catatan:

- Tiap pengguna memasukkan URL Apps Script miliknya sendiri. URL disimpan di browser, bukan di kode. Untuk development lokal kamu bisa mengisi `VITE_GOOGLE_WEB_APP_URL` di file `.env` sebagai URL bawaan.
- Setelah `Code.gs` diperbarui, deploy ulang: **Deploy → Manage deployments → Edit → Version: New version**. Tanpa itu URL `/exec` tetap menjalankan kode lama. Impor ke Google Sheets butuh `Code.gs` versi 2; aplikasi mendeteksi versi lama dan menonaktifkan pilihan itu.
- Form Catat transaksi punya tab **Transfer**: pilih rekening asal dan tujuan, jumlah, dan biaya admin (opsional). Website membuat dua baris berkategori Transfer: keluar dari rekening asal (jumlah + biaya admin, jadi saldo berkurang sebesar itu) dan masuk ke rekening tujuan (jumlah). Keduanya tidak dihitung sebagai pemasukan atau pengeluaran. Kategori pengeluaran juga mencakup **Paylater**.
- Urutan di spreadsheet (script versi 3): transaksi baru disisipkan sesuai tanggal, jadi yang terbaru ada di baris paling atas. Tanggal yang sama: yang baru dicatat di atas. Impor dari Excel juga masuk terurut. Untuk merapikan data lama, jalankan menu **BudgetTracker → Urutkan terbaru di atas** di spreadsheet (muncul setelah script versi 3 dipasang dan spreadsheet dibuka ulang). Ekspor Excel dari website juga terbaru di atas. Script hanya menyentuh kolom A–E, jadi tabel lain di sheet yang sama (mis. Daily Total Report di kolom G–I) tidak ikut bergeser; baris kosong di antara data ditarik rapat ke atas, dan menghapus transaksi menggeser baris di bawahnya naik tanpa memendekkan sheet.
- Batas pengeluaran harian (bawaan Rp 50.000) bisa diubah di menu Sumber data. Dengan script versi 4, batas itu ikut dikirim ke spreadsheet dan dipakai popup peringatan di sana; browser yang belum pernah mengatur batas sendiri memakai batas dari spreadsheet. Tanpa script versi 4, batas hanya tersimpan di browser.
- Halaman **Laporan**: ringkasan per bulan (pemasukan, pengeluaran, selisih, tingkat tabungan), perbandingan dengan bulan lalu, tren 6 bulan, rata-rata per hari, hari paling boros, dan pengeluaran terbesar. Transfer tidak dihitung.
- **Anggaran per kategori** (di halaman Laporan → Atur anggaran): progres hijau, kuning mulai 80%, merah saat melebihi anggaran. Tersimpan di browser ini, tidak dikirim ke spreadsheet.
- Halaman Transaksi punya filter bulan dan kategori, selain jenis, rekening, dan pencarian.
- Ikon aplikasi ada di folder `public/` (favicon SVG, PNG, dan `manifest.webmanifest`), jadi website bisa dipasang ke layar utama HP.
- Tanggal dari spreadsheet dibaca dalam banyak bentuk: `2026-09-28`, `9/28/2026` (tampilan Google Sheets berbahasa Inggris), `28/9/2026`, `28 Sep 2026`, `Sep 28, 2026`, dan `Date` dari JSON. Untuk tulisan ambigu seperti `10/5/2026`, urutannya ditebak dari seluruh data (satu tanggal seperti `28/9` sudah cukup untuk memastikan); kalau semuanya ambigu, dipakai bulan/hari/tahun. Tanggal yang tetap tidak terbaca tidak dibuang: transaksinya tampil di grup "Tanggal tidak terbaca", ikut saldo, dan ada peringatan berisi contoh teksnya.
- Aksesnya "Anyone" (syarat Apps Script untuk dipanggil dari website). Tanpa token, **siapa pun yang memegang URL bisa membaca, menambah, dan menghapus data.** Lihat bagian "Keamanan akses" di bawah.

### Data di browser

Disimpan di `localStorage` perangkat ini dan tidak dikirim ke mana pun. Data hilang kalau data situs browser dihapus, jadi unduh cadangan lewat **Sumber data → Unduh semua data (.xlsx)** secara berkala.

Data dari Google Sheets dan data di browser adalah dua sumber terpisah yang digabung di tampilan. Impor Excel kini memeriksa duplikat terhadap **kedua** sumber, dan halaman **Tinjau duplikat** menampilkan pasangan transaksi yang sama di browser dan Sheets (persis atau mirip) beserta dampaknya pada saldo, supaya bisa dihapus salah satunya atau diabaikan.

## Bank dan e-wallet

Di **Sumber data → Bank dan e-wallet** kamu memilih mana yang dipakai dari: BCA, MANDIRI, BNI, BRI, SEABANK, BANK JAGO, KROM, DANA, OVO, GOPAY, SHOPEEPAY. Pilihan itu muncul di form catat transaksi, sidebar, dan dashboard, dan disimpan di browser. Di awal belum ada yang dipilih; pilih dulu sebelum mencatat transaksi.

Rekening yang sudah punya transaksi atau transfer tetap tampil walau tidak dipilih, supaya saldonya tidak hilang. Saldo total di dashboard adalah jumlah saldo semua rekening. Tulisan seperti `Bank Jago`, `go-pay`, atau `bca` di Excel atau Sheets dikenali sebagai nama yang sama. Avatar berwarna hanyalah monogram, bukan logo resmi.

## Template Excel

Tombol **Unduh template Excel** ada di sidebar, di menu Sumber data, dan di panel impor. Isinya sheet `Expense` dan `Income` dengan kolom `Date, Category, Account/Bank, Description, Total (Rp)` (sama dengan sheet di Google Sheets yang dipakai Apps Script), plus sheet `Panduan` berisi cara mengisi dan daftar nilai yang valid. Template sengaja tanpa baris contoh di sheet data. Tidak ada dropdown di dalam file; daftar kategori dan bank ada di sheet Panduan.

**Unduh semua data (.xlsx)** memakai susunan yang sama, jadi hasil ekspor bisa diimpor kembali.

## Impor dari Excel

Menu **Impor dari Excel** membaca file `.xlsx` (maksimal 5 MB dan 5000 baris; format `.xls` lama dan `.csv` tidak didukung), menampilkan pratinjau, lalu kamu memilih tujuannya: **Google Sheets** atau **Browser ini saja**.

- Kolom yang dikenali: **Date/Tanggal**, **Category/Kategori**, **Account/Bank**, **Description/Deskripsi**, **Total (Rp)**, dan opsional **Jenis** (Pengeluaran/Pemasukan). Yang wajib hanya tanggal dan total.
- Jenis transaksi diambil dari kolom Jenis. Kalau tidak ada, dipakai nama sheet (`Expense` atau `Income`), jadi file yang diunduh dari Google Sheets-mu langsung bisa dipakai. Sheet yang jenisnya tidak bisa ditentukan dilewati, bukan ditebak. Sheet bernama `Panduan`, `Dashboard`, `Ringkasan`, `Summary`, `Info`, `Petunjuk`, atau `Readme` diabaikan tanpa peringatan.
- **Transfer antar rekening** diisi dengan `Category = Transfer`. Di sheet `Income` transfer menambah saldo rekening di kolom Account/Bank (uang masuk), di sheet `Expense` transfer mengurangi saldonya (uang keluar). Transfer wajib punya Account/Bank. Transfer tidak tampil di daftar transaksi dan tidak dihitung sebagai pemasukan, pengeluaran, grafik, atau batas harian, tapi ikut ke saldo rekening dan saldo total. Biaya admin yang ikut terpotong cukup dicatat di sisi keluar.
- Tanggal bisa berupa sel tanggal, nomor seri Excel, atau teks (`2026-10-08`, `08/10/2026`, `8 Okt 2026`). Teks `08/10/2026` dibaca **hari/bulan/tahun**.
- Jumlah bisa berupa angka atau teks seperti `Rp 1.500.000`.
- Baris yang tidak valid dilewati dan alasannya ditampilkan beserta nomor barisnya.
- Baris yang sama persis dengan data di tujuan (tanggal, jenis, kategori, rekening, keterangan, jumlah) dilewati secara default, jadi mengimpor file yang sama dua kali tidak membuat data dobel. Perhitungannya per jumlah kemunculan: dua kopi identik di hari yang sama tetap masuk dua-duanya.
- Impor ke Google Sheets dikirim per 200 baris. Kalau terhenti di tengah, baris yang sudah masuk tidak dikirim ulang saat kamu mencoba lagi.

## Bahasa (Indonesia / Inggris)

Tombol **ID / EN** ada di sidebar. Pilihan disimpan di browser (`budgettracker.lang.v1`) dan memengaruhi seluruh antarmuka, format angka (`1.234` / `1,234`), format tanggal, dan sheet Panduan di template Excel.
Yang sengaja tidak diterjemahkan karena merupakan data: nama kategori, nama bank, header kolom Excel, nama sheet `Expense` / `Income`, dan teks popup/menu di Apps Script.
Teks ada di `src/i18n/`; kuncinya bertipe, jadi kunci yang hilang di salah satu bahasa gagal saat `tsc`.

## Fitur tambahan

- **Ubah transaksi**: ikon pensil di tiap baris. Jenis transaksi dan tujuan simpan (spreadsheet/browser) tidak bisa diganti. Di spreadsheet, fitur ini butuh Apps Script **versi 5** (deploy ulang `Code.gs`); baris lama diverifikasi dulu, dihapus, lalu versi baru disisipkan sesuai tanggalnya.
- **Navigasi** (sidebar, dikelompokkan): grup utama (Beranda, Transaksi, Anggaran, Target tabungan, Laporan), *Perencanaan* (Kalender, Tagihan rutin, Utang, Kekayaan bersih), *Alat* (Aturan kategori, Riwayat, Sumber data), dan *Semangat* (Pencapaian, Rekap).
  - **Anggaran**: batas bulanan per kategori dengan pemilih bulan (dulunya di Laporan).
  - **Target tabungan**: progres, sisa, dan setoran per bulan kalau ada tenggat. Dana yang ditambahkan hanya catatan, bukan transaksi.
  - **Tagihan rutin**: tagihan atau pemasukan rutin per tanggal. Saat jatuh tempo, banner di Beranda menawarkan **Catat** atau **Lewati**; tidak ada yang dicatat otomatis. Hanya bulan berjalan yang ditawarkan.
  - Semuanya disimpan di browser ini (`budgettracker.budgets.v1`, `budgettracker.recurring.v1`, `budgettracker.goals.v1`).
- **Sembunyikan saldo**: ikon mata di kartu saldo menyamarkan saldo, total, dan saldo rekening (`budgettracker.hide.v1`).

## Fitur lanjutan

- **Rekening kosong di awal**: pengguna baru memilih sendiri bank/e-wallet di Sumber data. Selama belum ada yang dipilih, Beranda menampilkan ajakan memilih dan form catat transaksi meminta rekening dulu (transfer butuh dua rekening).
- **Wawasan keuangan** (Laporan, dan 3 teratas di Beranda): dihitung dengan aturan tetap di `src/lib/insights.ts`, bukan tebakan. Isinya: perbandingan dengan bulan lalu (bulan berjalan dibandingkan sampai tanggal yang sama), kategori terbesar, anggaran terlewati atau hampir habis, sisa pemasukan, perubahan pola per kategori (naik/turun minimal 30% dan Rp 50.000), serta saran sederhana dan proyeksi akhir bulan (diberi label proyeksi). Ambang batas ada sebagai konstanta di berkas itu. Ini bukan nasihat keuangan profesional.
- **Kalender keuangan** (menu Kalender): tampilan bulanan dengan penanda warna: hijau = pemasukan tercatat, merah = pengeluaran tercatat, kuning = transaksi berulang terjadwal (proyeksi), ungu = tenggat target. Pilih tanggal untuk melihat rinciannya. Transaksi tercatat, jadwal, dan target ditampilkan terpisah dan ringkasannya dipisah: terjadwal dan target **bukan transaksi** dan tidak memengaruhi saldo. Bulan yang sudah lewat hanya menampilkan transaksi tercatat. Ada daftar tagihan 7 hari ke depan (termasuk awal bulan depan) dan tombol Catat/Lewati untuk yang sudah jatuh tempo.
- **Deteksi duplikat saat impor Excel**:
  - *Sama persis* (tanggal, jenis, kategori, rekening, keterangan, jumlah) dengan data di tujuan dilewati secara default; barisnya bisa dilihat dan centangnya bisa dimatikan.
  - *Mirip* (tanggal, jenis, jumlah, dan rekening sama, plus kategori sama atau keterangan serupa) ditandai dan dicentang secara default; kamu yang memutuskan per baris. Dua pembelian yang sama di hari yang sama bisa saja memang berbeda.
  - Baris kembar di dalam file hanya diberi tahu, tetap diimpor.
  - Tidak ada transaksi yang dihapus otomatis.
- **Filter transaksi lanjutan**: rentang tanggal, nominal minimum/maksimum, hanya kategori yang melewati anggaran bulannya, dan hanya transaksi tanpa deskripsi, digabung dengan filter jenis, rekening, bulan, kategori, dan pencarian. Kombinasi filter bisa disimpan (maks. 12, di browser ini: `budgettracker.savedFilters.v1`). Pilihan tersimpan yang sudah tidak ada (rekening dihapus, bulan tanpa data) dikosongkan saat dipakai.

## Aman dipakai, pencapaian, dan rekap

**Aman dipakai (Safe-to-Spend)** di Ringkasan: `saldo rekening − tagihan belum dibayar bulan ini − dana target yang tersimpan − setoran target bulan ini`. Selalu berlabel *Perkiraan*. Supaya tidak ada hitung ganda:

- Tagihan yang sudah dicatat (tombol Catat) atau sudah punya transaksi yang cocok (jenis, rekening, kategori, nominal) tidak dikurangi lagi. Tagihan yang dilewati juga tidak.
- Pemasukan berulang tidak pernah ditambahkan, hanya yang benar-benar tercatat.
- Dana target dikurangi hanya kalau masih ada di saldo. Kalau sudah dipindahkan dan dicatat sebagai transfer, matikan opsinya di *Atur*.
- Saldo dihitung dari transaksi yang tercatat. Kalau ada saldo awal yang belum dicatat, isi saldo sebenarnya di *Atur* (disimpan sebagai selisih, jadi transaksi berikutnya tetap dihitung).
- Anggaran kategori tidak dikurangi karena bukan kewajiban.

**Pencapaian**: XP hanya untuk kebiasaan, bukan jumlah transaksi (1 atau 60 transaksi dalam sehari nilainya sama):

| Sumber | XP |
|---|---|
| Hari yang dicatat | +5 |
| Hari selesai di bawah batas harian | +5 |
| Minggu dengan minimal 5 hari tercatat | +20 |
| Bulan penuh tanpa melewati anggaran | +50 |
| Target tabungan tercapai (target ≥ Rp100.000) | +100 |
| Tantangan selesai | 15-40 |

Level: Beginner (0), Money Explorer (100), Smart Saver (300), Budget Master (700), Financial Legend (1500). Lencana: First Step, Consistent Saver (7 hari berturut-turut tercatat dan di bawah batas), Goal Getter, Budget Guardian, Financial Master (3 tantangan). Lencana yang sudah didapat tidak dicabut.
Semua dihitung sejak hari fitur ini mulai dipakai di browser itu, jadi mengimpor riwayat lama tidak memberi XP instan. Jumlah dana di target diisi sendiri dan check-in bekal adalah konfirmasi sendiri, jadi keduanya berdasarkan pengakuan pengguna dan diberi label begitu. Data disimpan di browser (`budgettracker.engage.v1`).

**Rekap**: kartu cerita mingguan atau bulanan (5 kartu) yang bisa diunduh sebagai PNG 1080×1350 atau dibagikan lewat menu bagikan perangkat. Nominal mengikuti mode sembunyikan saldo dan bisa diatur khusus untuk kartu.

## Catat cepat (Quick Add)

Tekan **N** (di luar kolom isian) atau tombol *Catat transaksi*. Tab **Cepat** menerima teks bebas, satu transaksi per baris (maks. 50 baris):

```
25000 kopi BCA hari ini
+5jt gaji BCA
12rb parkir kemarin
1,5jt kos #Tagihan
```

- Nominal: `25000`, `25.000`, `25rb`, `25k`, `1,5jt`, `3juta`, `5mil`, awalan `Rp`. Angka polos di bawah 100 dianggap bagian dari keterangan. Kalau ada beberapa nominal, yang bersufiks atau terbesar dipakai dan baris diberi peringatan.
- Tanggal: `hari ini`, `kemarin`, `kemarin lusa`, `3 hari lalu`, `12 okt`, `tgl 5`, `2026-10-01`, `dd/mm`. Tanpa tanggal, hari ini.
- Rekening dikenali dari nama atau alias bank yang kamu pilih. Kategori ditebak dari `#tag`, kata yang pernah kamu koreksi, kata kunci, lalu kategori terakhir.
- Awalan `+` atau kata pemasukan membuat baris jadi pemasukan.
- **Tidak ada yang tersimpan sebelum kamu menekan Simpan** (atau Enter). Setiap baris bisa diperiksa dan diubah dulu. Shift+Enter membuat baris baru.
- Aplikasi mengingat rekening dan kategori terakhir, kata-kata yang kamu koreksi, serta hingga 8 tombol favorit. Transaksi yang sering berulang muncul sebagai saran. Data ini ada di browser (`budgettracker.quick.v1`, tab terakhir di `budgettracker.recordtab.v1`).

## Utang & cicilan (Paylater)

Menu **Utang** mencatat total utang, biaya/bunga yang kamu ketahui, cicilan bulanan, tanggal jatuh tempo, riwayat pembayaran, perkiraan lunas, dan simulasi skenario pelunasan (cicilan lebih besar, pelunasan sebagian, bunga opsional). Contoh: 4 x Rp300.000 menampilkan sisa Rp1.200.000 sebelum pembayaran pertama.

Model pencatatan supaya tidak terhitung dua kali:

| Kejadian | Dicatat sebagai | Masuk pengeluaran? | Mengurangi saldo kas? |
|---|---|---|---|
| Pembelian dengan Paylater | pengeluaran biasa di rekening khusus **KREDIT** | Ya, saat pembelian | Tidak |
| Bayar cicilan (bagian pokok) | kategori khusus **Debt Payment** di rekening bank | Tidak | Ya |
| Bunga/biaya dalam cicilan | pengeluaran kategori Paylater | Ya (ini biaya baru) | Ya |

`Debt Payment` tetap tampil di daftar transaksi dan mengurangi saldo bank, tetapi tidak masuk total, grafik, laporan, wawasan, kalender, anggaran, batas harian, dan rekap. Cicilan yang jatuh tempo bulan ini (yang belum dibayar) dikurangkan di Aman dipakai, dan pengingat muncul di Ringkasan.

Catatan penting:
- Catatan utang disimpan **hanya di browser** (`budgettracker.debts.v1`), tidak ikut ke Google Sheets. Transaksi yang dibuatnya ikut ke tujuan simpan yang kamu pilih. Menghapus catatan pembayaran tidak menghapus transaksinya.
- Simulasi memakai asumsi biaya tetap dan bunga bulanan yang kamu isi sendiri. Penyedia Paylater bisa punya aturan diskon bunga atau denda yang berbeda, jadi angka ini perkiraan.
- Transaksi lama berkategori Paylater tetap dihitung sebagai pengeluaran, seperti sebelumnya.

## Keamanan akses (Code.gs versi 6)

- **Token akses**: di spreadsheet pilih menu *Secukupnya → Buat atau ganti token akses*, lalu tempel token di **Sumber data**. Dengan token aktif, `GET` hanya mengembalikan status; membaca dan menulis lewat `POST` yang membawa token di badan permintaan (tidak pernah di URL) dan diperiksa sebelum apa pun dibaca atau ditulis. Token disimpan di Script Properties dan di `localStorage` browser.
- **Batasnya, jujur**: ini bukan login. Token adalah rahasia bersama: siapa pun yang memegangnya punya akses penuh, dan karena tersimpan di browser, skrip yang berjalan di situs ini (XSS) bisa membacanya. Dua lapis tambahan: `vercel.json` memasang CSP dan header keamanan (belum diuji di deployment nyata, periksa di DevTools → Network setelah deploy), dan sebaiknya satu pengguna memakai satu script + spreadsheet sendiri.
- **Banyak pengguna** berarti butuh backend dengan login dan otorisasi per pengguna. Itu di luar arsitektur situs statis ini.

## Aturan kategori, riwayat, backup

- **Aturan kategori**: halaman *Aturan kategori*. Kata kunci di deskripsi (mis. `gojek, grab` → Transportation). Aturan hanya **menyarankan**: dipakai di form, Quick Add (di bawah `#tag`, di atas kebiasaan yang dipelajari), dan impor Excel (kotak "terapkan aturan", opsi menimpa kategori file default mati). Aturan pertama yang cocok menang; Transfer dan Debt Payment tidak disentuh. Kategori terbatas pada kategori bawaan aplikasi. Kunci: `budgettracker.rules.v1`.
- **Riwayat perubahan**: halaman *Riwayat*. Mencatat tambah, ubah, hapus, pulihkan, impor, dan hapus massal dengan waktu, nilai sebelum/sesudah, sumber, dan dampak saldo; transaksi yang dihapus atau diubah bisa dipulihkan. Perubahan yang dilakukan langsung di spreadsheet terdeteksi saat sinkron berikutnya (waktunya = waktu terdeteksi). Riwayat **tersimpan per browser** (maks. 1000 entri), tidak ikut tersinkron. Kunci: `budgettracker.activity.v1`, `budgettracker.sheetsnap.v1`.
- **Backup & pindah perangkat** (Sumber data): unduh backup JSON lengkap (transaksi lokal, anggaran, target, utang, aturan, riwayat, dll.; sambungan Sheets dan token tidak ikut kecuali dicentang). Restore **mengganti** data, menampilkan pratinjau, mengunduh data saat ini dulu, dan dikembalikan bila gagal. **Sinkron pengaturan** (anggaran, target, aturan, dll.) lewat spreadsheet bersifat manual (kirim/tarik) dan butuh Code.gs versi 6; tidak otomatis dan tidak untuk transaksi lokal. Kunci: `budgettracker.syncmeta.v1`, `budgettracker.dupignore.v1`, `budgettracker.sheetToken.v1`, `budgettracker.secdismiss.v1`.

## Pengujian

Tes otomatis (esbuild + node, Playwright) mencakup saldo rekening, total pemasukan/pengeluaran, transfer (biaya admin), Paylater/cicilan, edit, hapus-tambah, dan impor berulang lintas sumber (uji properti acak, ribuan pemeriksaan), plus aturan, riwayat, backup, token Apps Script, dan alur UI.

## Deploy

Aplikasi ini situs statis (Vite). Tidak ada server sendiri; data ada di browser dan/atau Google Sheets lewat Apps Script.

1. `npm ci` lalu `npm run build`. Hasilnya folder `dist/`.
2. Unggah `dist/` ke hosting statis. Pengaturan umum: build command `npm run build`, output directory `dist`, Node 18 atau lebih baru.
   - **Netlify / Vercel / Cloudflare Pages**: hubungkan repositori, isi dua pengaturan di atas, deploy.
   - **GitHub Pages** (alamat `user.github.io/nama-repo/`): tambahkan `base: '/nama-repo/'` di `vite.config.ts` sebelum build, lalu publikasikan isi `dist/`.
3. Jangan mengisi `VITE_GOOGLE_WEB_APP_URL` di hosting publik: variabel `VITE_*` ikut tertanam di file JavaScript, sehingga siapa pun bisa membaca URL `/exec`-mu. Tempel URL lewat menu **Sumber data** di browser; URL itu tersimpan di browser tersebut saja.
4. Apps Script: tempel `google-apps-script/Code.gs`, **Deploy → New deployment → Web app**, Execute as **Me**, access **Anyone**. Setelah mengubah kode, pakai **Manage deployments → Edit → New version**. Aktifkan token akses (lihat bawah); tanpa itu, siapa pun yang punya URL `/exec` bisa membaca, menambah, dan menghapus data.


## Catatan UX

Beranda menjawab tiga hal berurutan: saldo tersedia (kartu utama), pengeluaran bulan ini, dan jumlah aman dipakai sampai akhir bulan (kartu Aman dipakai). Grafik 14 hari punya sumbu Rp, periode, keterangan saat kosong, dan batang yang bisa diketuk. Teks antarmuka tambahan ada di `src/i18n/ux.ts`. Tes: `e2e_ux.py` di skrip uji.

## Kekayaan bersih (Net Worth)

Menu **Perencanaan → Kekayaan bersih**. Rumus: **kekayaan bersih = total aset − total kewajiban** (contoh: aset Rp15 juta − utang Rp4 juta = Rp11 juta).

- **Aset**: saldo rekening (otomatis) + aset manual (tabungan, investasi, properti, kendaraan, piutang, dll.).
- **Kewajiban**: sisa utang dari Pelacak Utang (otomatis, yang lunas tidak dihitung) + kewajiban manual.
- **Label estimasi**: nilai manual yang tidak diperbarui lebih dari 30 hari (`STALE_DAYS` di `src/lib/networth.ts`) atau ditandai "perkiraan" diberi label *Estimasi*. Saldo rekening diberi label estimasi kalau belum ada **saldo awal** (saldo di aplikasi hanya selisih transaksi yang tercatat), belum ada transaksi, atau transaksi terakhirnya lebih dari 30 hari. Kalau ada estimasi, angka utama tampil dengan "≈", lencana Estimasi, dan persentase bagian yang masih estimasi.
- **Hindari hitung ganda**: kalau menambah aset manual yang sama dengan saldo rekening, matikan "Hitung saldo rekening otomatis"; utang yang sudah ada di Pelacak Utang jangan ditambah lagi sebagai kewajiban manual.
- **Riwayat**: satu catatan per hari, dibuat otomatis saat halaman dibuka setelah data selesai dimuat (hari yang terlewat tidak diisi). Grafik tampil setelah ada minimal 2 catatan.
- Penyimpanan: `budgettracker.networth.v1` (aset, kewajiban, saldo awal; ikut backup dan sinkron pengaturan) dan `budgettracker.nwhistory.v1` (riwayat; hanya ikut backup, supaya pencatatan harian tidak dianggap perubahan pengaturan). Blob sinkron lama yang belum mengenal Kekayaan bersih tidak menghapus datanya.

## Scan struk belanja

Di panel **Catat transaksi** ada tab ketiga **Scan struk**: pilih atau potret struk, lalu aplikasi mencoba membaca total, tanggal, nama toko, dan barang.

- **Foto tidak dikirim ke mana pun.** OCR (tesseract.js + data bahasa Indonesia) berjalan di browser, dan mesinnya disajikan dari situs sendiri (`/ocr`), bukan dari CDN. Unduhan sekitar 5 MB terjadi sekali saat pertama dipakai, lalu disimpan browser.
- **Hasil wajib diperiksa.** Layar pemeriksaan menampilkan foto di samping total, tanggal, toko, kategori, dan rekening. Bidang yang kurang diyakini ditandai **Periksa**, ada peringatan spesifik (total ditebak, total berbeda dari jumlah barang, tanggal ambigu/masa depan, foto kurang jelas), dan tidak ada yang tersimpan sebelum menekan Simpan. Aplikasi tidak mengarang nilai: kalau tidak terbaca, bidangnya kosong. Kemungkinan duplikat (tanggal dan total sama) diberi peringatan.
- Yang disimpan hanya total sebagai satu pengeluaran (barang hanya referensi; bisa ikut ke keterangan lewat centang). Kategori disarankan dari aturan kategori kamu, atau dari nama toko yang dikenal (Indomaret, Alfamart, Starbucks, SPBU, dll.), selain itu kamu yang memilih.
- Batas: akurasi bergantung pada foto (tegak lurus, terang, tidak buram). Struk berbahasa Indonesia format umum paling baik; struk dengan tata letak tidak biasa bisa salah baca, karena itu ada pemeriksaan.
- Teknis: `prebuild`/`predev` menjalankan `scripts/copy-ocr-assets.mjs` yang menyalin berkas OCR dari `node_modules` ke `public/ocr` (berkasnya ikut di-commit agar tersedia di hosting apa pun, tidak bergantung pada skrip build; `.gitattributes` mencegah Git mengubah isinya). CSP di `vercel.json` memakai `'wasm-unsafe-eval'` untuk WebAssembly mesin OCR. Safari/iOS 15 ke bawah tidak mengenal kata kunci itu dan memblokir WebAssembly, jadi khusus berkas di `/ocr/` (hanya dipakai worker OCR, bukan halaman) CSP-nya juga menyertakan `'unsafe-eval'`; halaman utama tetap tanpa itu. Kalau mesin gagal dimuat, layar Scan menampilkan "Detail teknis" (atau berhenti dengan galat setelah 45 detik tanpa kabar) supaya penyebabnya terlihat. Pembaca teks struk ada di `src/lib/receipt.ts` (tanpa regex lookbehind), pengolah foto dan OCR di `src/lib/receiptOcr.ts`.

## Pisah transaksi ke beberapa kategori

Di **Catat transaksi → Form lengkap → Pengeluaran**, tautan **Pisah ke beberapa kategori** membuka rincian 2 sampai 6 bagian (kategori + jumlah). Cocok untuk satu struk yang isinya beda kategori. Jumlah semua bagian **harus sama dengan total** (sisa atau kelebihan ditampilkan; tombol Simpan nonaktif sampai pas). Tiap bagian tersimpan sebagai transaksi sendiri dengan tanggal, rekening, dan keterangan yang sama, jadi laporan, anggaran, dan saldo tidak berubah cara hitungnya. Tidak tersedia untuk pemasukan, transfer, atau saat mengubah transaksi yang sudah ada. Riwayat aktivitas mencatatnya sebagai satu entri "impor" berisi jumlah baris. Logika di `src/lib/split.ts`.

## Ekspor hasil filter (CSV dan Excel)

Di halaman **Transaksi**, tombol **CSV** dan **Excel** di baris ringkasan mengunduh **persis transaksi yang tampil menurut filter saat ini** (bukan seluruh data). Menu Sumber data tetap punya ekspor semua transaksi.

- CSV: UTF-8 dengan BOM, pemisah koma, kolom `Date, Type, Category, Account, Description, Total (Rp)`, terbaru di atas. Keterangan yang diawali `= + - @` diberi tanda kutip tunggal di depan supaya Excel/Sheets tidak menjalankannya sebagai rumus. Kalau Excel versi Indonesia membuka CSV jadi satu kolom (pemisah daftar di Windows kadang titik koma), pakai tombol **Excel** atau impor lewat Data → From Text/CSV.
- Excel: format sama dengan template, jadi bisa diimpor kembali.
- Transfer antar rekening tidak ikut karena memang tidak tampil di daftar transaksi.

## Pasang di HP dan jalan offline (PWA)

Situs bisa dipasang sebagai aplikasi (Chrome Android: menu → Pasang aplikasi / Tambahkan ke layar utama; Safari iPhone: Bagikan → Tambah ke Layar Utama). Setelah dibuka sekali online:

- Aplikasi dan semua halamannya terbuka walau offline, dan catatan di browser tetap bisa dipakai. Sinkron Google Sheets menunggu internet; pemberitahuan "offline" muncul di pojok.
- **Scan struk** juga jalan offline setelah pernah dipakai sekali (mesin OCR disimpan setelah unduhan pertama).
- Saat online, halaman selalu diambil dari jaringan (versi terbaru); salinan tersimpan hanya cadangan kalau jaringan gagal atau lebih dari 4 detik.
- **Versi baru tidak dipasang diam-diam.** Kalau ada versi baru, muncul kartu "Versi baru tersedia" dengan tombol **Muat ulang**. Ditunda pun tidak apa-apa; isian formulir yang belum disimpan tidak hilang tiba-tiba.
- Service worker tidak menyentuh permintaan ke Google (Sheets/Apps Script) dan tidak menyimpan data transaksi, hanya berkas aplikasi.
- Teknis: `sw.js` dibuat saat build oleh `scripts/vite-sw-plugin.mjs` dari `scripts/sw-template.js` (daftar berkas + versi otomatis); didaftarkan di `src/lib/pwa.ts` hanya pada build produksi (tidak aktif saat `npm run dev`). `vercel.json` menandai `/sw.js` tanpa cache HTTP supaya pembaruan terdeteksi. Kalau perlu mencabut paksa dari browser: DevTools → Application → Service Workers → Unregister, lalu Clear site data.

## Performa

Halaman selain Beranda dimuat saat pertama dibuka (`src/components/pages.ts`), dan pustaka Excel hanya dimuat saat impor/ekspor. Bundel awal turun dari ±800 kB (225 kB gzip) menjadi ±495 kB (148 kB gzip). Setelah rilis baru, tab lama yang masih terbuka otomatis dimuat ulang sekali kalau berkas halamannya sudah diganti (`src/lib/lazyPage.ts`).

## Tampilan & palet warna

Tema memakai empat warna dasar: sage `#6A795D` (merek), olive `#8E9162`, lime `#B2BD7E`, dan krem `#FCF0DA` (latar). Warna turunan (gelap/terang) dibuat dari keempatnya agar teks kecil tetap lolos kontras WCAG AA — teks kecil memakai sage gelap `#505D44`, bukan sage murni. Pengeluaran ditampilkan netral dengan tanda −, pemasukan hijau. Font (Figtree & Bricolage Grotesque) di-host sendiri di `public/fonts` sehingga tetap tampil saat offline. Warna diatur di `tailwind.config.js`.

## Keamanan, tema, dan penyesuaian saldo

- **Kunci aplikasi (Pengaturan → Kunci aplikasi):** PIN 4–6 angka, disimpan sebagai hash PBKDF2 + salt acak (PIN tidak pernah tersimpan). Saat terkunci, aplikasi tidak dirender sama sekali. Setelah 5 kali salah ada jeda 30 detik yang berlipat (maks. 15 menit). **Lupa PIN** menghapus semua data lokal di perangkat itu (data di Google Sheets aman) setelah mengetik HAPUS. Batasan: ini menahan orang yang meminjam HP, bukan penyerang teknis, karena data di browser tidak dienkripsi.
- **Mode gelap (Pengaturan → Tampilan):** Terang, Gelap, atau ikut perangkat; tersimpan per perangkat. Warna berbasis variabel CSS (`src/theme-vars.css`) yang dibuat dari `scripts/theme-palette.json`; setelah mengubah palet jalankan `npm run theme`. Skrip `public/theme-init.js` mencegah layar berkedip terang saat tema gelap.
- **Urungkan hapus:** toast setelah menghapus transaksi punya tombol Urungkan (memakai pemulihan yang sama dengan halaman Riwayat).
- **Cocokkan saldo (Beranda → Rekening):** isi saldo asli bank/e-wallet, aplikasi menampilkan selisih dan mencatat transaksi kategori *Balance Adjustment*. Kategori ini mengubah saldo rekening tetapi tidak masuk total pemasukan/pengeluaran, grafik, anggaran, laporan, batas harian, maupun hitungan kebiasaan mencatat. Bila selisih ternyata pengeluaran/pemasukan yang lupa dicatat, centang opsi untuk menghitungnya sebagai transaksi biasa (kategori Others).
