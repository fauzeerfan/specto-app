import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [
        'http://localhost:5174',
        'http://192.168.40.254:5174',
        'http://202.52.15.30:5174',
        'http://202.52.15.30:3001',
        'http://192.168.0.5:5174',
        'http://192.168.0.5:3001',
      ],
      credentials: true,
    },
  });

  app.use(cookieParser());

  // Listen ke 0.0.0.0 agar dapat diakses dari perangkat/host lain di jaringan.
  await app.listen(process.env.PORT || 3001, '0.0.0.0');

  Logger.log(`Specto API berjalan di: ${await app.getUrl()}`, 'Bootstrap');
}
bootstrap();
