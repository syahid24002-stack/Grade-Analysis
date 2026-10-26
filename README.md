# Agrade (React + Supabase + Vercel)

Versi baru aplikasi Agrade yang berjalan di **Vercel** dengan **Supabase** (login, database, keamanan), tampilan gaya LifeOS.
Fitur sama seperti versi Apps Script: unggah CSV nilai, pemetaan soal ke materi, batas Lemah/Kuat, terbitkan hasil, analisis
(keseluruhan, per cabang, per individu, kesulitan soal), hasil siswa dengan nama peserta lain disamarkan "xxxx", kelola user.

## Fitur tambahan (v3.2)
- **Unduh Excel (.xlsx) multi-sheet**: analisis lengkap (ringkasan, per cabang, materi, butir soal, per individu, perlu perhatian), daftar peringkat, dan perbandingan ujian.
- **Rapor massal PDF**: cetak rapor semua siswa (satu per halaman) per cabang atau sesuai filter, lewat "Simpan sebagai PDF".
- **Ringkasan otomatis (insight)**, **daftar siswa perlu perhatian**, dan **daya beda butir soal** (menandai soal yang kuncinya patut diperiksa).
- **Bandingkan dua ujian**: siapa naik/turun, sebaran perubahan, per cabang dan per materi.
- **Pencapaian siswa** (peringkat 3 besar, nilai naik berturut-turut, dsb.).
- **UX**: seret-dan-lepas CSV dengan pratinjau, templat CSV, tabel bisa diurutkan, dialog konfirmasi, skeleton loading.
- Tidak ada perubahan database dari v3.1, jadi tidak perlu SQL baru.

## Fitur tambahan (v3.1)
- **Grafik perkembangan nilai** di halaman siswa (nilaimu vs rata-rata tiap ujian) dan **grafik rata-rata per ujian** di dashboard admin.
- **Rencana belajar** otomatis: materi yang belum kuat beserta nomor soal yang salah atau kosong.
- **Cetak / simpan PDF** laporan hasil per siswa (tombol "Cetak / PDF", pilih "Simpan sebagai PDF").
- **Riwayat siswa** (admin): nilai satu siswa di semua ujian, grafik, dan ekspor CSV.
- **Log aktivitas** (admin): siapa melakukan apa dan kapan.

**Sudah pakai versi sebelumnya?** Jalankan `supabase/migrasi-v2.sql` sekali di SQL Editor, lalu timpa berkas proyek (jangan hapus `.env`).

## Struktur
- `src/` aplikasi React (halaman admin dan siswa). `src/lib/score.js` berisi seluruh logika perhitungan.
- `api/` fungsi server Vercel: `register`, `admin-users` (tambah/impor/reset/hapus user), `my-assessments`, `my-result`.
- `supabase/schema.sql` tabel, aturan keamanan (RLS), dan fungsi database.

## 1. Siapkan Supabase
1. Buat proyek di https://supabase.com.
2. **SQL Editor > New query**: tempel seluruh `supabase/schema.sql`, klik Run.
3. **Authentication > Sign In / Providers**: matikan **Allow new users to sign up** (pendaftaran lewat `/api/register` agar saklar "Izinkan orang mendaftar sendiri" berlaku). Email provider tetap aktif.
4. **Project Settings > API**: salin Project URL, anon/publishable key, dan **service_role key** (rahasia).

## 2. Jalankan di komputer (opsional)
```bash
npm install
cp .env.example .env     # isi semua nilai
npx vercel dev           # agar /api ikut berjalan (npm run dev hanya frontend)
```

## 3. Deploy ke Vercel
1. Unggah folder ini ke repo GitHub, lalu **Vercel > Add New > Project** dan impor repo.
2. **Environment Variables** (semua dibutuhkan):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` (sama dengan di atas), `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_EMAILS` (mis. `syahidfatlan@gmail.com`; email ini otomatis ADMIN saat mendaftar)
3. Deploy. Buka situs, tab **Daftar** dengan email admin, selesai: kamu masuk sebagai ADMIN.
   Bila akun sudah ada, jalankan di SQL Editor: `update public.profiles set role='ADMIN' where email='emailmu';`

`SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di folder `api/` (server). Jangan beri awalan `VITE_`.

## Memindahkan data dari versi lama
- **Nilai**: tidak perlu migrasi. Unggah ulang CSV tiap ujian di **Ujian & Nilai**, lalu atur materi dan terbitkan.
- **User**: password lama tersimpan sebagai hash dan tidak bisa dipindah. Impor ulang lewat **Users > Impor CSV**
  (kolom `name,email,password,branch`, opsional `role`) atau minta siswa mendaftar sendiri.

## Perbedaan dari versi Apps Script
- Login Google dihapus (di Apps Script hanya jalan untuk Google Workspace).
- User nonaktif benar-benar tidak bisa login (diblokir di Supabase Auth).
- Admin tidak bisa mengubah role, status, atau menghapus akunnya sendiri.
- CSV dengan pemisah titik koma (Excel Indonesia) dan nilai desimal koma ikut terbaca.
- Sel jawaban soal yang kosong ditandai "-" (tidak dihitung benar/salah/kosong) agar nomor soal tetap sejajar.

## Keamanan
Siswa tidak punya akses langsung ke tabel `scores`/`assessments` (RLS). Hasil siswa dihitung di `/api/my-result`, sehingga hanya
datanya sendiri yang dikirim dan nama lain sudah "xxxx" sebelum sampai browser.

## Tes
`npm test` menguji pembaca CSV dan logika nilai (termasuk memastikan data siswa lain tidak bocor).
