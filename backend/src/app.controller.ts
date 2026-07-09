import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Health-check root. GET / -> status API Specto. */
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
