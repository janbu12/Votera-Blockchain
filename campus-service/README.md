# Campus Service (Demo)

Service ini mensimulasikan sistem kampus untuk autentikasi mahasiswa dan foto resmi.

## Endpoint internal
- `POST /internal/auth/student-login`
- `GET /internal/students/:nim`
- `POST /internal/students/:nim/change-password`

Semua endpoint internal membutuhkan header `x-campus-service-token`.

## Menjalankan
```bash
npm install
cp .env.example .env
npm run dev
```
