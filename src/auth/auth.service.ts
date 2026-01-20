import {
    Injectable,
    Logger,
    UnauthorizedException,
    InternalServerErrorException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleUser } from "./strategies/google.strategy";
import { v4 as uuidv4 } from "uuid";
import { AuthDto } from "./dto";

export interface Tokens {
    accessToken: string;
    refreshToken: string;
}

@Injectable({})
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private prisma: PrismaService,
        private jwt: JwtService
    ) { }

    async validateGoogleUser(googleUser: GoogleUser): Promise<Tokens> {
        const { provider, providerId, email, firstName, lastName, avatar, accessToken, refreshToken } = googleUser;

        this.logger.log(`Google login attempt: ${email}`);

        try {
            // Check if this Google account is already linked
            let account = await this.prisma.account.findUnique({
                where: {
                    provider_providerAccountId: {
                        provider,
                        providerAccountId: providerId,
                    },
                },
                include: { user: true },
            });

            if (account) {
                // Update OAuth tokens
                await this.prisma.account.update({
                    where: { id: account.id },
                    data: {
                        accessToken,
                        refreshToken,
                    },
                });

                this.logger.log(`Existing user logged in: ${account.user.email}`);
                return this.generateTokens(account.user.id, account.user.email);
            }

            // Check if user exists with same email
            let user = await this.prisma.user.findUnique({
                where: { email },
            });

            if (user) {
                // Link Google account to existing user
                await this.prisma.account.create({
                    data: {
                        provider,
                        providerAccountId: providerId,
                        accessToken,
                        refreshToken,
                        userId: user.id,
                    },
                });

                this.logger.log(`Linked Google account to existing user: ${email}`);
                return this.generateTokens(user.id, user.email);
            }

            // Create new user with linked Google account
            user = await this.prisma.$transaction(async (tx) => {
                const newUser = await tx.user.create({
                    data: {
                        email,
                        firstName,
                        lastName,
                        avatar,
                    },
                });

                await tx.account.create({
                    data: {
                        provider,
                        providerAccountId: providerId,
                        accessToken,
                        refreshToken,
                        userId: newUser.id,
                    },
                });

                return newUser;
            });

            this.logger.log(`New user created via Google: ${email}`);
            return this.generateTokens(user.id, user.email);
        } catch (error) {
            this.logger.error(`Google auth failed: ${error}`);
            throw new InternalServerErrorException("Authentication failed");
        }
    }

    async generateTokens(userId: string, email: string): Promise<Tokens> {
        const payload = { sub: userId, email };
        const family = uuidv4();

        const [accessToken, refreshToken] = await Promise.all([
            this.jwt.signAsync(payload, {
                expiresIn: "15m",
                secret: process.env.JWT_SECRET,
            }),
            this.jwt.signAsync({ ...payload, family }, {
                expiresIn: "7d",
                secret: process.env.JWT_REFRESH_SECRET,
            }),
        ]);

        // Store refresh token in database
        await this.prisma.refreshToken.create({
            data: {
                userId,
                token: refreshToken,
                family,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        return { accessToken, refreshToken };
    }

    async refreshTokens(refreshToken: string): Promise<Tokens> {
        try {
            const payload = await this.jwt.verifyAsync(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET,
            });

            // Check if token exists and is not revoked
            const storedToken = await this.prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true },
            });

            if (!storedToken || storedToken.isRevoked) {
                // Possible token theft - revoke all tokens in family
                if (storedToken) {
                    await this.prisma.refreshToken.updateMany({
                        where: { family: storedToken.family },
                        data: { isRevoked: true, revokedAt: new Date() },
                    });
                }
                throw new UnauthorizedException("Invalid refresh token");
            }

            // Revoke current token
            await this.prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: { isRevoked: true, revokedAt: new Date() },
            });

            // Generate new tokens with same family
            return this.generateTokensWithFamily(
                storedToken.user.id,
                storedToken.user.email,
                storedToken.family
            );
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException("Invalid refresh token");
        }
    }

    private async generateTokensWithFamily(
        userId: string,
        email: string,
        family: string
    ): Promise<Tokens> {
        const payload = { sub: userId, email };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwt.signAsync(payload, {
                expiresIn: "15m",
                secret: process.env.JWT_SECRET,
            }),
            this.jwt.signAsync({ ...payload, family }, {
                expiresIn: "7d",
                secret: process.env.JWT_REFRESH_SECRET,
            }),
        ]);

        await this.prisma.refreshToken.create({
            data: {
                userId,
                token: refreshToken,
                family,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        return { accessToken, refreshToken };
    }

    async logout(userId: string, refreshToken: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: {
                userId,
                token: refreshToken,
            },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        });
    }

    async logoutAll(userId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: { userId },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        });
    }
}
