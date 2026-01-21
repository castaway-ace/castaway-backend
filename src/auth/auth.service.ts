import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleUser } from "./strategies/google.strategy";
import { FacebookUser } from './strategies/facebook.strategy';
import { UserService } from "../user/user.service";

type OAuthUser = GoogleUser | FacebookUser;

@Injectable({})
export class AuthService {

    constructor(
        private jwt: JwtService,
        private userService: UserService,
        private prisma: PrismaService,
    ) { }

    async validateOAuthUser(oauthUser: OAuthUser) {
        console.log('Validating OAuth user:', {
            provider: oauthUser.provider,
            email: oauthUser.email,
        });

        // Calculate token expiration (Google tokens typically expire in 1 hour)
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;

        // Find or create user, linking by email
        const user = await this.userService.findOrCreateFromOAuth({
            email: oauthUser.email,
            firstName: oauthUser.firstName,
            lastName: oauthUser.lastName,
            avatar: oauthUser.avatar,
            provider: oauthUser.provider,
            providerAccountId: oauthUser.providerId,
            accessToken: oauthUser.accessToken,
            refreshToken: oauthUser.provider === 'google' ? oauthUser.refreshToken : undefined,
            expiresAt,
            scope: 'email profile',
        });

        console.log('User after OAuth validation:', {
            userId: user?.id,
            email: user?.email,
            linkedProviders: user?.accounts.map(acc => acc.provider),
        });

        // Generate our own JWT tokens for the application
        const payload = {
            sub: user?.id,
            email: user?.email,
            firstName: user?.firstName,
            lastName: user?.lastName,
        };

        const accessToken = this.jwt.sign(payload, {
            expiresIn: '15m',
        });

        // Create refresh token with family for rotation
        const refreshTokenFamily = this.generateTokenFamily();
        const refreshToken = this.jwt.sign(
            { sub: user?.id, family: refreshTokenFamily },
            { expiresIn: '7d' },
        );

        // Store refresh token in database
        if (user?.id) {
            await this.prisma.refreshToken.create({
                data: {
                    userId: user?.id,
                    token: refreshToken,
                    family: refreshTokenFamily,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                },
            });
        }

        return {
            accessToken,
            refreshToken,
            user,
        };
    }

    async validateGoogleUser(googleUser: GoogleUser) {
        return this.validateOAuthUser(googleUser);
    }

    async validateFacebookUser(facebookUser: FacebookUser) {
        return this.validateOAuthUser(facebookUser);
    }

    async refreshTokens(refreshToken: string) {
        try {
            // Verify the refresh token
            const payload = this.jwt.verify(refreshToken);

            // Check if token exists and is not revoked
            const storedToken = await this.prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true },
            });

            if (!storedToken || storedToken.isRevoked) {
                throw new Error('Invalid or revoked refresh token');
            }

            if (new Date() > storedToken.expiresAt) {
                throw new Error('Refresh token expired');
            }

            const user = storedToken.user;

            // Revoke old token
            await this.prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: {
                    isRevoked: true,
                    revokedAt: new Date(),
                },
            });

            // Generate new tokens
            const newAccessToken = this.jwt.sign(
                {
                    sub: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                },
                { expiresIn: '15m' },
            );

            const newRefreshToken = this.jwt.sign(
                { sub: user.id, family: storedToken.family },
                { expiresIn: '7d' },
            );

            // Store new refresh token
            await this.prisma.refreshToken.create({
                data: {
                    userId: user.id,
                    token: newRefreshToken,
                    family: storedToken.family,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });

            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            };
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    async logout(userId: string, refreshToken: string) {
        // Revoke the refresh token
        const token = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
        });

        if (token && token.userId === userId) {
            await this.prisma.refreshToken.update({
                where: { id: token.id },
                data: {
                    isRevoked: true,
                    revokedAt: new Date(),
                },
            });
        }

        console.log('User logged out:', userId);
        return true;
    }

    private generateTokenFamily(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
}
