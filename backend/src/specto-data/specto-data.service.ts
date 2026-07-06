import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from '../incidents/incidents.service';
import { SettingsService } from '../settings/settings.service';

interface IoTPayload {
  device_id?: string;
  temperature: number;
  humidity: number;
  smoke_level: number;
  flame_level: number;
  is_abnormal: boolean;
}

type SensorSnapshot = Pick<IoTPayload, 'temperature' | 'humidity' | 'smoke_level' | 'flame_level'>;

const DEFAULT_DEVICE = 'specto-server';

@Injectable()
export class SpectoDataService {
  private readonly logger = new Logger(SpectoDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly incidentsService: IncidentsService,
    private readonly settingsService: SettingsService,
  ) {}

  /** Menyimpan satu paket data sensor dari perangkat IoT. */
  async createFromIoT(payload: IoTPayload) {
    const deviceId = payload.device_id || DEFAULT_DEVICE;

    const previous = await this.prisma.spectoData.findFirst({
      where: { device_id: deviceId },
      orderBy: { created_at: 'desc' },
    });

    const saved = await this.prisma.spectoData.create({
      data: {
        device_id: deviceId,
        temperature: payload.temperature,
        humidity: payload.humidity,
        smoke_level: payload.smoke_level,
        flame_level: payload.flame_level,
        is_abnormal: payload.is_abnormal,
      },
    });

    // Deteksi insiden berjalan async agar respons ke perangkat tetap cepat.
    this.detectIncidents(payload, previous, deviceId).catch((err) =>
      this.logger.error(`detectIncidents failed: ${err.message}`),
    );

    return saved;
  }

  /**
   * Deteksi "rising edge": insiden hanya dicatat saat status berubah
   * dari Aman -> Bahaya, sehingga tidak spam saat kondisi bahaya berlangsung lama.
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

  // --- Tiered storage: rollup & cleanup terjadwal ---

  /** Rollup data mentah -> agregasi per-jam (tiap jam menit ke-5). */
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
  }

  /** Rollup agregasi per-jam -> per-hari (tiap hari jam 01:00). */
  @Cron('0 0 1 * * *')
  async aggregateDailyData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const results = await this.prisma.spectoHourly.groupBy({
      by: ['device_id'],
      where: { time_bucket: { gte: yesterday, lt: today } },
      _avg: { avg_temp: true, avg_hum: true },
      _max: { max_smoke: true, max_flame: true },
    });

    for (const res of results) {
      await this.prisma.spectoDaily.create({
        data: {
          device_id: res.device_id,
          date_bucket: new Date(yesterday.toISOString().split('T')[0]),
          avg_temp: res._avg.avg_temp ?? 0,
          avg_hum: res._avg.avg_hum ?? 0,
          max_smoke: res._max.max_smoke ?? 0,
          max_flame: res._max.max_flame ?? 0,
        },
      });
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
    this.logger.log(`Cleaned up ${result.count} old raw rows.`);
  }

  // --- Query untuk frontend ---

  /** Smart query: pilih sumber data (raw/hourly/daily) sesuai lebar rentang tanggal. */
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
        date_bucket: { gte: new Date(startDate.split('T')[0]), lte: new Date(endDate.split('T')[0]) },
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

  findLatest(deviceId = DEFAULT_DEVICE) {
    return this.prisma.spectoData.findFirst({
      where: { device_id: deviceId },
      orderBy: { created_at: 'desc' },
    });
  }

  findHourlyStats(startDate: string, endDate: string, deviceId = DEFAULT_DEVICE) {
    return this.prisma.spectoHourly.findMany({
      where: { time_bucket: { gte: new Date(startDate), lte: new Date(endDate) }, device_id: deviceId },
      orderBy: { time_bucket: 'asc' },
    });
  }
}
