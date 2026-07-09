# Specto — Frontend (React + Vite + TypeScript)

Antarmuka web sistem monitoring Specto: dashboard real-time, grafik tren, log
insiden, laporan PDF, manajemen maintenance, dan pengaturan.

Dokumentasi lengkap sistem ada di `../../README.md`.

## Menjalankan

```bash
npm install
npm run dev       # http://localhost:5174
npm run build     # build produksi ke dist/
```

## Struktur (`src/`)

| Folder / File        | Isi                                                       |
|----------------------|-----------------------------------------------------------|
| `App.tsx`            | Routing menu utama + guard autentikasi                    |
| `pages/`             | Login, MonitoringDashboard, Maintenance, Settings         |
| `components/`        | Sidebar, kartu data, dialog laporan                       |
| `hooks/useAuth.tsx`  | State & aksi autentikasi                                  |
| `context/`           | Tema (light/dark)                                         |
| `api/` + `config/`   | Klien HTTP (axios) & base URL API                         |
| `utils/`             | Generator laporan PDF (jsPDF + html2canvas)               |

## Konfigurasi

Base URL API diambil dari `VITE_API_BASE_URL` (lihat `.env.production`). Bila kosong,
memakai path relatif.
