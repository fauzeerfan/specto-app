// backend/src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  async notifyIncident(reason: string) {
    // TODO: kirim email / WhatsApp / push notification
    console.log('Notify incident:', reason);
  }
}
