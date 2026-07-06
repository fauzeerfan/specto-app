import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser'; // Ubah import ini (hapus * as)

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

  // Listen ke 0.0.0.0 agar bisa diakses dari network lain
  await app.listen(process.env.PORT || 3001, '0.0.0.0');
  
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();