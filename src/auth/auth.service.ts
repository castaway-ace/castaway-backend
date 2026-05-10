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
import { DeviceInfoDto } from '../dto/device-info.dto.js';
import { DeviceService } from '../device/device.service.js';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly deviceService: DeviceService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthTokens> {
    const { email, password, deviceInfo } = loginDto;

    const user = await this.userService.findByEmail(email);
    if (!user || !(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    return this.issueTokensForDevice(user.id, deviceInfo);
  }

  async signUp(signUpDto: SignUpDto): Promise<AuthTokens> {
    const { email, password, deviceInfo } = signUpDto;

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const hash = await this.hashPassword(password);
    const newUser = await this.userService.create({
      ...signUpDto,
      password: hash,
    });

    return this.issueTokensForDevice(newUser.id, deviceInfo);
  }

  async refresh(refreshToken: string) {
    return await this.refreshTokenService.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revokeByToken(refreshToken);
  }

  private async hashPassword(data: string): Promise<string> {
    return await argon2.hash(data);
  }

  private async issueTokensForDevice(
    userId: string,
    deviceInfo: DeviceInfoDto,
  ): Promise<AuthTokens> {
    const existingDevice = await this.deviceService.findById(deviceInfo.id);
    const device =
      existingDevice && existingDevice.userId === userId
        ? existingDevice
        : await this.deviceService.create(userId, deviceInfo);

    const familyId = randomUUID();

    const { accessToken, refreshToken, refreshExpiresAt } =
      await this.refreshTokenService.generateTokens({
        sub: userId,
        deviceId: device.id,
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
