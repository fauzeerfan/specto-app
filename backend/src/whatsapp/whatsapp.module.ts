import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [WhatsappService],
  exports: [WhatsappService], // Export agar bisa dipakai di module lain
})
export class WhatsappModule {}