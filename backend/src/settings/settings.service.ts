import { Injectable } from '@nestjs/common';
import { SensorSetting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ThresholdInput {
  temp_min: number;
  temp_max: number;
  hum_min: number;
  hum_max: number;
  smoke_max: number;
  flame_min: number;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ambil ambang batas sensor. Baris default (id=1) dibuat otomatis bila belum ada. */
  async getThresholds(): Promise<SensorSetting> {
    const existing = await this.prisma.sensorSetting.findUnique({ where: { id: 1 } });
    return existing ?? this.prisma.sensorSetting.create({ data: { id: 1 } });
  }

  async updateThresholds(data: ThresholdInput): Promise<SensorSetting> {
    await this.getThresholds();
    return this.prisma.sensorSetting.update({ where: { id: 1 }, data });
  }
}
