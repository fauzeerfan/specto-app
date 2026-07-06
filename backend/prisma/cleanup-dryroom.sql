-- ============================================================================
-- SPECTO - Pembersihan Data "Specto Dry-Room" dari database live (specto_db)
-- ----------------------------------------------------------------------------
-- Jalankan SATU KALI setelah update. Script ini menghapus SEMUA baris data
-- milik perangkat dry-room dan membersihkan referensi menu dry-room pada user.
--
-- CATATAN: Struktur tabel TIDAK diubah. Hanya baris data dry-room yang dihapus.
-- Data milik "specto-server" tetap utuh.
--
-- Cara pakai (pilih salah satu):
--   psql -U postgres -d specto_db -f cleanup-dryroom.sql
--   atau tempel isi file ini di Query Tool pgAdmin lalu Execute.
--
-- DISARANKAN backup dulu:
--   pg_dump -U postgres -Fc specto_db > backup_sebelum_hapus_dryroom.dump
-- ============================================================================

BEGIN;

-- (opsional) Lihat jumlah baris dry-room sebelum dihapus:
-- SELECT 'specto_data'  AS tabel, COUNT(*) FROM specto_data  WHERE device_id ILIKE '%dry%'
-- UNION ALL SELECT 'specto_hourly', COUNT(*) FROM specto_hourly WHERE device_id ILIKE '%dry%'
-- UNION ALL SELECT 'specto_daily',  COUNT(*) FROM specto_daily  WHERE device_id ILIKE '%dry%'
-- UNION ALL SELECT 'incidents',     COUNT(*) FROM incidents     WHERE device_id ILIKE '%dry%';

DELETE FROM specto_data   WHERE device_id IN ('specto-dry-room', 'specto-dryroom', 'dry-room');
DELETE FROM specto_hourly WHERE device_id IN ('specto-dry-room', 'specto-dryroom', 'dry-room');
DELETE FROM specto_daily  WHERE device_id IN ('specto-dry-room', 'specto-dryroom', 'dry-room');
DELETE FROM incidents     WHERE device_id IN ('specto-dry-room', 'specto-dryroom', 'dry-room');

-- Bersihkan opsi menu 'specto-dry-room' dari daftar akses menu setiap user.
UPDATE users
SET "menuAccess" = array_remove("menuAccess", 'specto-dry-room')
WHERE 'specto-dry-room' = ANY("menuAccess");

COMMIT;

-- Selesai. Semua jejak dry-room sudah bersih dari database.
