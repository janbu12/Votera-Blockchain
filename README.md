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
- `face-service/` — service verifikasi wajah lokal (FastAPI + `facenet-pytorch` / MTCNN + FaceNet embedding, CPU).
- `contracts/` — smart contract (Hardhat) untuk multi-event voting.
- `backend/` — Express + Prisma + PostgreSQL (integrasi campus service, verifikasi selfie, relayer transaksi).
- `frontend/` — Next.js + wagmi untuk UI admin/mahasiswa.

---

## Alur Data (End-to-End)
**1) Autentikasi & sesi**
- Mahasiswa login via backend (NIM + password) → backend validasi ke `campus-service` → backend buat session/token → frontend simpan session.
- Admin/Superadmin login → backend verifikasi credential → token admin.

**2) Verifikasi identitas mahasiswa**
- Mahasiswa upload selfie (untuk verifikasi akun) → backend simpan file + status verifikasi `PENDING` di DB.
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
- Mahasiswa pilih kandidat → frontend buka modal kamera (step-up selfie) lalu kirim request ke backend.
- Backend ambil foto resmi dari `campus-service`, lalu verifikasi wajah ke `face-service`.
- Jika verifikasi wajah lolos (score >= threshold), backend meminta verifikasi passkey/WebAuthn.
- Jika passkey lolos, backend hash NIM dan kirim transaksi `voteByRelayer` ke kontrak.
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
- **Step-up verifikasi selfie sebelum vote** (capture kamera -> verifikasi -> submit vote).
- **Fingerprint/Passkey (WebAuthn)** sebagai langkah verifikasi kedua sebelum vote.
- **Face matching real open-source** memakai FastAPI + facenet-pytorch (MTCNN + FaceNet, CPU local) dengan mode `mock` sebagai fallback demo.
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
- Python 3.10+
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
   - `SIGNED_URL_SECRET`
   - `SIGNED_URL_TTL_SECONDS`
3) Jalankan service:
   - `npm run dev`
4) Verifikasi health:
   - `GET http://localhost:4100/health`

Catatan: data mahasiswa demo ada di `campus-service/src/students.js`, termasuk foto resmi statis di `campus-service/public/photos`.

---

## Setup Face Service (FastAPI + facenet-pytorch)
1) Masuk folder `face-service`.
2) Buat virtualenv dan install dependency:
   - Disarankan Python `3.10` atau `3.11`.
   - `python -m venv .venv`
   - Linux/macOS: `source .venv/bin/activate`
   - Windows PowerShell: `.venv\Scripts\Activate.ps1`
   - Windows alternatif: `py -3.10 -m venv .venv`
   - `pip install -r requirements.txt`
3) Siapkan env `face-service/.env` dari `face-service/.env.example`:
   - `FACE_SERVICE_PORT`
   - `FACE_SERVICE_TOKEN`
   - `FACE_SERVICE_MODEL_NAME`
   - `FACE_SERVICE_TIMEOUT_MS`
4) Jalankan service:
   - `python src/run.py`
5) Verifikasi health:
   - `GET http://localhost:4200/health`

Catatan:
- Fase 1 belum memakai anti-spoof model khusus.
- Untuk akurasi demo, foto resmi kampus sebaiknya `.jpg/.jpeg/.png` (bukan `.svg`).

---

## Urutan Menjalankan Service (Local Dev)
1) `campus-service` (port 4100)
2) `face-service` (port 4200)
3) `backend` (port 4000)
4) `frontend` (port 3000)

Jika salah satu service di atas mati, alur vote-verification akan gagal (hard-block).

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
   - `FACE_PROVIDER_MODE`
   - `FACE_PROVIDER_TIMEOUT_MS`
   - `FACE_MATCH_THRESHOLD`
   - `FACE_SERVICE_URL`
   - `FACE_SERVICE_TOKEN`
   - `WEBAUTHN_RP_ID`
   - `WEBAUTHN_RP_NAME`
   - `WEBAUTHN_ORIGINS`
   - `WEBAUTHN_REQUIRED_FOR_VOTE`
   - `WEBAUTHN_TIMEOUT_MS`
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
   - `NEXT_PUBLIC_FACE_PROVIDER_MODE=model`
3) Jalankan frontend:
   - `npm run dev`

---

## Quick Start (Automated Scripts)
Untuk menghindari menjalankan banyak command manual, gunakan script otomatis di folder `scripts/`.

### PowerShell (Windows)
```powershell
.\scripts\start-all.ps1
```

Opsi:
- `-DevMode` -> backend/frontend jalan dalam mode dev.
- `-SetupOnly` -> hanya install/build/deploy, tanpa start service.
- `-SkipContracts` -> lewati deploy contract.
- `-SkipBuild` -> lewati build backend/frontend.
- `-Network besuLocal` -> pilih network hardhat untuk deploy.

### Bash (Linux/macOS/WSL)
```bash
./scripts/start-all.sh
```

Opsi (env):
- `DEV_MODE=1` -> backend/frontend mode dev.
- `SETUP_ONLY=1` -> hanya setup, tanpa start service.
- `SKIP_CONTRACTS=1` -> lewati deploy contract.
- `SKIP_BUILD=1` -> lewati build backend/frontend.
- `NETWORK=besuLocal` -> pilih network hardhat untuk deploy.

Catatan:
- Script PowerShell membuka service di jendela terminal terpisah.
- Script Bash menjalankan service di background dan menulis log ke:
  - `.run-campus-service.log`
  - `.run-face-service.log`
  - `.run-backend.log`
  - `.run-frontend.log`

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
- Aktivasi fingerprint/passkey di halaman profil (sekali registrasi di device).
- Masuk event aktif dan lakukan voting (selfie + passkey sebelum transaksi dikirim).
---

## Alur Keamanan Vote (Face + Passkey)
Urutan validasi sebelum suara dikirim ke blockchain:
1) Mahasiswa klik vote di halaman event.
2) Frontend capture selfie dan kirim ke backend (`/auth/vote-verify`).
3) Backend ambil foto resmi kampus (`campus-service`) dan minta verifikasi ke `face-service`.
4) Jika face match lolos threshold, backend lanjut challenge WebAuthn (passkey/fingerprint).
5) Jika assertion WebAuthn valid, backend mengeksekusi vote relayer ke smart contract.
6) Jika salah satu tahap gagal, vote ditolak (hard-block) dan tidak ada tx on-chain.

Catatan:
- Foto referensi resmi kampus berada di `campus-service/public/photos/`.
- Selfie mahasiswa tidak disimpan permanen sebagai file di VOTERA (metadata verifikasi tetap dicatat untuk audit).

## Uji Cepat Verifikasi Vote
1) Pastikan service aktif: `campus-service`, `face-service`, `backend`, `frontend`.
2) Login sebagai mahasiswa yang sudah `VERIFIED`.
3) Registrasi passkey di halaman profil.
4) Lakukan vote pada event aktif.
5) Pastikan urutan sukses:
   - selfie diverifikasi,
   - passkey prompt muncul dan berhasil,
   - backend mengembalikan `txHash`.
6) Cek skenario gagal:
   - wajah tidak cocok,
   - passkey dibatalkan,
   - `face-service` dimatikan (harus hard-block).

## Troubleshooting
- Pastikan `SIGNER_PRIVATE_KEY` & `VOTING_CONTRACT_ADDRESS` valid.
- Pastikan `campus-service` aktif sebelum login mahasiswa di VOTERA.
- Pastikan `face-service` aktif jika `FACE_PROVIDER_MODE=model`.
- Pastikan `FACE_SERVICE_TOKEN` di `backend/.env` sama persis dengan `FACE_SERVICE_TOKEN` di `face-service/.env`.
- Jika ABI berubah, jalankan `contracts/scripts/sync-abi.mjs`.
- `db:seed` backend hanya menyiapkan record lokal; password login mahasiswa tetap mengikuti data di `campus-service`.

---

## Catatan Penting (Keterbatasan Saat Ini)
- Verifikasi wajah fase saat ini belum memakai anti-spoofing dedicated (belum ada deteksi foto/video replay attack tingkat lanjut).
- Passkey/WebAuthn terikat pada device/browser; jika ganti device mahasiswa perlu registrasi ulang passkey.
- Akurasi verifikasi sangat bergantung pada kualitas foto resmi kampus dan kualitas kamera/device mahasiswa.
- `face-service` berjalan CPU-only, sehingga latensi bisa naik saat request verifikasi ramai.
- Arsitektur 4 validator + 1 RPC sudah mendekati real-case, tetapi masih single-machine local untuk demo, belum high availability production.
- Beberapa konfigurasi keamanan (token service, private key relayer) masih berbasis `.env`; untuk production sebaiknya dipindah ke secret manager.
- Saat `campus-service` atau `face-service` down, proses vote akan terblokir (hard-block) sesuai kebijakan keamanan saat ini.

---

## Pengembangan Lanjutan
- Tambahkan anti-spoofing model (passive/active liveness) untuk menurunkan risiko serangan replay.
- Tambahkan rate limiting, lockout policy, dan anomaly detection pada endpoint verifikasi/voting.
- Pindahkan penyimpanan secret ke vault/KMS dan terapkan key rotation untuk signer relayer.
- Tambahkan observability production: metrics, tracing, dashboard SLO, dan alert otomatis lintas service.
- Siapkan deployment multi-node Besu di host terpisah (bukan satu laptop), plus backup dan disaster recovery.
- Tingkatkan auditability: dashboard verifikasi (success/fail reason code), report keamanan, dan export log terstruktur.
- Pertimbangkan mode multi-tenant organisasi (BEM/HIMA/UKM) dengan isolasi data dan role yang lebih granular.
