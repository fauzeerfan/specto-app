import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { MaintenanceRecordService } from './maintenance-record.service';
import { MaintenanceItem } from './maintenance.types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/maintenance/records')
export class MaintenanceRecordController {
  constructor(private readonly service: MaintenanceRecordService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: { date: string; technician: string; items: MaintenanceItem[] }) {
    return this.service.create(body);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { items: MaintenanceItem[] }) {
    return this.service.updateItems(id, body.items);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}