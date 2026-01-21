import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PrismaModule } from "../prisma/prisma.module";
import { PassportModule } from "@nestjs/passport";
import { GoogleStrategy } from "./strategies/google.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { FacebookStrategy } from "./strategies/facebook.strategy";
import { UserModule } from "../user/user.module";

@Module({
    imports: [
        PrismaModule,
        PassportModule,
        UserModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'your-secret-key',
            signOptions: { expiresIn: '15m' },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, GoogleStrategy, FacebookStrategy, JwtStrategy],
})

export class AuthModule { }

