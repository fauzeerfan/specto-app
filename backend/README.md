# Specto — Backend (NestJS + Prisma)

API dan logika sisi server untuk sistem monitoring Specto. Menerima data dari
perangkat IoT, menjalankan tiered storage, mendeteksi insiden & perangkat offline,
serta mengirim notifikasi email/WhatsApp.

Dokumentasi lengkap sistem ada di `../../README.md`.

## Menjalankan

```bash
npm install
npx prisma db push      # sinkron struktur database (specto_db)
npm run start:dev       # http://localhost:3001
```

## Struktur Modul (`src/`)

| Modul            | Tanggung jawab                                            |
|------------------|-----------------------------------------------------------|
| `prisma/`        | Koneksi database (global, pengganti TypeORM)              |
| `auth/`          | Login & strategi JWT                                      |
| `users/`         | CRUD user + test notifikasi                               |
| `settings/`      | Ambang batas sensor (dibaca ESP32 & frontend)             |
| `specto-data/`   | Ingest data IoT + rollup tiered storage + smart query     |
| `incidents/`     | Deteksi (rising-edge) & log insiden sensor                |
| `device-monitor/`| Deteksi perangkat OFFLINE dan notifikasi pemulihan        |
| `maintenance/`   | Jadwal & laporan maintenance                              |
| `mail/`          | Template & pengiriman email (SMTP)                        |
| `whatsapp/`      | Template & pengiriman WhatsApp (WA Gateway)               |

## Skrip Penting

```bash
npm run start:dev     # dev mode (watch)
npm run build         # kompilasi ke dist/
npm run start:prod    # jalankan hasil build
npm run prisma:studio # GUI database
npm test              # unit test
```

Konfigurasi kredensial ada di `.env` (tidak di-commit). Lihat daftar variabel di
`../../README.md` bagian 7.
