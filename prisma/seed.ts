import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PlaylistType, PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL as string;
  const userName = process.env.ADMIN_USERNAME as string;
  const providedPassword = process.env.ADMIN_PASSWORD as string;

  const passwordHash = await argon2.hash(providedPassword);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      userName,
      passwordHash,
      isAdmin: true,
    },
  });

  const likedPlaylist = await prisma.playlist.findFirst({
    where: { ownerId: user.id, type: PlaylistType.LIKED },
    select: { id: true },
  });

  if (!likedPlaylist) {
    await prisma.playlist.create({
      data: {
        name: 'Liked Songs',
        type: PlaylistType.LIKED,
        ownerId: user.id,
      },
    });
    console.log(`Created Liked Songs playlist for ${user.email}`);
  }

  console.log({ user });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
