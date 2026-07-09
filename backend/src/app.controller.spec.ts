import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root (health-check)', () => {
    it('should report status "ok"', () => {
      const health = appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.name).toBe('Specto Monitoring API');
    });
  });
});
