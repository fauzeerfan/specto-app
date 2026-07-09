import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from '../incidents/incidents.service';
import { SettingsService } from '../settings/settings.service';

/** Payload yang dikirim perangkat IoT (ESP32). */
interface IoTPayload {
  device_id?: string;
  temperature: number;
  humidity: number;
  smoke_level: number;
  flame_level: number;
  is_abnormal: boolean;
  /**
   * Waktu perekaman di perangkat (epoch detik/ms atau ISO string). Diisi saat
   * perangkat mengirim data susulan (buffer offline) agar tersimpan pada waktu
   * yang benar. Bila kosong, server memakai waktu terima (now()).
   */
  recorded_at?: string | number;
}

type SensorSnapshot = Pick<
  IoTPayload,
  'temperature' | 'humidity' | 'smoke_level' | 'flame_level'
>;

const DEFAULT_DEVICE = 'specto-server';

@Injectable()
export class SpectoDataService {
  private readonly logger = new Logger(SpectoDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly incidentsService: IncidentsService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Mengubah field recorded_at (opsional) menjadi Date valid.
   * Menerima epoch detik, epoch milidetik, atau ISO string.
   */
  private parseRecordedAt(raw?: string | number): Date | null {
    if (raw === undefined || raw === null || raw === '') return null;

    let ms: number;
    if (typeof raw === 'number') {
      ms = raw < 1e12 ? raw * 1000 : raw; // < 1e12 diasumsikan epoch detik
    } else if (/^\d+$/.test(raw.trim())) {
      const n = Number(raw);
      ms = n < 1e12 ? n * 1000 : n;
    } else {
      ms = Date.parse(raw);
    }

    if (Number.isNaN(ms)) return null;

    // Tolak nilai tidak masuk akal (thn 2000 s.d. now + 1 hari).
    const date = new Date(ms);
    const min = new Date('2000-01-01').getTime();
    const max = Date.now() + 24 * 60 * 60 * 1000;
    if (ms < min || ms > max) return null;

    return date;
  }

  /** Menyimpan satu paket data sensor dari perangkat IoT. */
  async createFromIoT(payload: IoTPayload) {
    const deviceId = payload.device_id || DEFAULT_DEVICE;

    // recorded_at hanya dikirim perangkat untuk data SUSULAN dari buffer offline.
    // Data seperti ini disimpan pada waktu aslinya (recorded_at) dan TIDAK memicu
    // deteksi insiden real-time karena kejadiannya sudah lampau (alarm lokal di
    // perangkat sudah merespons saat itu juga).
    const recordedAt = this.parseRecordedAt(payload.recorded_at);
    const isBackfill = recordedAt !== null;

    const saved = await this.prisma.spectoData.create({
      data: {
        device_id: deviceId,
        temperature: payload.temperature,
        humidity: payload.humidity,
        smoke_level: payload.smoke_level,
        flame_level: payload.flame_level,
        is_abnormal: payload.is_abnormal,
        // Bila ada timestamp perangkat, pakai itu; jika tidak, default now().
        ...(recordedAt ? { created_at: recordedAt } : {}),
      },
    });

    // Deteksi insiden hanya untuk data live (bukan data susulan yang sudah lampau).
    if (!isBackfill) {
      const previous = await this.prisma.spectoData.findFirst({
        where: { device_id: deviceId, id: { not: saved.id } },
        orderBy: { created_at: 'desc' },
      });
      this.detectIncidents(payload, previous, deviceId).catch((err) =>
        this.logger.error(`detectIncidents gagal: ${err.message}`),
      );
    }

    return saved;
  }

  /**
   * Deteksi "rising edge": insiden dicatat hanya saat status berubah
   * Aman -> Bahaya, sehingga tidak spam saat kondisi bahaya berlangsung lama.
   * Ambang batas diambil dari database (dapat diubah lewat aplikasi).
   */
  private async detectIncidents(
    current: IoTPayload,
    previous: SensorSnapshot | null,
    deviceId: string,
  ) {
    const t = await this.settingsService.getThresholds();

    const checks = [
      {
        sensor: 'SMOKE',
        bad: current.smoke_level >= t.smoke_max,
        wasNormal: !previous || previous.smoke_level < t.smoke_max,
        value: current.smoke_level,
        description: 'Smoke detected above threshold',
      },
      {
        sensor: 'FLAME',
        bad: current.flame_level <= t.flame_min,
        wasNormal: !previous || previous.flame_level > t.flame_min,
        value: current.flame_level,
        description: 'Fire flame detected',
      },
      {
        sensor: 'TEMP',
        bad: current.temperature < t.temp_min || current.temperature > t.temp_max,
        wasNormal:
          !previous || (previous.temperature >= t.temp_min && previous.temperature <= t.temp_max),
        value: current.temperature,
        description: `${current.temperature > t.temp_max ? 'High' : 'Low'} Temperature detected`,
      },
      {
        sensor: 'HUM',
        bad: current.humidity < t.hum_min || current.humidity > t.hum_max,
        wasNormal:
          !previous || (previous.humidity >= t.hum_min && previous.humidity <= t.hum_max),
        value: current.humidity,
        description: `${current.humidity > t.hum_max ? 'High' : 'Low'} Humidity detected`,
      },
    ];

    for (const c of checks) {
      if (c.bad && c.wasNormal) {
        await this.incidentsService.createIncident(
          deviceId,
          c.sensor,
          c.value,
          `[Server Room] ${c.description}`,
        );
      }
    }
  }

  // ==========================================================================
  // TIERED STORAGE — rollup & cleanup terjadwal
  // --------------------------------------------------------------------------
  // Tier 1 (raw)    : specto_data   -> resolusi 5 detik, retensi 7 hari
  // Tier 2 (hourly) : specto_hourly -> rata-rata per jam, retensi panjang
  // Tier 3 (daily)  : specto_daily  -> rata-rata per hari, retensi panjang
  // Semua job idempotent: aman bila cron terlambat / server restart / dijalankan
  // ulang, karena bucket yang sama akan ditimpa (bukan diduplikasi).
  // ==========================================================================

  /** Rollup data mentah -> agregasi per-jam (tiap jam pada menit ke-5). */
  @Cron('0 5 * * * *')
  async aggregateHourlyData() {
    const end = new Date();
    end.setMinutes(0, 0, 0);
    const start = new Date(end);
    start.setHours(start.getHours() - 1);

    const results = await this.prisma.spectoData.groupBy({
      by: ['device_id'],
      where: { created_at: { gte: start, lt: end } },
      _avg: { temperature: true, humidity: true },
      _max: { smoke_level: true, flame_level: true },
    });

    for (const res of results) {
      // Idempotent: hapus bucket yang sama (bila ada) sebelum menulis ulang.
      await this.prisma.spectoHourly.deleteMany({
        where: { device_id: res.device_id, time_bucket: start },
      });
      await this.prisma.spectoHourly.create({
        data: {
          device_id: res.device_id,
          time_bucket: start,
          avg_temp: res._avg.temperature ?? 0,
          avg_hum: res._avg.humidity ?? 0,
          max_smoke: res._max.smoke_level ?? 0,
          max_flame: res._max.flame_level ?? 0,
        },
      });
    }

    if (results.length > 0) {
      this.logger.log(`Rollup hourly: ${results.length} device untuk bucket ${start.toISOString()}`);
    }
  }

  /** Rollup agregasi per-jam -> per-hari (tiap hari jam 01:00). */
  @Cron('0 0 1 * * *')
  async aggregateDailyData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateBucket = new Date(yesterday.toISOString().split('T')[0]);

    const results = await this.prisma.spectoHourly.groupBy({
      by: ['device_id'],
      where: { time_bucket: { gte: yesterday, lt: today } },
      _avg: { avg_temp: true, avg_hum: true },
      _max: { max_smoke: true, max_flame: true },
    });

    for (const res of results) {
      // Idempotent: hapus bucket harian yang sama (bila ada) sebelum menulis ulang.
      await this.prisma.spectoDaily.deleteMany({
        where: { device_id: res.device_id, date_bucket: dateBucket },
      });
      await this.prisma.spectoDaily.create({
        data: {
          device_id: res.device_id,
          date_bucket: dateBucket,
          avg_temp: res._avg.avg_temp ?? 0,
          avg_hum: res._avg.avg_hum ?? 0,
          max_smoke: res._max.max_smoke ?? 0,
          max_flame: res._max.max_flame ?? 0,
        },
      });
    }

    if (results.length > 0) {
      this.logger.log(`Rollup daily: ${results.length} device untuk ${dateBucket.toISOString().split('T')[0]}`);
    }
  }

  /** Hapus data mentah lebih tua dari 7 hari (tiap hari jam 02:00). */
  @Cron('0 0 2 * * *')
  async cleanupOldRawData() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const result = await this.prisma.spectoData.deleteMany({
      where: { created_at: { lt: sevenDaysAgo } },
    });
    this.logger.log(`Cleanup raw: ${result.count} baris lama dihapus.`);
  }

  // ==========================================================================
  // Query untuk frontend
  // ==========================================================================

  /**
   * Smart query: memilih sumber data sesuai lebar rentang tanggal.
   * <= 24 jam  -> raw (specto_data)
   * <= 30 hari -> hourly (specto_hourly)
   * > 30 hari  -> daily (specto_daily)
   * Bila tidak ada data pada rentang, mengembalikan array kosong (bukan error).
   */
  async findHistory(startDate: string, endDate: string, deviceId = DEFAULT_DEVICE) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (diffHours <= 24) {
      return this.prisma.spectoData.findMany({
        where: { created_at: { gte: start, lte: end }, device_id: deviceId },
        orderBy: { created_at: 'asc' },
      });
    }

    if (diffHours <= 24 * 30) {
      const data = await this.prisma.spectoHourly.findMany({
        where: { time_bucket: { gte: start, lte: end }, device_id: deviceId },
        orderBy: { time_bucket: 'asc' },
      });
      return data.map((d) => ({
        created_at: d.time_bucket,
        temperature: d.avg_temp,
        humidity: d.avg_hum,
        smoke: d.max_smoke,
        flame: d.max_flame,
      }));
    }

    const data = await this.prisma.spectoDaily.findMany({
      where: {
        date_bucket: {
          gte: new Date(startDate.split('T')[0]),
          lte: new Date(endDate.split('T')[0]),
        },
        device_id: deviceId,
      },
      orderBy: { date_bucket: 'asc' },
    });
    return data.map((d) => ({
      created_at: d.date_bucket.toISOString().split('T')[0],
      temperature: d.avg_temp,
      humidity: d.avg_hum,
    }));
  }

  /** Data sensor terbaru (untuk kartu real-time & deteksi online/offline). */
  findLatest(deviceId = DEFAULT_DEVICE) {
    return this.prisma.spectoData.findFirst({
      where: { device_id: deviceId },
      orderBy: { created_at: 'desc' },
    });
  }

  /** Statistik per-jam (untuk laporan). */
  findHourlyStats(startDate: string, endDate: string, deviceId = DEFAULT_DEVICE) {
    return this.prisma.spectoHourly.findMany({
      where: { time_bucket: { gte: new Date(startDate), lte: new Date(endDate) }, device_id: deviceId },
      orderBy: { time_bucket: 'asc' },
    });
  }
}
