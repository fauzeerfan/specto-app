import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceRecordService } from './maintenance-record.service';
import { MaintenanceRecordController } from './maintenance-record.controller';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    // PrismaModule bersifat global.
    MailModule,
    UsersModule,
    WhatsappModule,
  ],
  controllers: [MaintenanceController, MaintenanceRecordController],
  providers: [MaintenanceService, MaintenanceRecordService],
})
export class MaintenanceModule {}
