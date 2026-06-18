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
import { AuthTokens } from '../types/auth.js';
import { DeviceInfoDto } from '../dto/device.dto.js';
import { DeviceService } from '../device/device.service.js';
import { randomUUID } from 'crypto';
import { Prisma, User } from '../../generated/prisma/client.js';
import { PlaylistsService } from '../playlists/playlists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly playlistService: PlaylistsService,
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
    const { email, userName, password, deviceInfo } = signUpDto;

    const passwordHash = await this.hashPassword(password);

    let newUser: User;

    try {
      newUser = await this.prisma.$transaction(async (tx) => {
        const user = await this.userService.create(
          {
            email,
            userName,
            passwordHash,
          },
          tx,
        );
        await this.playlistService.createLiked(user.id, tx);
        return user;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('User already exists');
      }
      throw error;
    }

    return this.issueTokensForDevice(newUser, deviceInfo);
  }

  async refresh(refreshToken: string) {
    return await this.refreshTokenService.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revokeByToken(refreshToken);
  }

  async hashPassword(data: string): Promise<string> {
    return await argon2.hash(data);
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
