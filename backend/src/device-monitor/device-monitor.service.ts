import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

const DEFAULT_DEVICE = 'specto-server';

/**
 * Interval pengecekan (30 detik). Perangkat mengirim data tiap 5 detik, jadi
 * pengecekan tiap 30 detik sudah cukup rapat tanpa membebani database.
 */
const CHECK_INTERVAL_MS = 30_000;

/**
 * Ambang OFFLINE (default 90 detik, dapat di-override lewat .env
 * DEVICE_OFFLINE_THRESHOLD_SEC).
 *
 * Alasan 90 detik: perangkat mengirim data setiap 5 detik, sehingga 90 detik =
 * sekitar 18 kali pengiriman berturut-turut yang hilang. Firmware melakukan
 * reconnect WiFi tiap ~5 detik, jadi gangguan WiFi sesaat tidak akan mencapai
 * 90 detik. Bila diam >= 90 detik, hampir pasti perangkat benar-benar mati atau
 * terputus dari jaringan — bukan sekadar jitter. Nilai ini berada di rentang
 * 1–2 menit sehingga notifikasi tetap cepat namun tidak "false alarm".
 */
const OFFLINE_THRESHOLD_MS = (Number(process.env.DEVICE_OFFLINE_THRESHOLD_SEC) || 90) * 1000;

interface DeviceState {
  offline: boolean;
  offlineSince: Date | null;
  lastDataAt: Date | null;
}

@Injectable()
export class DeviceMonitorService implements OnModuleInit {
  private readonly logger = new Logger(DeviceMonitorService.name);
  private readonly states = new Map<string, DeviceState>();
  private isChecking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly whatsappService: WhatsappService,
  ) {}

  onModuleInit() {
    this.logger.log(
      `Device monitor aktif (cek tiap ${CHECK_INTERVAL_MS / 1000}s, ambang offline ${OFFLINE_THRESHOLD_MS / 1000}s).`,
    );
  }

  /** Loop pengecekan status perangkat. */
  @Interval(CHECK_INTERVAL_MS)
  async checkDevices() {
    if (this.isChecking) return; // cegah eksekusi tumpang tindih
    this.isChecking = true;
    try {
      const devices = await this.getMonitoredDevices();
      for (const deviceId of devices) {
        await this.evaluateDevice(deviceId);
      }
    } catch (error) {
      this.logger.error(`checkDevices gagal: ${(error as Error).message}`);
    } finally {
      this.isChecking = false;
    }
  }

  /** Daftar device yang dipantau: device default + device yang aktif 7 hari terakhir. */
  private async getMonitoredDevices(): Promise<string[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rows = await this.prisma.spectoData.findMany({
      where: { created_at: { gte: sevenDaysAgo } },
      distinct: ['device_id'],
      select: { device_id: true },
    });

    const set = new Set<string>([DEFAULT_DEVICE, ...rows.map((r) => r.device_id)]);
    return Array.from(set);
  }

  /** Mengevaluasi satu device dan mengirim notifikasi saat status berubah. */
  private async evaluateDevice(deviceId: string) {
    const latest = await this.prisma.spectoData.findFirst({
      where: { device_id: deviceId },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    const lastDataAt = latest?.created_at ?? null;
    const ageMs = lastDataAt ? Date.now() - lastDataAt.getTime() : Number.POSITIVE_INFINITY;
    const isOffline = ageMs > OFFLINE_THRESHOLD_MS;

    const prev = this.states.get(deviceId) ?? {
      offline: false,
      offlineSince: null,
      lastDataAt,
    };

    // Transisi ONLINE -> OFFLINE
    if (isOffline && !prev.offline) {
      this.states.set(deviceId, { offline: true, offlineSince: new Date(), lastDataAt });
      this.logger.warn(`Perangkat OFFLINE: ${deviceId} (data terakhir: ${lastDataAt?.toISOString() ?? 'tidak ada'})`);
      await this.notifyOffline(deviceId, lastDataAt);
      return;
    }

    // Transisi OFFLINE -> ONLINE
    if (!isOffline && prev.offline) {
      const downtime = this.formatDuration(prev.offlineSince ? Date.now() - prev.offlineSince.getTime() : 0);
      this.states.set(deviceId, { offline: false, offlineSince: null, lastDataAt });
      this.logger.log(`Perangkat ONLINE kembali: ${deviceId} (downtime ~${downtime})`);
      await this.notifyRecovery(deviceId, downtime);
      return;
    }

    // Tidak ada perubahan status; cukup perbarui catatan waktu data terakhir.
    this.states.set(deviceId, { ...prev, lastDataAt });
  }

  /** Kirim notifikasi OFFLINE ke SEMUA user (email + WhatsApp). */
  private async notifyOffline(deviceId: string, lastSeen: Date | null) {
    const { emails, waNumbers } = await this.getAllRecipients();
    await Promise.all([
      this.mailService.sendDeviceOfflineAlert(emails, deviceId, lastSeen),
      this.whatsappService.sendDeviceOfflineAlert(waNumbers, deviceId, lastSeen),
    ]);
  }

  /** Kirim notifikasi PEMULIHAN ke SEMUA user (email + WhatsApp). */
  private async notifyRecovery(deviceId: string, downtime: string) {
    const { emails, waNumbers } = await this.getAllRecipients();
    await Promise.all([
      this.mailService.sendDeviceRecoveryAlert(emails, deviceId, downtime),
      this.whatsappService.sendDeviceRecoveryAlert(waNumbers, deviceId, downtime),
    ]);
  }

  /** Semua user menjadi penerima notifikasi offline (admin maupun user biasa). */
  private async getAllRecipients() {
    const users = await this.usersService.findAll();
    const emails = users
      .map((u) => u.email)
      .filter((e): e is string => !!e && e.trim() !== '');
    const waNumbers = users
      .map((u) => u.whatsappNumber)
      .filter((n): n is string => !!n && n.trim() !== '');
    return { emails, waNumbers };
  }

  /** Format durasi ms -> "Xj Ym" / "Ym Zd" agar mudah dibaca. */
  private formatDuration(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h} jam ${m} menit`;
    if (m > 0) return `${m} menit ${s} detik`;
    return `${s} detik`;
  }
}
