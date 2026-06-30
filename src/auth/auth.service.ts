import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserService } from '../users/user.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { DeviceService } from '../device/device.service.js';
import { DeviceDto } from '../device/dto/device.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, PlaylistType } from '../generated/prisma/client.js';
import { User } from '../users/users.types.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthTokensEntity } from './entities/auth-tokens.entity.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly deviceService: DeviceService,
    private readonly prisma: PrismaService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthTokensEntity> {
    const { email, password, deviceInfo } = loginDto;

    const user = await this.userService.findByEmail(email);

    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokensForDevice(user, deviceInfo);
  }

  async signUp(signUpDto: SignUpDto): Promise<AuthTokensEntity> {
    const { email, userName, password, deviceInfo, referralCode } = signUpDto;

    const passwordHash = await argon2.hash(password);

    const newUser = await this.prisma
      .$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, userName, passwordHash },
        });

        const claim = await tx.referralCode.updateMany({
          where: { code: referralCode, usedAt: null },
          data: { usedAt: new Date(), usedById: user.id },
        });

        if (claim.count === 0) {
          throw new BadRequestException(
            'Invalid or already used referral code',
          );
        }

        await tx.playlist.create({
          data: {
            ownerId: user.id,
            name: 'Liked Songs',
            type: PlaylistType.LIKED,
          },
        });

        return user;
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('Email already registered');
        }
        throw error;
      });

    return this.issueTokensForDevice(newUser, deviceInfo);
  }

  async refresh(refreshToken: string): Promise<AuthTokensEntity> {
    return this.refreshTokenService.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revokeByToken(refreshToken);
  }

  private async issueTokensForDevice(
    user: User,
    deviceInfo: DeviceDto,
  ): Promise<AuthTokensEntity> {
    const device = await this.deviceService.findOrCreate(user.id, deviceInfo);

    return this.refreshTokenService.issueForDevice({
      sub: user.id,
      deviceId: device.id,
      isAdmin: user.isAdmin,
    });
  }
}
