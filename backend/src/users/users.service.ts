import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private mailService: MailService,
    private whatsappService: WhatsappService,
  ) {}

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { username } });
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: any): Promise<User> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
    });
    if (existing) {
      throw new ConflictException('Email or Username already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(data.password, salt);

    return this.prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        whatsappNumber: data.whatsappNumber,
        username: data.username,
        passwordHash: hash,
        role: data.role,
        department: data.department,
        menuAccess: data.menuAccess || [],
      },
    });
  }

  async update(id: number, data: any): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const updateData: any = {};

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    if (data.fullName) updateData.fullName = data.fullName;
    if (data.email) updateData.email = data.email;
    if (data.whatsappNumber) updateData.whatsappNumber = data.whatsappNumber;
    if (data.username) updateData.username = data.username;
    if (data.role) updateData.role = data.role;
    if (data.department) updateData.department = data.department;
    if (data.menuAccess !== undefined) updateData.menuAccess = data.menuAccess;

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
  }

  // Method untuk test notifikasi (Email & WA) ke user tertentu
  async testNotification(id: number) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const results = {
      email: false,
      whatsapp: false,
    };

    // 1. Test Email
    if (user.email) {
      results.email = await this.mailService.sendUserTest(user.email, user.fullName);
    }

    // 2. Test WhatsApp
    if (user.whatsappNumber) {
      results.whatsapp = await this.whatsappService.sendUserTest(
        user.whatsappNumber,
        user.fullName,
      );
    }

    return {
      message: 'Test triggered',
      results,
      details: `Email: ${results.email ? 'OK' : 'Failed'}, WA: ${results.whatsapp ? 'OK' : 'Failed/No Number'}`,
    };
  }
}
