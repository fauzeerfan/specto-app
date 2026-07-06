import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get('settings')
  async getSettings() {
    return this.service.getSettings();
  }

  @Put('settings')
  async updateSettings(@Body() body: { day: number; time: string; enabled: boolean }) {
    return this.service.updateSettings(body.day, body.time, body.enabled);
  }

  // Endpoint yang dipanggil tombol "Send Test Reminder"
  @Post('test-reminder')
  async testReminder() {
    return this.service.sendManualReminder();
  }
}