import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

/** Data insiden sensor yang dikirim ke penerima notifikasi. */
interface IncidentEmailData {
  sensor: string;
  value: number | string;
  description: string;
  device: string;
  time: string;
}

const DASHBOARD_URL = () => `http://${process.env.SERVER_HOST || 'localhost'}:5174`;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /** Nama perangkat yang ramah dibaca (saat ini hanya Specto Server). */
  private getDeviceName(deviceId: string): string {
    const normalized = deviceId.toLowerCase().trim();
    return normalized === 'specto-server' || normalized === 'server' ? 'Specto Server' : deviceId;
  }

  /** Wrapper kirim email + logging konsisten. */
  private async send(to: string | string[], subject: string, html: string): Promise<boolean> {
    try {
      await this.mailerService.sendMail({ to, subject, html });
      const count = Array.isArray(to) ? to.length : 1;
      this.logger.log(`Email terkirim (${count} penerima): ${subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Gagal mengirim email "${subject}": ${(error as Error).message}`);
      return false;
    }
  }

  // --- 1. Alert insiden sensor (dipanggil saat sensor mendeteksi bahaya) ---
  async sendIncidentAlert(recipients: string[], incidentData: IncidentEmailData) {
    if (recipients.length === 0) return;
    const deviceName = this.getDeviceName(incidentData.device);
    const subject = `[CRITICAL ALERT] ${deviceName}: ${incidentData.sensor} Abnormal Detected!`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="background-color: #d32f2f; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Critical Alert - ${deviceName}</h1>
        </div>
        <div style="padding: 20px; background-color: #fafafa;">
          <p style="font-size: 16px; color: #333;">The Specto monitoring system has detected an abnormal sensor reading in the ${deviceName}.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 4px; overflow: hidden;">
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Device</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">${deviceName}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Sensor Type</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #d32f2f;">${incidentData.sensor}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Value</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${incidentData.value}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Description</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${incidentData.description}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; color: #555;">Time</td><td style="padding: 10px;">${incidentData.time}</td></tr>
          </table>
          <div style="text-align: center; margin-top: 25px;">
            <a href="${DASHBOARD_URL()}" style="background-color: #1976d2; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Open Dashboard</a>
          </div>
        </div>
        <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
          <p>This is an automated message from Specto System. Please do not reply.</p>
        </div>
      </div>`;

    await this.send(recipients, subject, html);
  }

  // --- 2. Alert perangkat OFFLINE (perangkat mati / tidak terhubung WiFi) ---
  async sendDeviceOfflineAlert(recipients: string[], deviceId: string, lastSeen: Date | null) {
    if (recipients.length === 0) return;
    const deviceName = this.getDeviceName(deviceId);
    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const lastSeenText = lastSeen
      ? lastSeen.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : 'Belum pernah mengirim data';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="background-color: #b71c1c; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">🔌 Perangkat Tidak Terdeteksi - ${deviceName}</h1>
        </div>
        <div style="padding: 20px; background-color: #fafafa;">
          <p style="font-size: 16px; color: #333;">Sistem Specto <strong>tidak lagi menerima data</strong> dari ${deviceName}. Kemungkinan penyebab: perangkat mati (kehilangan daya) atau tidak terhubung ke jaringan WiFi.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 4px; overflow: hidden;">
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Device</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${deviceName}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Status</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #b71c1c;">OFFLINE</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Data Terakhir</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${lastSeenText}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; color: #555;">Terdeteksi Pada</td><td style="padding: 10px;">${now}</td></tr>
          </table>
          <p style="color: #555; margin-top: 15px;">Mohon segera lakukan pengecekan fisik pada perangkat, sumber daya listrik, dan koneksi WiFi ruang server.</p>
          <div style="text-align: center; margin-top: 25px;">
            <a href="${DASHBOARD_URL()}" style="background-color: #1976d2; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Open Dashboard</a>
          </div>
        </div>
        <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
          <p>This is an automated message from Specto System. Please do not reply.</p>
        </div>
      </div>`;

    await this.send(recipients, `[DEVICE OFFLINE] ${deviceName} Tidak Terdeteksi`, html);
  }

  // --- 3. Notifikasi pemulihan (perangkat kembali ONLINE) ---
  async sendDeviceRecoveryAlert(recipients: string[], deviceId: string, downtime: string) {
    if (recipients.length === 0) return;
    const deviceName = this.getDeviceName(deviceId);
    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="background-color: #2e7d32; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">✅ Perangkat Kembali Online - ${deviceName}</h1>
        </div>
        <div style="padding: 20px; background-color: #f1f8e9;">
          <p style="font-size: 16px; color: #333;">Kabar baik. ${deviceName} <strong>kembali mengirim data</strong> ke sistem Specto dan pemantauan berjalan normal kembali.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 4px; overflow: hidden;">
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Device</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${deviceName}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Status</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #2e7d32;">ONLINE</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Perkiraan Downtime</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${downtime}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; color: #555;">Pulih Pada</td><td style="padding: 10px;">${now}</td></tr>
          </table>
        </div>
        <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
          <p>This is an automated message from Specto System. Please do not reply.</p>
        </div>
      </div>`;

    await this.send(recipients, `[DEVICE ONLINE] ${deviceName} Kembali Normal`, html);
  }

  // --- 4. Pengingat maintenance bulanan (dipanggil MaintenanceService sesuai jadwal) ---
  async sendMaintenanceAlert(recipients: string[], date: Date) {
    if (recipients.length === 0) return;
    const formattedDate = date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="background-color: #0284c7; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🔧 Maintenance Reminder</h2>
        </div>
        <div style="padding: 20px; background-color: #f0f9ff;">
          <p>Halo Tim Specto,</p>
          <p>Ini adalah pengingat otomatis untuk melakukan <strong>Monthly Maintenance</strong> rutin pada perangkat server.</p>
          <div style="background: white; padding: 15px; border-left: 4px solid #0284c7; margin: 20px 0; border-radius: 4px;">
            <strong>Jadwal Maintenance:</strong><br/>
            <span style="font-size: 18px; font-weight: bold;">${formattedDate}</span>
          </div>
          <p>Mohon segera lakukan pengecekan dan isi laporan maintenance di dashboard.</p>
          <div style="text-align: center; margin-top: 25px;">
            <a href="${DASHBOARD_URL()}/maintenance" style="background-color: #0284c7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Buka Dashboard Maintenance</a>
          </div>
        </div>
        <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
          <p>This is an automated message from Specto System. Please do not reply.</p>
        </div>
      </div>`;

    await this.send(recipients, `[REMINDER] Maintenance Server - ${formattedDate}`, html);
  }

  // --- 5. Email uji coba (dari tombol Test di halaman Settings) ---
  async sendUserTest(recipient: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #10b981; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">✅ Test Notification</h2>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <p>Halo <strong>${name}</strong>,</p>
          <p>Ini adalah pesan uji coba dari sistem monitoring Specto.</p>
          <p>Jika Anda menerima email ini, berarti alamat email Anda telah terkonfigurasi dengan benar di sistem.</p>
          <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 20px; border-left: 4px solid #10b981;">
            <p style="margin: 0; color: #555;"><strong>Test Details:</strong></p>
            <p style="margin: 5px 0; color: #666;">• System: Specto Monitoring</p>
            <p style="margin: 5px 0; color: #666;">• Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
            <p style="margin: 5px 0; color: #666;">• Status: Configuration Verified</p>
          </div>
        </div>
        <div style="text-align: center; font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
          <p>This is an automated test message. Please do not reply.</p>
        </div>
      </div>`;

    return this.send(recipient, `[TEST] Specto Notification Check - ${name}`, html);
  }
}
