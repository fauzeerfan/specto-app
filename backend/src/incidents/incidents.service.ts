import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

/** Jendela throttle: insiden sensor yang sama diabaikan bila terjadi < 1 menit lalu. */
const INCIDENT_THROTTLE_MS = 60_000;

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly whatsappService: WhatsappService,
  ) {}

  /**
   * Target notifikasi insiden = seluruh ADMIN (lintas department) +
   * user department SDC yang bukan admin.
   */
  private async getIncidentNotificationTargets(_deviceId: string) {
    const allUsers = await this.usersService.findAll();
    const targets = new Set<(typeof allUsers)[number]>();

    allUsers.filter((u) => u.role === 'ADMIN').forEach((u) => targets.add(u));
    allUsers
      .filter((u) => u.department === 'SDC' && u.role !== 'ADMIN')
      .forEach((u) => targets.add(u));

    return Array.from(targets);
  }

  /** Mencatat insiden baru untuk sebuah device dan mengirim notifikasi (email + WA). */
  async createIncident(deviceId: string, sensorType: string, value: number, details: string) {
    // Rising-edge throttle: hindari spam saat kondisi bahaya berlangsung lama.
    const lastIncident = await this.prisma.incident.findFirst({
      where: { device_id: deviceId, trigger_reason: sensorType },
      orderBy: { start_time: 'desc' },
    });

    if (lastIncident) {
      const diff = Date.now() - new Date(lastIncident.start_time).getTime();
      if (diff < INCIDENT_THROTTLE_MS) return null;
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

    await this.sendIncidentNotifications(deviceId, sensorType, value, details);
    return savedIncident;
  }

  /** Mengirim notifikasi insiden ke email & WhatsApp target. */
  private async sendIncidentNotifications(
    deviceId: string,
    sensorType: string,
    value: number,
    details: string,
  ) {
    try {
      const targets = await this.getIncidentNotificationTargets(deviceId);
      if (targets.length === 0) {
        this.logger.warn(`Tidak ada target notifikasi untuk device: ${deviceId}`);
        return;
      }

      const incidentData = {
        sensor: sensorType,
        value,
        description: details,
        device: deviceId,
        time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      };

      const emailRecipients = targets
        .map((u) => u.email)
        .filter((email): email is string => !!email && email.trim() !== '');
      if (emailRecipients.length > 0) {
        await this.mailService.sendIncidentAlert(emailRecipients, incidentData);
      }

      const waRecipients = targets
        .map((u) => u.whatsappNumber)
        .filter((wa): wa is string => !!wa && wa.trim() !== '');
      if (waRecipients.length > 0) {
        await this.whatsappService.sendIncidentAlert(waRecipients, incidentData);
      }

      this.logger.log(
        `Notifikasi insiden [${deviceId}] terkirim -> email: ${emailRecipients.length}, WA: ${waRecipients.length}`,
      );
    } catch (error) {
      this.logger.error(`Gagal mengirim notifikasi insiden: ${(error as Error).message}`);
    }
  }

  /** Mengambil 20 insiden terakhir, opsional difilter per device. */
  async findRecent(deviceId?: string) {
    return this.prisma.incident.findMany({
      where: deviceId ? { device_id: deviceId } : {},
      orderBy: { start_time: 'desc' },
      take: 20,
    });
  }

  /** Menandai insiden sebagai selesai (resolved). */
  async resolveIncident(incidentId: number, annotation?: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new Error(`Incident with ID ${incidentId} not found`);

    return this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        is_resolved: true,
        end_time: new Date(),
        ...(annotation ? { annotation } : {}),
      },
    });
  }

  /** Mengambil insiden yang belum resolved, opsional per device. */
  async findActiveIncidents(deviceId?: string) {
    return this.prisma.incident.findMany({
      where: { is_resolved: false, ...(deviceId ? { device_id: deviceId } : {}) },
      orderBy: { start_time: 'desc' },
    });
  }
}
