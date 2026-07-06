import { Controller, Post, Body, HttpCode, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService, // ✅ inject JwtService
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body('username') username: string,
    @Body('password') password: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(username, password);
    
    // ✅ Generate JWT token
    const payload = { 
      sub: user.id, 
      username: user.username, 
      role: user.role 
    };
    const token = this.jwtService.sign(payload);

    // ✅ Simpan JWT di HTTP-only cookie
    res.cookie('specto_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    });
    
    return { user };
  }

  @Get('me')
  @HttpCode(200)
  async getCurrentUser(@Req() req: Request) {
    const token = req.cookies?.specto_token;
    
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }
    
    try {
      // ✅ Verifikasi JWT
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      
      // ✅ Cari user di database berdasarkan ID dari JWT
      const user = await this.usersService.findById(userId);
      
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      
      const { passwordHash, ...safeUser } = user;
      
      return {
        ...safeUser,
        id: String(safeUser.id),
        role: safeUser.role as 'ADMIN' | 'OPERATOR' | 'VIEWER',
        menuAccess: user.menuAccess || [],
      };
      
    } catch (error) {
      console.error('Error in /api/auth/me:', error.message || error);
      throw new UnauthorizedException('Session expired or invalid');
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('specto_token');
    return { message: 'Logged out successfully' };
  }
}