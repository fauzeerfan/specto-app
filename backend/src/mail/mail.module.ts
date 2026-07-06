import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        secure: false, // false untuk port 587
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false, // Penting untuk menghindari error sertifikat self-signed
        },
        // --- TAMBAHAN DEBUGGING ---
        debug: true,  // Akan menampilkan detail transaksi SMTP di terminal
        logger: true, // Akan mencatat log error di terminal
      },
      defaults: {
        from: process.env.MAIL_FROM,
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}