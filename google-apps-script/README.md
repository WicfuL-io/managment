# Google Apps Script Setup

1. Buat Google Spreadsheet dan salin Spreadsheet ID dari URL.
2. Buka Extensions → Apps Script.
3. Tempel isi `Code.gs`, lalu isi konstanta `SPREADSHEET_ID`.
4. Jalankan `setupSheets()` sekali dari editor Apps Script dan berikan izin.
5. Pada `createFirstAdmin()`, ubah nama, email, dan password contoh. Jalankan fungsi itu satu kali untuk membuat administrator pertama.
6. Deploy → New deployment → Web app: Execute as **Me**, akses **Anyone** (endpoint publik, tetapi setiap operasi privat memerlukan token dan pemeriksaan role/permission).
7. Salin URL `/exec` ke `.env` frontend sebagai `VITE_API_URL`.
8. Jika mengubah Code.gs setelah deploy, Manage deployments → Edit → New version → Deploy.

Sheet yang dibuat: Users, LoginLogs, ActivityLogs, Items, StockBatches, StockMovements, IncomeCategories, ExpenseCategories, Transactions, Settings.

## Log perangkat
IP publik diminta dari ipify oleh browser dan dikirim sebagai bagian metadata login. Nilai ini dapat tidak tersedia atau dimanipulasi oleh client. Browser tidak dapat membaca IMEI, MAC address, serial number, atau identitas hardware unik. Metadata yang dicatat: user-agent, perkiraan jenis perangkat, browser, platform, bahasa, resolusi layar, zona waktu, IP publik jika tersedia, waktu, email, dan event login.

## Catatan keamanan
Kode contoh menggunakan SHA-256 + salt dan CacheService untuk session 6 jam. Untuk produksi, tambahkan rate limiting/brute-force protection, gunakan password KDF seperti bcrypt/Argon2 melalui backend khusus, lakukan backup spreadsheet, batasi editor spreadsheet, dan audit keamanan. CacheService dapat kedaluwarsa sewaktu-waktu sehingga user mungkin perlu login ulang. Google Sheets bukan database transaksional untuk beban multi-user tinggi.
