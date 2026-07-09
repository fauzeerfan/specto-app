import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Data insiden sensor untuk pesan WhatsApp. */
interface IncidentWaData {
  sensor: string;
  value: number | string;
  description: string;
  device: string;
}

const DASHBOARD_URL = () => `http://${process.env.SERVER_HOST || 'localhost'}:5174`;
const nowWIB = () => new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly waServerUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.waServerUrl = this.configService.get<string>('WA_SERVER_URL') || '';
  }

  /** Normalisasi nomor HP ke format 62 (Indonesia). */
  private formatPhoneNumber(phone: string): string {
    let formatted = phone.replace(/\D/g, '');
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    return formatted;
  }

  /** Nama perangkat yang ramah dibaca (saat ini hanya Specto Server). */
  private getDeviceName(deviceId: string): string {
    const normalized = deviceId.toLowerCase().trim();
    return normalized === 'specto-server' || normalized === 'server' ? 'Specto Server' : deviceId;
  }

  /** Kirim satu pesan ke WA Gateway. */
  private async sendMessage(number: string, message: string): Promise<boolean> {
    try {
      if (!number) return false;
      if (!this.waServerUrl) {
        this.logger.warn('WA_SERVER_URL belum dikonfigurasi di .env');
        return false;
      }

      const targetNumber = this.formatPhoneNumber(number);
      const response = await fetch(this.waServerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: targetNumber, message }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Gagal kirim WA ke ${targetNumber}: ${response.status} ${response.statusText} - ${errorText}`,
        );
        return false;
      }

      this.logger.log(`WA terkirim ke ${targetNumber}`);
      return true;
    } catch (error) {
      this.logger.error(`Error kirim WA ke ${number}: ${(error as Error).message}`);
      return false;
    }
  }

  /** Kirim satu pesan ke banyak nomor. */
  private async broadcast(recipients: string[], message: string) {
    for (const number of recipients) {
      await this.sendMessage(number, message);
    }
  }

  // --- 1. Alert insiden sensor ---
  async sendIncidentAlert(recipients: string[], data: IncidentWaData) {
    if (recipients.length === 0) return;
    const deviceName = this.getDeviceName(data.device);
    const value = typeof data.value === 'number' ? Math.floor(data.value) : data.value;

    const message = `🚨 *SPECTO CRITICAL ALERT* 🚨

Terdeteksi kondisi abnormal pada ${deviceName}!

📊 *Sensor:* ${data.sensor}
⚠️ *Value:* ${value}
📝 *Detail:* ${data.description}
⏰ *Waktu:* ${nowWIB()}

Mohon segera lakukan pengecekan!
_Link: ${DASHBOARD_URL()}_`;

    await this.broadcast(recipients, message);
    this.logger.log(`Alert insiden dikirim ke ${recipients.length} nomor (${deviceName})`);
  }

  // --- 2. Alert perangkat OFFLINE ---
  async sendDeviceOfflineAlert(recipients: string[], deviceId: string, lastSeen: Date | null) {
    if (recipients.length === 0) return;
    const deviceName = this.getDeviceName(deviceId);
    const lastSeenText = lastSeen
      ? lastSeen.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : 'Belum pernah mengirim data';

    const message = `🔌 *SPECTO - PERANGKAT OFFLINE* 🔌

${deviceName} *tidak lagi mengirim data* ke sistem.
Kemungkinan perangkat mati atau tidak terhubung ke WiFi.

📟 *Device:* ${deviceName}
🔴 *Status:* OFFLINE
🕒 *Data terakhir:* ${lastSeenText}
⏰ *Terdeteksi:* ${nowWIB()}

Mohon cek daya listrik & koneksi WiFi ruang server.
_Link: ${DASHBOARD_URL()}_`;

    await this.broadcast(recipients, message);
    this.logger.log(`Alert OFFLINE dikirim ke ${recipients.length} nomor (${deviceName})`);
  }

  // --- 3. Notifikasi pemulihan (ONLINE kembali) ---
  async sendDeviceRecoveryAlert(recipients: string[], deviceId: string, downtime: string) {
    if (recipients.length === 0) return;
    const deviceName = this.getDeviceName(deviceId);

    const message = `✅ *SPECTO - PERANGKAT ONLINE KEMBALI* ✅

${deviceName} *kembali mengirim data*. Pemantauan normal kembali.

📟 *Device:* ${deviceName}
🟢 *Status:* ONLINE
⏱️ *Perkiraan downtime:* ${downtime}
⏰ *Pulih:* ${nowWIB()}

_Link: ${DASHBOARD_URL()}_`;

    await this.broadcast(recipients, message);
    this.logger.log(`Notifikasi pemulihan dikirim ke ${recipients.length} nomor (${deviceName})`);
  }

  // --- 4. Pengingat maintenance bulanan ---
  async sendMaintenanceReminder(recipients: string[], date: Date) {
    if (recipients.length === 0) return;
    const formattedDate = date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const message = `🔧 *MAINTENANCE REMINDER* 🔧

Halo Tim Specto,
Ini adalah pengingat otomatis untuk *Monthly Maintenance* perangkat server.

📅 *Jadwal:* ${formattedDate}
⏰ *Waktu:* 07:00 WIB

Mohon siapkan tools dan isi laporan maintenance pada dashboard setelah selesai.
_Link: ${DASHBOARD_URL()}_`;

    await this.broadcast(recipients, message);
    this.logger.log(`Pengingat maintenance dikirim ke ${recipients.length} nomor`);
  }

  // --- 5. Pesan uji coba personal ---
  async sendUserTest(number: string, name: string) {
    const message = `✅ *SPECTO TEST MESSAGE*

Halo ${name},
Ini adalah pesan uji coba untuk memastikan nomor WhatsApp Anda terhubung dengan sistem notifikasi Specto.

🕒 Waktu: ${nowWIB()}`;

    const result = await this.sendMessage(number, message);
    if (result) this.logger.log(`Pesan uji coba ke ${number}: berhasil`);
    else this.logger.warn(`Pesan uji coba ke ${number}: gagal`);
    return result;
  }
}
