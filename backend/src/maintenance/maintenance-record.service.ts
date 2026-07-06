import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceRecord } from '@prisma/client';
import { MaintenanceItem } from './maintenance.types';

@Injectable()
export class MaintenanceRecordService {
  constructor(private readonly prisma: PrismaService) {}

  // Kolom `date` bertipe DATE di Postgres. Prisma mengembalikannya sebagai objek
  // Date; frontend membandingkan string 'YYYY-MM-DD' secara persis (r.date === dateStr),
  // jadi kita serialize kembali ke 'YYYY-MM-DD' agar perilaku API tidak berubah.
  private serialize(record: MaintenanceRecord) {
    return {
      ...record,
      date: record.date.toISOString().split('T')[0],
    };
  }

  async findAll() {
    const records = await this.prisma.maintenanceRecord.findMany({
      orderBy: { date: 'desc' },
    });
    return records.map((r) => this.serialize(r));
  }

  async findOne(id: number) {
    const record = await this.prisma.maintenanceRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    return this.serialize(record);
  }

  async create(data: { date: string; technician: string; items: MaintenanceItem[] }) {
    const totalChecks = data.items.length;
    const record = await this.prisma.maintenanceRecord.create({
      data: {
        date: new Date(data.date),
        technician: data.technician,
        items: data.items as any,
        totalChecks,
        passedChecks: 0,
        failedChecks: 0,
      },
    });
    return this.serialize(record);
  }

  async updateItems(id: number, items: MaintenanceItem[]) {
    const existing = await this.prisma.maintenanceRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Record not found');

    const passedChecks = items.filter((i) => i.status === 'PASS').length;
    const failedChecks = items.filter((i) => i.status === 'FAIL').length;
    const allComplete = items.every((i) => i.status !== 'PENDING');

    const record = await this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        items: items as any,
        passedChecks,
        failedChecks,
        // Set completedAt hanya sekali, saat semua item selesai untuk pertama kali.
        ...(allComplete && !existing.completedAt ? { completedAt: new Date() } : {}),
      },
    });
    return this.serialize(record);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.maintenanceRecord.delete({ where: { id } });
  }
}
