import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly whatsappService: WhatsappService,
  ) {}

  // Helper: Mendapatkan target notifikasi untuk Specto Server.
  // Target = seluruh ADMIN + user department SDC (non-admin).
  private async getIncidentNotificationTargets(deviceId: string) {
    const allUsers = await this.usersService.findAll();
    const targets = new Set<any>();

    console.log(`[DEBUG] Device ID: ${deviceId}`);
    console.log(`[DEBUG] Total users: ${allUsers.length}`);

    // Selalu tambahkan semua ADMIN (tanpa melihat department)
    const admins = allUsers.filter((u) => u.role === 'ADMIN');
    console.log(`[DEBUG] Found ${admins.length} admins`);
    admins.forEach((admin) => targets.add(admin));

    // Tambahkan user department SDC (bukan admin) untuk Specto Server
    const sdcUsers = allUsers.filter((u) => u.department === 'SDC' && u.role !== 'ADMIN');
    console.log(`[DEBUG] Found ${sdcUsers.length} SDC users (non-admin)`);
    sdcUsers.forEach((user) => targets.add(user));

    console.log(`[DEBUG] Total notification targets: ${targets.size}`);
    return Array.from(targets);
  }

  // Mencatat incident baru dengan Device ID dan mengirim notifikasi
  async createIncident(deviceId: string, sensorType: string, value: number, details: string) {
    // Cek kejadian terakhir untuk sensor yang sama PADA DEVICE YANG SAMA
    const lastIncident = await this.prisma.incident.findFirst({
      where: {
        device_id: deviceId,
        trigger_reason: sensorType,
      },
      orderBy: { start_time: 'desc' },
    });

    // Throttling: Skip jika kejadian yang sama terjadi < 1 menit lalu
    if (lastIncident) {
      const diff = new Date().getTime() - new Date(lastIncident.start_time).getTime();
      if (diff < 60000) {
        return null;
      }
    }

    const savedIncident = await this.prisma.incident.create({
      data: {
        device_id: deviceId,
        trigger_reason: sensorType,
        value_at_trigger: value,
        annotation: details,
        is_resolved: false,
      },
    });

    // KIRIM NOTIFIKASI ABNORMAL
    await this.sendIncidentNotifications(deviceId, sensorType, value, details);

    return savedIncident;
  }

  // Mengirim notifikasi incident berdasarkan device_id
  private async sendIncidentNotifications(
    deviceId: string,
    sensorType: string,
    value: number,
    details: string,
  ) {
    try {
      const notificationTargets = await this.getIncidentNotificationTargets(deviceId);

      if (notificationTargets.length === 0) {
        console.log(`[IncidentService] No notification targets for device: ${deviceId}`);
        return;
      }

      const incidentData = {
        sensor: sensorType,
        value: value,
        description: details,
        device: deviceId,
        time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      };

      // Kirim Email
      const emailRecipients = notificationTargets
        .map((user) => user.email)
        .filter((email) => email && email.trim() !== '');

      if (emailRecipients.length > 0) {
        await this.mailService.sendIncidentAlert(emailRecipients, incidentData);
      }

      // Kirim WhatsApp
      const waRecipients = notificationTargets
        .map((user) => user.whatsappNumber)
        .filter((wa) => wa && wa.trim() !== '');

      if (waRecipients.length > 0) {
        await this.whatsappService.sendIncidentAlert(waRecipients, incidentData);
      }

      console.log(`[IncidentService] Incident notifications sent for device: ${deviceId}`);
      console.log(`[IncidentService] Email to: ${emailRecipients.length} recipients`);
      console.log(`[IncidentService] WhatsApp to: ${waRecipients.length} recipients`);
    } catch (error) {
      console.error('[IncidentService] Error sending incident notifications:', error);
    }
  }

  // Mengambil incident terakhir, opsional filter by Device ID
  async findRecent(deviceId?: string) {
    return this.prisma.incident.findMany({
      where: deviceId ? { device_id: deviceId } : {},
      orderBy: { start_time: 'desc' },
      take: 20,
    });
  }

  // Method untuk menandai incident sebagai resolved
  async resolveIncident(incidentId: number, annotation?: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });

    if (!incident) {
      throw new Error(`Incident with ID ${incidentId} not found`);
    }

    return this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        is_resolved: true,
        end_time: new Date(),
        ...(annotation ? { annotation } : {}),
      },
    });
  }

  // Method untuk mendapatkan semua incident yang belum resolved
  async findActiveIncidents(deviceId?: string) {
    return this.prisma.incident.findMany({
      where: {
        is_resolved: false,
        ...(deviceId ? { device_id: deviceId } : {}),
      },
      orderBy: { start_time: 'desc' },
    });
  }
}
