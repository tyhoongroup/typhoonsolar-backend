import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto, ChangePasswordDto, ResetPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid phone number or password.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid phone number or password.');
    }

    const payload = {
      sub: user.id,
      id: user.id,
      phone: user.phone,
      role: user.role,
      fullName: user.fullName,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'fallback-secret-typhoon',
      expiresIn: process.env.JWT_ACCESS_EXPIRATION || '7d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
      expiresIn: process.env.JWT_REFRESH_EXPIRATION || '30d',
    });

    return {
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User account no longer active.');
      }

      const newPayload = {
        sub: user.id,
        id: user.id,
        phone: user.phone,
        role: user.role,
        fullName: user.fullName,
      };

      const accessToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_ACCESS_SECRET || 'fallback-secret-typhoon',
        expiresIn: '15m',
      });

      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) throw new BadRequestException('Incorrect current password.');

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: 'Password updated successfully.' };
  }

  async resetPasswordByAdmin(targetUserId: string, dto: ResetPasswordDto) {
    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash: newHash },
    });

    return { message: 'User password reset successfully by Admin.' };
  }

  async saveFcmToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
    return { message: 'FCM push token registered.' };
  }

  async updateProfile(userId: string, dto: { fullName?: string; phone?: string; email?: string }) {
    const data: any = {};
    if (dto.fullName && dto.fullName.trim()) data.fullName = dto.fullName.trim();
    if (dto.phone && dto.phone.trim()) data.phone = dto.phone.trim();

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    return { message: 'Profile updated successfully.', user: updated };
  }
}

