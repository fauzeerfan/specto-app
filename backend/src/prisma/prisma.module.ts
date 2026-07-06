import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule dibuat @Global agar PrismaService bisa di-inject di semua
 * module tanpa perlu meng-import ulang di setiap feature module
 * (mirip peran TypeOrmModule.forRoot sebelumnya).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
