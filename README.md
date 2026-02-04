# Voting BEM DApp

Aplikasi voting BEM berbasis blockchain dengan peran **Admin** dan **Mahasiswa**.  
Fokus utama: transparansi hasil, validasi identitas pemilih, dan jejak audit admin.

---

## Tipe Jaringan (Konsorsium/Permissioned)
Aplikasi ini **dirancang sebagai sistem konsorsium/permissioned** untuk kebutuhan kampus.
- Identitas pemilih diverifikasi off-chain (database kampus).
- Voting dikirim melalui relayer backend (mahasiswa tidak wajib wallet).
- Akses dan proses administrasi dikendalikan oleh admin kampus.

Secara default proyek diuji di jaringan lokal (Hardhat).  
Jaringan produksi ditentukan oleh `RPC_URL` dan alamat contract pada backend.

---

## Arsitektur Singkat
- `contracts/` — smart contract (Hardhat) untuk multi-event voting.
- `backend/` — Express + Prisma + PostgreSQL (auth mahasiswa, verifikasi identitas, relayer transaksi).
- `frontend/` — Next.js + wagmi untuk UI admin/mahasiswa.

---

## Fitur Utama
**Admin**
- Kelola event: buat event, jadwal, open/close, mode manual/production.
- Kelola kandidat: tambah, edit, hide kandidat + foto & profil.
- Verifikasi mahasiswa (upload kartu & selfie).
- Audit log admin + ringkasan aktivitas.
- Hasil pemilihan: finalize & publish, export CSV/XLSX.
- Monitoring RPC/relayer + saldo signer.

**Mahasiswa**
- Login NIM + password (wajib ganti password setelah diverifikasi).
- Upload kartu mahasiswa & selfie untuk verifikasi.
- Voting tanpa Metamask (mode relayer).
- Riwayat voting + status tx hash (jika tersedia).

---

## Konsep Blockchain yang Digunakan
- **On-chain election state**: event, kandidat, dan status pemilihan dicatat di smart contract.
- **Relayer**: transaksi voting dikirim oleh backend (mahasiswa tidak perlu wallet).
- **1 NIM = 1 vote**: backend membuat hash NIM, contract memastikan tidak ada duplikasi vote.
- **Finalisasi & publikasi hasil**: snapshot hasil disimpan agar konsisten dan dapat diaudit.

### Teknologi Blockchain
- **EVM Compatible**: Kontrak ditulis di Solidity dan kompatibel dengan Ethereum/Polygon/BNB Chain, dsb.
- **Hardhat** untuk pengembangan lokal dan scripting deployment.
- **RPC Provider**: backend memakai `RPC_URL` untuk akses chain (lokal/testnet/mainnet).
- **Wallet Relayer**: backend menggunakan private key signer untuk transaksi (write) ke contract.
- **Wagmi** di frontend untuk interaksi read (dan debug) ke chain.

### Pilihan Network
- **Hardhat local**: cepat dan tanpa biaya (default dev).
- **Jaringan privat/konsorsium EVM**: disarankan untuk kampus.
- **Testnet EVM**: opsional untuk simulasi publik.

---

## Penjelasan Aplikasi (Detail)
**Tujuan**  
Memberikan sistem pemilihan BEM yang transparan namun tetap menjaga validasi identitas pemilih.  
Blockchain dipakai untuk memastikan data pemilihan tidak dapat diubah dan hasil dapat diaudit.

**Alur Mahasiswa**
1) Login menggunakan NIM + password awal.
2) Upload kartu mahasiswa & selfie untuk verifikasi identitas.
3) Setelah diverifikasi admin → wajib ganti password.
4) Masuk event aktif → pilih kandidat → voting.

**Alur Admin**
1) Login admin.
2) Membuat event pemilihan + kandidat.
3) Menjadwalkan event (mode production) atau manual (simulasi).
4) Memverifikasi mahasiswa (approve/reject).
5) Memantau progres dan menutup event.
6) Finalisasi & publikasi hasil (opsional export CSV/XLSX).

**Keamanan Data**
- Identitas mahasiswa disimpan di database (Postgres) untuk proses verifikasi.
- NIM hanya dipakai sebagai **hash** di blockchain untuk mencegah duplikasi vote.
- Hasil akhir disimpan sebagai snapshot agar konsisten meski chain berubah.

---

## Prasyarat
- Node.js
- PostgreSQL
- Hardhat (lokal) / RPC publik (testnet/mainnet)

---

## Setup Contracts
1) Masuk folder `contracts`.
2) Install deps: `npm install`.
3) Compile: `npx hardhat compile`.
4) Deploy: `npx hardhat run scripts/deploy-multi.ts --network <network>`.
5) Sync ABI ke frontend:
   - `npm run sync-abi`

Catatan: script deploy menulis alamat contract ke env frontend dan menjalankan sync ABI.

---

## Setup Backend
1) Masuk folder `backend`, install deps:
   - `npm install`
2) Siapkan env `backend/.env` dari `backend/.env.example`:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `ADMIN_JWT_SECRET`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`
   - `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`
   - `SIGNER_PRIVATE_KEY` (wallet relayer)
   - `VOTING_CONTRACT_ADDRESS`
   - `RPC_URL`
3) Jalankan Prisma:
   - `npm run db:migrate`
   - `npm run db:generate`
   - `npm run db:seed`
4) Dev:
   - `npm run dev`
5) Build & start:
   - `npm run build`
   - `npm run start`

---

## Setup Frontend
1) Masuk folder `frontend`, install deps:
   - `npm install`
2) Siapkan env `frontend/.env` dari `frontend/.env.example`:
   - `NEXT_PUBLIC_BACKEND_URL`
   - `NEXT_PUBLIC_VOTING_ADDRESS`
   - `NEXT_PUBLIC_STUDENT_MODE=relayer`
3) Jalankan frontend:
   - `npm run dev`

---

## Alur Penggunaan
**Admin**
- Login via `/login`.
- Kelola event & kandidat di `/admin`.
- Verifikasi mahasiswa di `/admin/verifications`.
- Finalisasi & publish hasil di `/admin/history`.

**Mahasiswa**
- Login NIM + password.
- Upload kartu & selfie untuk verifikasi.
- Setelah diverifikasi, ganti password.
- Masuk event aktif dan lakukan voting.

---

## Troubleshooting
- Pastikan `SIGNER_PRIVATE_KEY` & `VOTING_CONTRACT_ADDRESS` terisi valid.
- Jika ABI berubah, jalankan `contracts/scripts/sync-abi.mjs`.
- Reset seed mahasiswa mengembalikan password ke `mahasiswa123`.
