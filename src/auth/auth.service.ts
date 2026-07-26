import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { DeviceService } from '../device/device.service.js';
import { DeviceDto } from '../device/dto/device.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WhitelistService } from '../whitelist/whitelist.service.js';
import { PlaylistType, Role } from '../generated/prisma/client.js';
import { User, userSelect } from '../users/users.types.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthTokensEntity } from './entities/auth-tokens.entity.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensService: RefreshTokenService,
    private readonly devicesService: DeviceService,
    private readonly prisma: PrismaService,
    private readonly whitelistService: WhitelistService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthTokensEntity> {
    const { email, password, deviceInfo } = loginDto;

    const user = await this.usersService.findByEmail(email);

    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      !user.roles.includes(Role.ADMIN) &&
      !(await this.whitelistService.isWhitelisted(email))
    ) {
      throw new ForbiddenException('Access has been revoked');
    }

    return this.issueTokensForDevice(user, deviceInfo);
  }

  async signUp(signUpDto: SignUpDto): Promise<AuthTokensEntity> {
    const { email, userName, password, deviceInfo } = signUpDto;

    if (!(await this.whitelistService.isWhitelisted(email))) {
      throw new ForbiddenException('Email is not permitted to register');
    }

    const passwordHash = await argon2.hash(password);

    const newUser = await this.createUser({ email, userName, passwordHash });

    return this.issueTokensForDevice(newUser, deviceInfo);
  }

  async refresh(refreshToken: string): Promise<AuthTokensEntity> {
    return this.refreshTokensService.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokensService.revokeByToken(refreshToken);
  }

  private async createUser(data: {
    email: string;
    userName: string;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data,
        select: userSelect,
      });

      await tx.playlist.create({
        data: {
          ownerId: user.id,
          name: 'Liked Songs',
          type: PlaylistType.LIKED,
        },
      });

      return user;
    });
  }

  private async issueTokensForDevice(
    user: User,
    deviceInfo: DeviceDto,
  ): Promise<AuthTokensEntity> {
    const device = await this.devicesService.findOrCreate(user.id, deviceInfo);

    return this.refreshTokensService.issueForDevice({
      sub: user.id,
      deviceId: device.id,
      isAdmin: user.isAdmin,
      roles: user.roles,
    });
  }
}
