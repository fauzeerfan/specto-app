import { Injectable } from '@nestjs/common';

/**
 * Layanan tingkat aplikasi (root). Menyediakan informasi health-check yang
 * dipakai untuk memantau apakah API Specto hidup dan siap menerima request
 * (mis. oleh perangkat IoT, uptime monitor, atau load balancer).
 */
@Injectable()
export class AppService {
  private readonly startedAt = Date.now();

  getHealth() {
    return {
      name: 'Specto Monitoring API',
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
