# Rancang Bangun E‑Voting Organisasi Kemahasiswaan pada Jaringan Blockchain Konsorsium Menggunakan Hyperledger Besu dan Mekanisme Relayer

**Votera** adalah aplikasi e‑voting organisasi kemahasiswaan berbasis blockchain dengan peran **Admin** dan **Mahasiswa**.
Fokus utama: transparansi hasil, validasi identitas pemilih, dan jejak audit admin.
Implementasi ini dapat diterapkan untuk BEM, HIMA, atau organisasi kampus lainnya.

---

## Nama Aplikasi: VOTERA
**VOTERA** dipilih sebagai nama aplikasi karena:
- Berasal dari kata **Vote** + **Era**, menekankan pergeseran ke voting digital yang modern.
- Netral dan bisa dipakai untuk berbagai organisasi kemahasiswaan (tidak terbatas BEM).
- Mudah diingat, singkat, dan cocok untuk branding aplikasi kampus.

---

## Tipe Jaringan (Konsorsium/Permissioned)
Aplikasi ini **dirancang sebagai sistem konsorsium/permissioned** untuk kebutuhan kampus.
- Identitas pemilih diverifikasi **off-chain** (database kampus).
- Voting dikirim melalui **relayer backend** (mahasiswa tidak wajib wallet).
- Akses dan proses administrasi dikendalikan oleh admin kampus.

Implementasi blockchain menggunakan **Hyperledger Besu (IBFT)** sebagai jaringan privat kampus.
Secara default proyek juga bisa diuji di jaringan lokal (Hardhat).

---

## Arsitektur Singkat
- `campus-service/` — service data mahasiswa kampus (auth mahasiswa + foto resmi).
- `contracts/` — smart contract (Hardhat) untuk multi-event voting.
- `backend/` — Express + Prisma + PostgreSQL (integrasi campus service, verifikasi selfie, relayer transaksi).
- `frontend/` — Next.js + wagmi untuk UI admin/mahasiswa.

---

## Alur Data (End-to-End)
**1) Autentikasi & sesi**
- Mahasiswa login via backend (NIM + password) → backend validasi ke `campus-service` → backend buat session/token → frontend simpan session.
- Admin/Superadmin login → backend verifikasi credential → token admin.

**2) Verifikasi identitas mahasiswa**
- Mahasiswa upload selfie → backend simpan file + status verifikasi `PENDING` di DB.
- Foto resmi mahasiswa diambil dari `campus-service` sebagai pembanding saat review admin.
- Admin review di `/admin/verifications` → backend update status (`VERIFIED/REJECTED`) + audit log.
- Jika `VERIFIED`, mahasiswa boleh ganti password dan membuka akses menu lainnya.

**3) Manajemen event & kandidat**
- Admin membuat event/kandidat di UI → backend validasi → **tx on-chain** via relayer.
- Backend menulis log aksi admin + snapshot tambahan di DB (untuk UI, audit, dan cache).

**4) Penjadwalan & status event**
- Admin set jadwal → backend kirim `setElectionSchedule` → tunggu mined → `setElectionMode`.
- Status open/closed dibaca dari kontrak dan/atau sync backend (auto-close) → ditampilkan ke UI.

**5) Voting (mode relayer)**
- Mahasiswa pilih kandidat → frontend kirim request ke backend.
- Backend hash NIM → kirim transaksi `voteByRelayer` ke kontrak.
- Kontrak cek 1 NIM = 1 vote, simpan suara on-chain → backend simpan receipt/tx hash (opsional).

**6) Hasil & publikasi**
- Admin finalize/publish → backend ambil snapshot hasil dari on-chain → simpan ke DB.
- Mahasiswa melihat hasil resmi via `/hasil`; progress publik opsional via `/progres`.

**7) Audit & monitoring**
- Setiap aksi admin dicatat di DB (audit log) → bisa diekspor / dilihat statistik harian.
- Backend cek RPC/relayer status + saldo untuk monitoring.

---

## Fitur Utama
**Admin**
- Kelola event: buat event, jadwal, open/close, mode manual/production.
- Kelola kandidat: tambah, edit, hide kandidat + foto & profil.
- Verifikasi mahasiswa (foto resmi kampus vs selfie).
- Audit log admin + ringkasan aktivitas.
- Hasil pemilihan: finalize & publish, export CSV/XLSX.
- Monitoring RPC/relayer + saldo signer.
- **Superadmin**: kelola akun admin (tambah/aktif-nonaktif, reset password).

**Mahasiswa**
- Login NIM + password (wajib ganti password setelah diverifikasi).
- Upload selfie untuk verifikasi (foto resmi dari kampus dipakai sebagai acuan).
- Voting tanpa Metamask (mode relayer).
- Riwayat voting + status tx hash (jika tersedia).

---

## Pembaruan Fitur (Highlight)
- **Polling realtime** untuk status voting, jadwal event, riwayat, hasil, dan progress.
- **Perbandingan kandidat (Versus)** di halaman mahasiswa (profil lengkap tanpa suara).
- **Hasil resmi** dengan kartu kandidat berfoto + chart persebaran suara.
- **Progress publik anonim** (tanpa identitas pemilih).
- **Toast & modal UX** ditingkatkan (toast selalu di atas modal, modal auto-close saat sukses).
- **Superadmin** untuk manajemen akun admin + audit log ringkas.

---

## Konsep Blockchain yang Digunakan
- **On-chain election state**: event, kandidat, dan status pemilihan dicatat di smart contract.
- **Relayer**: transaksi voting dikirim oleh backend (mahasiswa tidak perlu wallet).
- **1 NIM = 1 vote**: backend membuat hash NIM, contract memastikan tidak ada duplikasi vote.
- **Finalisasi & publikasi hasil**: snapshot hasil disimpan agar konsisten dan dapat diaudit.

### Teknologi Blockchain
- **Hyperledger Besu (IBFT)** untuk jaringan konsorsium.
- **EVM Compatible**: kontrak ditulis di Solidity dan kompatibel dengan jaringan EVM privat.
- **Hardhat** untuk pengembangan lokal dan scripting deployment.
- **RPC Provider**: backend memakai `RPC_URL` untuk akses chain.
- **Wallet Relayer**: backend memakai `SIGNER_PRIVATE_KEY` untuk transaksi write.
- **Wagmi** di frontend untuk interaksi read (dan debug) ke chain.

---

## Prasyarat
- Node.js
- PostgreSQL
- Java 21 (untuk Besu)
- Hyperledger Besu

---

## Setup Hyperledger Besu (IBFT) Lokal

> Catatan: folder hasil generate **besu-network-gen** bersifat lokal (jangan masuk repo).

### 1) Konfigurasi IBFT
Template konfigurasi ada di `besu-network/ibftConfig.json`.
Contoh pengaturan:
- `chainId`: 1337 (atau 7777, **harus konsisten** di backend/frontend/Metamask)
- `blockperiodseconds`: 2-5
- `validators`: jumlah node validator (contoh ideal: **4 validator**)

### 2) Generate genesis + key validator
Jalankan (contoh Windows PowerShell):

```powershell
besu operator generate-blockchain-config `
  --config-file="E:\Kuliah\Semester 7\Block Chain\voting-bem\besu-network\ibftConfig.json" `
  --to="E:\Kuliah\Semester 7\Block Chain\voting-bem\besu-network-gen-4" `
  --private-key-file-name=key
```

Output penting:
- `besu-network-gen-4/genesis.json`
- `besu-network-gen-4/keys/<address>/key` (private key validator)

### 3) Buat key relayer (private key + address)
Relayer adalah wallet backend untuk menandatangani transaksi. Buat key baru dengan Node:

```powershell
cd "E:\Kuliah\Semester 7\Block Chain\voting-bem\contracts"
node -e "const { randomBytes } = require('crypto'); const { privateKeyToAccount } = require('viem/accounts'); const pk='0x'+randomBytes(32).toString('hex'); const acc=privateKeyToAccount(pk); console.log('PRIVATE_KEY=', pk); console.log('ADDRESS=', acc.address);"
```

Simpan:
- `PRIVATE_KEY` → untuk `SIGNER_PRIVATE_KEY` (backend).
- `ADDRESS` → dimasukkan ke `alloc` genesis.

> Opsional: jika kontrak sudah ter-deploy, gunakan `setSigner(address)` oleh admin untuk mengganti signer ke address relayer baru.

### 4) Tambahkan alloc untuk relayer/admin
Edit `besu-network-gen-4/genesis.json` bagian `alloc` dengan address yang butuh saldo.
Contoh:

```json
"alloc": {
  "21d711fbf434f4366b842da1721af820ed07c633": { "balance": "1000000000000000000000000" },
  "c4340660ac0a5cfaab744be93c97e6c47f608002": { "balance": "1000000000000000000000000" }
}
```

Setelah edit genesis, **hapus** data lama agar perubahan berlaku:
```
E:\Kuliah\Semester 7\Block Chain\voting-bem\besu-network-gen-4\data
```

### 5) Jalankan 4 Validator + 1 RPC (Arsitektur Ideal)
Struktur ideal: **4 validator (konsensus IBFT)** + **1 RPC node (non-validator)**.
Gunakan skrip yang sudah disediakan di `besu-network/`.

**Langkah A — Jalankan validator #1 untuk dapat enode**
```powershell
besu --data-path="<project>\besu-network-gen-4\data\val1" `
  --genesis-file="<project>\besu-network-gen-4\genesis.json" `
  --node-private-key-file="<project>\besu-network-gen-4\keys\<validator1_address>\key" `
  --p2p-port=30303 `
  --rpc-http-enabled=false `
  --min-gas-price=0
```
Catat `Enode URL` di log, lalu isi ke `besu-network/static-nodes.json`.

**Langkah B — Jalankan 4 validator otomatis**
```powershell
.\besu-network\start-validators.ps1
```
Jika validator #1 sudah running manual, gunakan:
```powershell
.\besu-network\start-validators.ps1 -SkipVal1
```

**Langkah C — Jalankan RPC node (non-validator)**
```powershell
.\besu-network\start-rpc.ps1
```

RPC node akan berjalan di `http://127.0.0.1:8545`.

Cek status:
```powershell
curl -X POST http://127.0.0.1:8545 `
  -H "Content-Type: application/json" `
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_blockNumber\",\"params\":[]}"
```

### 6) (Opsional) Tambah network di MetaMask
- Network Name: `Besu Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `1337`
- Currency: `ETH`

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

## Setup Campus Service
1) Masuk folder `campus-service`, install deps:
   - `npm install`
2) Siapkan env `campus-service/.env` dari `campus-service/.env.example`:
   - `CAMPUS_SERVICE_PORT`
   - `CAMPUS_SERVICE_TOKEN`
   - `CAMPUS_PUBLIC_BASE_URL`
3) Jalankan service:
   - `npm run dev`
4) Verifikasi health:
   - `GET http://localhost:4100/health`

Catatan: data mahasiswa demo ada di `campus-service/src/students.js`, termasuk foto resmi statis di `campus-service/public/photos`.

---

## Setup Backend
1) Masuk folder `backend`, install deps:
   - `npm install`
2) Siapkan env `backend/.env` dari `backend/.env.example`:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `ADMIN_JWT_SECRET`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`
   - `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` (untuk kelola akun admin)
   - `SIGNER_PRIVATE_KEY` (wallet relayer)
   - `VOTING_CONTRACT_ADDRESS`
   - `RPC_URL`
   - `CAMPUS_SERVICE_URL`
   - `CAMPUS_SERVICE_TOKEN`
   - `CAMPUS_SERVICE_TIMEOUT_MS`
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
- **Superadmin**: kelola akun admin di menu **Admin** (mis. `/admin/users`).

**Mahasiswa**
- Login NIM + password.
- Upload selfie untuk verifikasi (foto resmi dari kampus ditarik otomatis).
- Setelah diverifikasi, ganti password.
- Masuk event aktif dan lakukan voting.
---

## Troubleshooting
- Pastikan `SIGNER_PRIVATE_KEY` & `VOTING_CONTRACT_ADDRESS` valid.
- Pastikan `campus-service` aktif sebelum login mahasiswa di VOTERA.
- Jika ABI berubah, jalankan `contracts/scripts/sync-abi.mjs`.
- `db:seed` backend hanya menyiapkan record lokal; password login mahasiswa tetap mengikuti data di `campus-service`.
