import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { SpectoDataModule } from './specto-data/specto-data.module';
import { IncidentsModule } from './incidents/incidents.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AuthModule } from './auth/auth.module';
import { MaintenanceModule } from './maintenance/maintenance.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ScheduleModule.forRoot(),
    SettingsModule,
    UsersModule,
    AuthModule,
    SpectoDataModule,
    IncidentsModule,
    MailModule,
    WhatsappModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
