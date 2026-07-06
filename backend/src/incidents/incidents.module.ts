import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    // PrismaModule bersifat global.
    UsersModule,
    MailModule,
    WhatsappModule,
  ],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
