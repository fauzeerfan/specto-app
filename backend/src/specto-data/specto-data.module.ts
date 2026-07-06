import { Module } from '@nestjs/common';
import { SpectoDataController } from './specto-data.controller';
import { SpectoDataService } from './specto-data.service';
import { IncidentsModule } from '../incidents/incidents.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [IncidentsModule, SettingsModule],
  controllers: [SpectoDataController],
  providers: [SpectoDataService],
})
export class SpectoDataModule {}
