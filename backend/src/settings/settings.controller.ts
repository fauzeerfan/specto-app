import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SettingsService, type ThresholdInput } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Publik: dipakai frontend dan perangkat ESP32 untuk sinkronisasi ambang batas. */
  @Get('thresholds')
  getThresholds() {
    return this.settingsService.getThresholds();
  }

  /** Hanya admin terautentikasi yang boleh mengubah ambang batas. */
  @UseGuards(JwtAuthGuard)
  @Put('thresholds')
  updateThresholds(@Body() body: ThresholdInput) {
    return this.settingsService.updateThresholds(body);
  }
}
