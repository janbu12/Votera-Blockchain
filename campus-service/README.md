# Campus Service (Demo)

Service ini mensimulasikan sistem kampus untuk autentikasi mahasiswa dan foto resmi.

## Endpoint internal
- `POST /internal/auth/student-login`
- `GET /internal/students/:nim`
- `GET /internal/students/:nim/face-reference`
- `POST /internal/students/:nim/change-password`

Semua endpoint internal membutuhkan header `x-campus-service-token`.

## Signed official photo
- URL foto resmi untuk face reference dikirim sebagai signed URL sementara.
- Endpoint foto signed: `GET /internal/photos/:nim?exp=<unix>&sig=<hmac>`
- Jika URL kedaluwarsa, endpoint mengembalikan `410`.

## Menjalankan
```bash
npm install
cp .env.example .env
npm run dev
```
