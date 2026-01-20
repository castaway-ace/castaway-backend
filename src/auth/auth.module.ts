import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PrismaModule } from "../prisma/prisma.module";
import { PassportModule } from "@nestjs/passport";
import { GoogleStrategy } from "./strategies/google.strategy";

@Module({
    imports: [
        PrismaModule,
        PassportModule.register({ defaultStrategy: "google" }),
        JwtModule.register({}),
    ],
    controllers: [AuthController],
    providers: [AuthService, GoogleStrategy],
})

export class AuthModule { }

