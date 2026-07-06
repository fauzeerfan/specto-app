import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceSetting } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async getSettings() {
    let settings = await this.prisma.maintenanceSetting.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await this.prisma.maintenanceSetting.create({
        data: {
          id: 1,
          reminder_day: 15,
          reminder_time: '07:00',
          is_enabled: true,
        },
      });
    }
    return settings;
  }

  async updateSettings(day: number, time: string, enabled: boolean) {
    // Pastikan row settings (id=1) ada terlebih dahulu.
    await this.getSettings();
    return this.prisma.maintenanceSetting.update({
      where: { id: 1 },
      data: {
        reminder_day: day,
        reminder_time: time,
        is_enabled: enabled,
      },
    });
  }

  async sendManualReminder() {
    this.logger.log('Sending manual maintenance reminder...');
    await this.sendMaintenanceReminder(new Date());
    return { success: true };
  }

  @Cron('0 7 * * *') // setiap hari jam 07:00
  async handleCron() {
    const settings = await this.getSettings();
    if (!settings.is_enabled) return;
    await this.checkDateAndSend(settings);
  }

  private async checkDateAndSend(settings: MaintenanceSetting) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Cek apakah sudah pernah dikirim hari ini
    if (settings.last_reminder_sent) {
      const lastSent = new Date(settings.last_reminder_sent);
      lastSent.setHours(0, 0, 0, 0);
      if (lastSent.getTime() === today.getTime()) {
        this.logger.log('Reminder already sent today, skipping.');
        return;
      }
    }

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const targetDate = new Date(currentYear, currentMonth, settings.reminder_day);
    const dayOfWeek = targetDate.getDay();

    const actualScheduleDate = new Date(targetDate);
    if (dayOfWeek === 6) {
      actualScheduleDate.setDate(targetDate.getDate() + 2);
    } else if (dayOfWeek === 0) {
      actualScheduleDate.setDate(targetDate.getDate() + 1);
    }

    const isToday =
      today.getDate() === actualScheduleDate.getDate() &&
      today.getMonth() === actualScheduleDate.getMonth() &&
      today.getFullYear() === actualScheduleDate.getFullYear();

    if (isToday) {
      this.logger.log(`Maintenance schedule matched! Sending notifications...`);
      await this.sendMaintenanceReminder(actualScheduleDate);
      // Update last sent date
      await this.prisma.maintenanceSetting.update({
        where: { id: 1 },
        data: { last_reminder_sent: new Date() },
      });
    }
  }

  private async sendMaintenanceReminder(date: Date) {
    // Hanya ambil user dengan role ADMIN untuk maintenance reminder
    const users = await this.usersService.findAll();
    const targets = users.filter((u) => u.role === 'ADMIN'); // Hanya ADMIN saja

    // 1. Email
    const emailRecipients = targets.map((u) => u.email).filter((e) => e);
    if (emailRecipients.length > 0) {
      await this.mailService.sendMaintenanceAlert(emailRecipients, date);
    }

    // 2. WhatsApp
    const waRecipients = targets.map((u) => u.whatsappNumber).filter((n): n is string => !!n);
    if (waRecipients.length > 0) {
      await this.whatsappService.sendMaintenanceReminder(waRecipients, date);
    }

    this.logger.log(`Maintenance reminder sent to ${targets.length} administrators`);
  }
}
