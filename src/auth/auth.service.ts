import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service.js';
import * as argon2 from 'argon2';
import { SignUpDto } from '../dto/sign-up.dto.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { LoginDto } from '../dto/login.dto.js';
import { AuthTokens } from './auth.types.js';
import { DeviceInfoDto } from '../dto/device.dto.js';
import { DeviceService } from '../device/device.service.js';
import { randomUUID } from 'crypto';
import { PlaylistType } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { User } from '../user/users.types.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly deviceService: DeviceService,
    private readonly prisma: PrismaService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthTokens> {
    const { email, password, deviceInfo } = loginDto;

    const user = await this.userService.findByEmail(email);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    return this.issueTokensForDevice(user, deviceInfo);
  }

  async signUp(signUpDto: SignUpDto): Promise<AuthTokens> {
    const { email, userName, password, deviceInfo, referralCode } = signUpDto;

    const passwordHash = await argon2.hash(password);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          userName,
          passwordHash,
        },
      });

      const claim = await tx.referralCode.updateMany({
        where: { code: referralCode, usedAt: null },
        data: { usedAt: new Date(), usedById: user.id },
      });

      if (claim.count === 0) {
        throw new BadRequestException('Invalid or already used referral code');
      }

      await tx.playlist.create({
        data: {
          ownerId: user.id,
          name: 'Liked Songs',
          type: PlaylistType.LIKED,
        },
      });
      return user;
    });

    return this.issueTokensForDevice(newUser, deviceInfo);
  }

  async refresh(refreshToken: string) {
    return await this.refreshTokenService.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revokeByToken(refreshToken);
  }

  private async issueTokensForDevice(
    user: User,
    deviceInfo: DeviceInfoDto,
  ): Promise<AuthTokens> {
    const device = await this.deviceService.findOrCreate(user.id, deviceInfo);

    const familyId = randomUUID();

    const { accessToken, refreshToken, refreshExpiresAt } =
      await this.refreshTokenService.generateTokens({
        sub: user.id,
        deviceId: device.id,
        isAdmin: user.isAdmin,
      });

    await this.refreshTokenService.issue({
      deviceId: device.id,
      familyId,
      tokenHash: this.refreshTokenService.hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
    });

    return { accessToken, refreshToken };
  }
}
