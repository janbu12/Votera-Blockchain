# Voting BEM DApp

Aplikasi voting BEM berbasis blockchain dengan role Admin dan Mahasiswa.

## Arsitektur Singkat
- `contracts/` smart contract (Hardhat) untuk multi-event voting.
- `backend/` Express + Prisma + PostgreSQL untuk auth mahasiswa dan signature voting.
- `frontend/` Next.js + wagmi untuk UI admin/mahasiswa.

## Fitur Utama
- Admin: buat event, tambah kandidat, open/close pemilihan, edit/hide kandidat.
- Mahasiswa: login NIM+password (wajib ganti password), connect wallet, vote.
- Proteksi 1 NIM = 1 vote (signature backend, verifikasi on-chain).

## Prasyarat
- Node.js
- PostgreSQL
- Metamask

## Setup Backend (Auth + Signature)
1) Masuk ke folder `backend` dan install deps.
2) Siapkan env `backend/.env` dari `backend/.env.example`:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `SIGNER_PRIVATE_KEY` (private key wallet signer backend)
   - `VOTING_CONTRACT_ADDRESS` (alamat contract yang sudah deploy)
   - `RPC_URL` (URL RPC chain lokal/remote)
3) Jalankan Prisma:
   - `npm run db:migrate`
   - `npm run db:generate`
   - `npm run db:seed`
4) Start backend:
   - `npm run dev`

## Setup Contracts
1) Masuk folder `contracts`.
2) Compile: `npx hardhat compile`.
3) Deploy: `npx hardhat run scripts/deploy-multi.ts --network <network>`.
4) Set signer di contract:
   - Panggil `setSigner(<address signer backend>)` dengan wallet admin.
5) Sync ABI ke frontend:
   - `npm run sync-abi`

Catatan: `contracts/scripts/deploy-multi.ts` otomatis menulis `NEXT_PUBLIC_VOTING_ADDRESS` ke `frontend/.env` dan menjalankan sync ABI.

## Setup Frontend
1) Masuk folder `frontend`.
2) Siapkan env `frontend/.env` dari `frontend/.env.example`:
   - `NEXT_PUBLIC_PROJECT_ID` (WalletConnect)
   - `NEXT_PUBLIC_VOTING_ADDRESS` (alamat contract)
3) Jalankan frontend:
   - `npm run dev`

## Alur Penggunaan
- Admin:
  - Login lewat halaman `/login` (wallet admin).
  - Masuk `/admin` untuk kelola event/kandidat.
- Mahasiswa:
  - Login NIM+password di `/login`.
  - Ganti password jika diminta.
  - Connect wallet untuk voting.
  - Pilih event open, masuk voting, lalu vote kandidat.

## Notes Penting
- Jika ABI berubah, jalankan `contracts/scripts/sync-abi.mjs`.
- Pastikan `SIGNER_PRIVATE_KEY` dan `VOTING_CONTRACT_ADDRESS` sesuai contract yang aktif.
- Reset seed mahasiswa mengembalikan password ke `mahasiswa123`.
