import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload, AuthProfile } from './auth.types.js';
import { UserWithAccounts } from '../user/user.types.js';
import { UserService } from 'src/user/user.service.js';
import { type Response } from 'express';
import { LoginDto } from './dto/auth.dto.js';
import { RefreshTokenService } from 'src/refresh-token/refresh-token.service.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  userId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwt: JwtService,
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Resolve an OAuth profile into a user record.
   * Creates the user if they do not exist, or updates the existing user
   * with any new provider links or profile information.
   */
  async resolveOAuthUser(authUser: AuthProfile): Promise<UserWithAccounts> {
    // Confirm email is provided by the OAuth provider
    if (!authUser.email) {
      throw new UnauthorizedException('Email not provided by OAuth provider');
    }

    const existingUser = await this.userService.findByEmail(authUser.email);

    if (!existingUser) {
      return this.userService.createNewOAuthUser(authUser);
    }

    return this.userService.linkProviderToExistingUser(existingUser, authUser);
  }

  /**
   * Issue a fresh access and refresh token pair for the given user and device.
   * Used by login, registration, and OAuth callback flows.
   */
  // async issueTokenPair(
  //   user: UserWithAccounts,
  //   deviceName: string,
  //   deviceType: string,
  // ): Promise<AuthResult> {
  //   const accessToken = await this.signAccessToken(user);
  //   const { token: refreshToken } = await this.refreshTokenService.issue(
  //     user.id,
  //     deviceName,
  //     deviceType,
  //   );

  //   return {
  //     userId: user.id,
  //     accessToken,
  //     refreshToken,
  //   };
  // }

  /**
   * Validate a refresh token, rotate it, and return a new token pair.
   * The caller is responsible for having verified the JWT signature
   * and expiry before invoking this method.
   */
  // async refreshTokens(
  //   userId: string,
  //   rawRefreshToken: string,
  //   deviceName: string,
  //   deviceType: string,
  // ): Promise<AuthResult> {
  //   const user = await this.userService.findById(userId);
  //   if (!user) {
  //     throw new UnauthorizedException('Invalid refresh token');
  //   }

  //   const matchingRecord = await this.refreshTokenService.findMatching(
  //     userId,
  //     rawRefreshToken,
  //   );

  //   if (!matchingRecord) {
  //     // The token was signed by us but is not in the database.
  //     // Either it was already rotated (possible replay) or revoked.
  //     this.logger.warn(
  //       `Refresh token not found in database for userId=${userId}. Possible replay attempt.`,
  //     );
  //     throw new UnauthorizedException('Invalid refresh token');
  //   }

  //   const { token: newRefreshToken } = await this.refreshTokenService.rotate(
  //     matchingRecord.id,
  //     userId,
  //     deviceName,
  //     deviceType,
  //   );
  //   const accessToken = await this.signAccessToken(user);

  //   return {
  //     userId: user.id,
  //     accessToken,
  //     refreshToken: newRefreshToken,
  //   };
  // }

  /**
   * Logout a user by deleting all of their refresh tokens.
   */
  async logout(userId: string, deviceName?: string): Promise<void> {
    if (deviceName) {
      await this.refreshTokenService.revokeByDevice(userId, deviceName);
    } else {
      await this.refreshTokenService.revokeAll(userId);
    }
    this.logger.log(`User logged out: ${userId}`);
  }

  /**
   * Sign an access token for a given user.
   * Uses the default JWT config from the module registration.
   */
  private async signAccessToken(user: UserWithAccounts): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
    };
    return this.jwt.signAsync(payload);
  }

  async handleOAuthCallback(
    user: AuthProfile,
    res: Response,
    provider: string,
  ): Promise<void> {
    try {
      await this.resolveOAuthUser(user);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`${provider} auth failed: ${errorMessage}`);
    }
  }

  // async login(dto: LoginDto): Promise<{
  //   userId: string;
  //   accessToken: string;
  //   refreshToken: string;
  // }> {
  //   const user = await this.userService.findByEmail(dto.email);

  //   if (!user || !user.password) {
  //     // Same error whether the user does not exist or has no password set,
  //     // to avoid leaking which emails are registered or OAuth-only.
  //     throw new UnauthorizedException('Invalid credentials');
  //   }

  //   const passwordMatches = await bcrypt.compare(dto.password, user.password);
  //   if (!passwordMatches) {
  //     throw new UnauthorizedException('Invalid credentials');
  //   }

  //   const payload: JwtPayload = { sub: user.id, role: user.role };
  //   const accessToken = await this.jwt.signAsync(payload);

  //   const { token: refreshToken } = await this.refreshTokenService.issue(
  //     user.id,
  //     dto.deviceName,
  //     dto.deviceType,
  //   );

  //   this.logger.log(`User logged in: ${user.email}`);

  //   return {
  //     userId: user.id,
  //     accessToken,
  //     refreshToken,
  //   };
  // }
}
