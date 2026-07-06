import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService adalah pengganti koneksi TypeORM.
 * Meng-extend PrismaClient dan mengelola lifecycle koneksi mengikuti
 * lifecycle module NestJS (connect saat start, disconnect saat shutdown).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL (specto_db)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
