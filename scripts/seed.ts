// scripts/seed.ts
import { PrismaClient } from '../generated/prisma/client.js';
import { randomBytes } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const s3Client = new S3Client({
  region: process.env.STORAGE_REGION!,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.STORAGE_ENDPOINT!,
  forcePathStyle: true,
});

const BUCKET = 'tracks';

async function clearAll() {
  await prisma.trackAnnotation.deleteMany();
  await prisma.trackArtist.deleteMany();
  await prisma.albumArtist.deleteMany();
  await prisma.track.deleteMany();
  await prisma.album.deleteMany();
  await prisma.artist.deleteMany();
}

async function clearStorage() {
  const listObjectCommand = new ListObjectsV2Command({
    Bucket: BUCKET,
  });

  const listObjectResponse = await s3Client.send(listObjectCommand);

  const contents = listObjectResponse.Contents ?? [];

  if (contents.length > 0) {
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: contents.map((obj) => ({ Key: obj.Key! })),
        },
      }),
    );
  }
}

async function seed() {
  await clearAll();
  await clearStorage();

  // Create artists
  const artist1 = await prisma.artist.create({
    data: { name: 'Test Artist One' },
  });
  const artist2 = await prisma.artist.create({
    data: { name: 'Test Artist Two' },
  });

  // Create albums
  const album1 = await prisma.album.create({
    data: {
      title: 'Album One',
      releaseDate: new Date('2020-01-01'),
      compilation: false,
      genres: ['Jazz'],
      albumArtists: {
        create: [{ artistId: artist1.id }],
      },
    },
  });

  const placeholderAudio = randomBytes(1024); // 1KB of garbage labeled as audio
  const tracks = [
    {
      title: 'Track One',
      albumId: album1.id,
      trackNumber: 1,
      artistId: artist1.id,
    },
    {
      title: 'Track Two',
      albumId: album1.id,
      trackNumber: 2,
      artistId: artist1.id,
    },
    {
      title: 'Track Three',
      albumId: album1.id,
      trackNumber: 3,
      artistId: artist2.id,
    },
  ];

  for (const t of tracks) {
    const fileKey = `tracks/${t.albumId}/${t.trackNumber}.flac`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: fileKey,
        Body: placeholderAudio,
      }),
    );

    await prisma.track.create({
      data: {
        title: t.title,
        fileKey,
        albumId: t.albumId,
        trackNumber: t.trackNumber,
        discNumber: 1,
        duration: 180,
        size: placeholderAudio.length,
        codec: 'flac',
        suffix: 'flac',
        genres: ['Jazz'],
        bitRate: 1000,
        sampleRate: 44100,
        releaseDate: new Date('2020-01-01'),
        trackArtists: {
          create: [{ artistId: t.artistId }],
        },
      },
    });
  }

  console.log('Seed complete');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
