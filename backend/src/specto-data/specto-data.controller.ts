import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SpectoDataService } from './specto-data.service';
import { IncidentsService } from '../incidents/incidents.service';

@Controller('api/specto-data')
export class SpectoDataController {
  constructor(
    private service: SpectoDataService,
    private incidentsService: IncidentsService,
  ) {}

  // Endpoint untuk menerima data dari sensor IoT (ESP32/Arduino)
  @Post()
  async ingestFromIoT(@Body() body: any) {
    return this.service.createFromIoT(body);
  }

  // ✅ NEW: Endpoint ping untuk tes konektivitas
  @Get('ping')
  ping() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Endpoint untuk mengambil data sensor terakhir (Real-time card)
  // Mendukung filter by deviceId (default: specto-server)
  @Get('latest')
  async latest(@Query('deviceId') deviceId: string) {
    return this.service.findLatest(deviceId);
  }

  // Endpoint untuk mengambil data historis (Grafik Tren)
  // Mendukung Smart Query (Raw/Hourly/Daily) berdasarkan range tanggal dan deviceId
  @Get('history')
  async history(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('deviceId') deviceId: string,
  ) {
    return this.service.findHistory(startDate, endDate, deviceId);
  }

  // Endpoint untuk mengambil log insiden (Tabel Log)
  // Mendukung filter by deviceId agar log tidak tercampur
  @Get('events')
  async getEvents(@Query('deviceId') deviceId: string) {
    const incidents = await this.incidentsService.findRecent(deviceId);
    
    // Mapping format data agar sesuai dengan yang diharapkan Frontend
    return incidents.map(inc => ({
      id: inc.id,
      created_at: inc.start_time,
      sensor: inc.trigger_reason,
      value: inc.value_at_trigger,
      // Tentukan status ALERT (Merah) atau WARN (Kuning) berdasarkan tipe sensor
      // Asumsi: SMOKE & FLAME selalu ALERT, TEMP & HUM bisa WARN/ALERT tergantung logic di service (disini disederhanakan)
      status: (inc.trigger_reason === 'SMOKE' || inc.trigger_reason === 'FLAME') ? 'ALERT' : 'WARN'
    }));
  }

  // ✅ NEW ENDPOINT: Get hourly aggregated stats for report
  @Get('hourly-stats')
  async getHourlyStats(
    @Query('deviceId') deviceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.findHourlyStats(startDate, endDate, deviceId);
  }
}