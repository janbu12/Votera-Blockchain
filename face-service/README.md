# Face Service (FastAPI + InsightFace)

Service ini menjalankan verifikasi wajah lokal (CPU) untuk gate vote `POST /auth/vote-verify` di backend VOTERA.

## Prasyarat
- Disarankan `Python 3.10` atau `Python 3.11` (terutama di Windows).
- Service ini memakai `facenet-pytorch` (MTCNN + FaceNet embedding), sehingga tidak perlu compile C++ build tools.

## Endpoint
- `GET /health`
- `POST /verify` (header `x-face-service-token` wajib)

## Menjalankan lokal
```bash
cd face-service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
python src/run.py
```

### Windows (recommended)
Gunakan launcher `py` agar virtualenv pasti memakai Python 3.10:

```powershell
cd face-service
py -3.10 -m venv .venv
.\\.venv\\Scripts\\activate
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
copy .env.example .env
python src/run.py
```

Jika sebelumnya gagal install dependency lama, lakukan reset venv:

```powershell
deactivate
Remove-Item -Recurse -Force .venv
py -3.10 -m venv .venv
.\\.venv\\Scripts\\activate
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

Service default berjalan di `http://localhost:4200`.

## Catatan
- Fase 1 belum mengandung anti-spoof model khusus.
- Service tidak menyimpan selfie/reference image ke disk.
- Jika reference image berformat SVG, deteksi wajah biasanya gagal. Gunakan foto resmi `.jpg/.jpeg/.png` untuk hasil akurat.
