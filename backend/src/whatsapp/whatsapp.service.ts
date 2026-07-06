import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly waServerUrl: string;

  constructor(private configService: ConfigService) {
    this.waServerUrl = this.configService.get<string>('WA_SERVER_URL') || '';
  }

  // Helper: Format nomor HP ke standar 62 (Indonesia)
  private formatPhoneNumber(phone: string): string {
    // Hapus karakter non-digit (spasi, strip, dll)
    let formatted = phone.replace(/\D/g, '');

    // Jika diawali '0', ganti dengan '62'
    if (formatted.startsWith('0')) {
      formatted = '62' + formatted.slice(1);
    }

    return formatted;
  }

  // Helper: Kirim HTTP Request ke WA Gateway
  private async sendMessage(number: string, message: string): Promise<boolean> {
    try {
      if (!number) return false;
      
      if (!this.waServerUrl) {
        this.logger.warn('WA_SERVER_URL is not configured in .env');
        return false;
      }

      // Format nomor tujuan
      const targetNumber = this.formatPhoneNumber(number);

      // Kirim request sesuai format baru
      // URL: .../send
      // Body: { "to": "628xxx", "message": "..." }
      const response = await fetch(this.waServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: targetNumber,
          message: message,
        }),
      });

      if (!response.ok) {
        // Baca pesan error dari response body jika ada
        const errorText = await response.text(); 
        this.logger.error(`Failed to send WA to ${targetNumber}: ${response.status} ${response.statusText} - ${errorText}`);
        return false;
      } 
      
      this.logger.log(`WA sent successfully to ${targetNumber}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Error sending WA to ${number}: ${error.message}`);
      return false;
    }
  }

  // Helper: Mendapatkan nama perangkat (hanya Specto Server)
  private getDeviceName(deviceId: string): string {
    const normalized = deviceId.toLowerCase().trim();

    if (normalized === 'specto-server' || normalized === 'server') {
      return 'Specto Server';
    }
    return deviceId;
  }

  // --- 1. Alert Incident ---
  async sendIncidentAlert(recipients: string[], data: any) {
    if (recipients.length === 0) return;

    const time = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    
    // Gunakan helper untuk mendapatkan nama perangkat
    const deviceName = this.getDeviceName(data.device);
    
    const message = `🚨 *SPECTO CRITICAL ALERT* 🚨
    
Terdeteksi kondisi abnormal pada ${deviceName}!

📊 *Sensor:* ${data.sensor}
⚠️ *Value:* ${typeof data.value === 'number' ? Math.floor(data.value) : data.value}
📝 *Detail:* ${data.description}
⏰ *Waktu:* ${time}

Mohon segera lakukan pengecekan!
_Link: http://${process.env.SERVER_HOST || 'localhost'}:5174_`;

    for (const number of recipients) {
      await this.sendMessage(number, message);
    }
    
    this.logger.log(`Incident alert sent to ${recipients.length} recipients for device: ${deviceName}`);
  }

  // --- 2. Maintenance Reminder ---
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

_Link: http://${process.env.SERVER_HOST || 'localhost'}:5174`;

    for (const number of recipients) {
      await this.sendMessage(number, message);
    }
    
    this.logger.log(`Maintenance reminder sent to ${recipients.length} recipients`);
  }

  // --- 3. Test Personal User ---
  async sendUserTest(number: string, name: string) {
    const message = `✅ *SPECTO TEST MESSAGE*
    
Halo ${name},
Ini adalah pesan uji coba untuk memastikan nomor WhatsApp Anda terhubung dengan sistem notifikasi Specto.

🕒 Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;

    const result = await this.sendMessage(number, message);
    
    if (result) {
      this.logger.log(`Test message sent successfully to ${number}`);
    } else {
      this.logger.warn(`Failed to send test message to ${number}`);
    }
    
    return result;
  }
}