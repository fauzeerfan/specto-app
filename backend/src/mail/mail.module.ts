import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

/**
 * Konfigurasi transport SMTP (email). Kredensial diambil dari .env.
 * ConfigModule sudah global (didaftarkan di AppModule) sehingga tidak
 * perlu di-import ulang di sini.
 */
@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        secure: false, // false untuk STARTTLS di port 587
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASSWORD,
        },
        tls: {
          // Toleransi sertifikat self-signed pada server mail internal.
          rejectUnauthorized: false,
        },
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
