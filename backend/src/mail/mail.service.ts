import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  // Helper: Mendapatkan nama perangkat (hanya Specto Server)
  private getDeviceName(deviceId: string): string {
    const normalized = deviceId.toLowerCase().trim();

    if (normalized === 'specto-server' || normalized === 'server') {
      return 'Specto Server';
    }
    return deviceId;
  }

  // 1. Alert Incident (Dipanggil saat sensor mendeteksi bahaya)
  async sendIncidentAlert(recipients: string[], incidentData: any) {
    if (recipients.length === 0) return;

    // Gunakan helper untuk mendapatkan nama perangkat
    const deviceName = this.getDeviceName(incidentData.device);

    // Subject email dengan nama device
    const subject = `[CRITICAL ALERT] ${deviceName}: ${incidentData.sensor} Abnormal Detected!`;

    // Template HTML email dengan informasi device
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="background-color: #d32f2f; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Critical Alert - ${deviceName}</h1>
        </div>
        
        <div style="padding: 20px; background-color: #fafafa;">
          <p style="font-size: 16px; color: #333;">The Specto monitoring system has detected an abnormal sensor reading in the ${deviceName}.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 4px; overflow: hidden;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Device</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">${deviceName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Sensor Type</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #d32f2f;">${incidentData.sensor}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Value</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${incidentData.value}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Description</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${incidentData.description}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #555;">Time</td>
              <td style="padding: 10px;">${incidentData.time}</td>
            </tr>
          </table>
          
          <div style="text-align: center; margin-top: 25px;">
            <a href="http://${process.env.SERVER_HOST || 'localhost'}:5174" style="background-color: #1976d2; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Open Dashboard</a>
          </div>
        </div>
        
        <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
          <p>This is an automated message from Specto System. Please do not reply.</p>
          <p>If you believe you received this message in error, please contact the system administrator.</p>
        </div>
      </div>
    `;

    try {
      await this.mailerService.sendMail({
        to: recipients,
        subject: subject,
        html: htmlContent,
      });
      console.log(`[MailService] Alert email sent successfully to ${recipients.length} recipients for device: ${deviceName}`);
    } catch (error) {
      console.error('[MailService] Failed to send alert email:', error);
    }
  }

  // 2. Maintenance Reminder (Dipanggil oleh MaintenanceService sesuai jadwal)
  async sendMaintenanceAlert(recipients: string[], date: Date) {
    if (recipients.length === 0) return;

    const formattedDate = date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const htmlContent = `
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
            <a href="http://${process.env.SERVER_HOST || 'localhost'}:5174/maintenance" style="background-color: #0284c7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Buka Dashboard Maintenance</a>
          </div>
        </div>
        
        <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
          <p>This is an automated message from Specto System. Please do not reply.</p>
          <p>Only system administrators receive this maintenance reminder.</p>
        </div>
      </div>
    `;

    try {
      await this.mailerService.sendMail({
        to: recipients,
        subject: `[REMINDER] Maintenance Server - ${formattedDate}`,
        html: htmlContent,
      });
      console.log(`[MailService] Maintenance reminder sent to ${recipients.length} administrators`);
    } catch (error) {
      console.error('[MailService] Failed to send maintenance reminder:', error);
    }
  }

  // 3. Test Personal User (Dipanggil dari tombol Test di Settings Page)
  async sendUserTest(recipient: string, name: string) {
    const htmlContent = `
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
      </div>
    `;

    try {
      await this.mailerService.sendMail({
        to: recipient,
        subject: `[TEST] Specto Notification Check - ${name}`,
        html: htmlContent,
      });
      console.log(`[MailService] Test email sent successfully to ${recipient}`);
      return true;
    } catch (error) {
      console.error('[MailService] Failed to send test email:', error);
      return false;
    }
  }
}