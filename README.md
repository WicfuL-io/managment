# APK Management — React + TypeScript + Google Sheets

Project ini menggunakan React TSX + Vite untuk frontend dan Google Apps Script sebagai API. Google Sheets menjadi database utama. Dashboard, stok, POS, keuangan, manajemen pengguna, hak akses, dan log login membaca/menulis data melalui API Apps Script.

## 1. Siapkan Google Sheets
1. Buat Google Spreadsheet baru.
2. Salin Spreadsheet ID dari URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`.
3. Buka Extensions → Apps Script.
4. Salin isi `google-apps-script/Code.gs` ke `Code.gs`.
5. Ganti `PASTE_GOOGLE_SPREADSHEET_ID` dengan ID spreadsheet.
6. Pilih fungsi `setupSheets` lalu klik Run dan berikan izin.
7. Pada fungsi `createFirstAdmin`, ganti `admin@example.com`, `GANTI_PASSWORD_ADMIN_MINIMAL_8_KARAKTER`, dan nama admin. Jalankan fungsi tersebut SATU KALI. Jangan biarkan password contoh.
8. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone. Deploy dan salin URL `/exec`.

Sheet yang dibuat otomatis: Users, LoginLogs, ActivityLogs, Items, StockBatches, StockMovements, IncomeCategories, ExpenseCategories, Transactions, Settings.

## 2. Jalankan React
```bash
npm install
```
Salin `.env.example` menjadi `.env`, lalu isi:
```env
VITE_API_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```
Jalankan:
```bash
npm run dev
```
Build produksi:
```bash
npm run build
```

Jika Code.gs diubah setelah deploy, buka Deploy → Manage deployments → Edit → pilih New version → Deploy. URL Web App biasanya tetap sama.

## 3. Alur fitur
- Register: akun baru masuk status `pending`, tidak bisa login sebelum admin menyetujui.
- Login: mencatat waktu, IP publik (jika layanan IP dapat diakses), jenis perangkat, browser, platform, user-agent, bahasa, ukuran layar, dan zona waktu.
- Dashboard: ringkasan, grafik 6 bulan, stok, nilai persediaan, transaksi, expired, dan aktivitas berasal dari spreadsheet.
- Stok: batch barang masuk dengan kombinasi nama + tanggal beli + expired unik; barang keluar mengurangi batch dan mencatat pergerakan.
- POS: checkout mengurangi stok dan mencatat pemasukan otomatis.
- Keuangan: kategori pemasukan dan pengeluaran disimpan di sheet terpisah; transaksi tersimpan di Transactions.
- Admin: persetujuan akun, blokir/aktifkan akun, hak akses per akun, log login dan aktivitas.

## Catatan keamanan dan batasan
- Jangan pernah membagikan Spreadsheet ID, URL deployment privat, atau password admin.
- Web App memakai token sesi 6 jam di CacheService. Cache dapat hilang sewaktu-waktu sehingga pengguna mungkin perlu login ulang.
- IP yang dicatat adalah IP publik yang didapat dari browser melalui layanan eksternal. Apps Script tidak dapat membaca IMEI, MAC address, serial number, atau lokasi GPS perangkat secara langsung. Informasi tersebut sengaja tidak diklaim tersedia.
- Hash password pada contoh menggunakan SHA-256 + salt. Untuk sistem produksi dengan data sensitif/keuangan, pertimbangkan backend dengan password hashing khusus seperti bcrypt/Argon2, rate limiting, dan audit keamanan.
- POS versi ini menggunakan harga jual yang diinput saat checkout. Setiap checkout dicatat sebagai satu transaksi pemasukan dan pengurangan stok.
- Apps Script memiliki batas kuota dan Google Sheets bukan database transaksional. Untuk skala besar/multi-kasir bersamaan, gunakan database server.
