import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserService } from '../user/user.service.js';
import * as argon2 from 'argon2';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async run(): Promise<void> {
    const email = process.env.ADMIN_EMAIL as string;
    const userName = process.env.ADMIN_USERNAME as string;

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { userName }] },
      select: { id: true, email: true },
    });

    if (existing !== null) {
      this.logger.log(
        `Admin already present (email: ${existing.email}). Nothing to do.`,
      );
      return;
    }

    const providedPassword = process.env.ADMIN_PASSWORD as string;

    const passwordHash = await argon2.hash(providedPassword);

    await this.userService.createAdmin({
      email,
      userName,
      passwordHash,
      isAdmin: true,
    });

    this.logger.log(`Seeded admin email`);
  }
}
