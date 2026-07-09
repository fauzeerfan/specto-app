import { Module } from '@nestjs/common';
import { DeviceMonitorService } from './device-monitor.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

/**
 * Modul pemantau ketersediaan perangkat IoT. Secara berkala memeriksa apakah
 * perangkat masih mengirim data; bila tidak (mati / tidak terhubung WiFi),
 * mengirim notifikasi OFFLINE, dan notifikasi PEMULIHAN saat kembali online.
 */
@Module({
  imports: [UsersModule, MailModule, WhatsappModule],
  providers: [DeviceMonitorService],
})
export class DeviceMonitorModule {}
