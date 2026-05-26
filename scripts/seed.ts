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
import { StorageBucket } from '../src/types/storage.js';
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

const BUCKETS = Object.values(StorageBucket);

const PLACEHOLDER_AUDIO = randomBytes(1024);

const MOCK_ARTISTS = [
  {
    name: 'Test Artist One',
    image:
      'https://static.vecteezy.com/system/resources/thumbnails/003/337/584/small/default-avatar-photo-placeholder-profile-icon-vector.jpg',
  },
  {
    name: 'Test Artist Two',
    image:
      'https://static.vecteezy.com/system/resources/thumbnails/003/337/584/small/default-avatar-photo-placeholder-profile-icon-vector.jpg',
  },
];

const MOCK_ALBUMS = [
  {
    title: 'Album One',
    releaseDate: new Date('2020-01-01'),
    image: 'https://picsum.photos/id/237/200/300',
    compilation: false,
    genres: ['Jazz'],
    artistIndex: 0,
  },
  {
    title: 'Album Two',
    releaseDate: new Date('2024-01-01'),
    image: 'https://picsum.photos/seed/picsum/200/300',
    compilation: true,
    genres: ['Blues'],
    artistIndex: 1,
  },
];

const MOCK_TRACKS = [
  { title: 'Track One', albumIndex: 0, trackNumber: 1, artistIndex: 0 },
  { title: 'Track Two', albumIndex: 0, trackNumber: 2, artistIndex: 0 },
  { title: 'Track One', albumIndex: 1, trackNumber: 1, artistIndex: 1 },
];

const keyFor = {
  artist: (artistId: string) => `${artistId}/image.jpg`,
  album: (albumId: string) => `${albumId}/cover.jpg`,
  track: (albumId: string, trackNumber: number) =>
    `${albumId}/${trackNumber}.flac`,
};

const putObject = async (
  bucket: string,
  key: string,
  body: Buffer | string,
): Promise<void> => {
  await s3Client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }),
  );
};

const clearDatabase = async (): Promise<void> => {
  await prisma.trackAnnotation.deleteMany();
  await prisma.trackArtist.deleteMany();
  await prisma.albumArtist.deleteMany();
  await prisma.track.deleteMany();
  await prisma.album.deleteMany();
  await prisma.artist.deleteMany();
};

const clearBucket = async (bucket: string): Promise<void> => {
  const listObjectCommand = new ListObjectsV2Command({
    Bucket: bucket,
  });

  const listObjectResponse = await s3Client.send(listObjectCommand);

  const contents = listObjectResponse.Contents ?? [];

  if (contents.length > 0) {
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: contents.map((obj) => ({ Key: obj.Key! })),
        },
      }),
    );
  }
};

const clearStorage = async (): Promise<void> => {
  for (const bucket of BUCKETS) {
    await clearBucket(bucket);
  }
};

const seedArtists = async () => {
  const artists = [];

  for (const mock of MOCK_ARTISTS) {
    const artist = await prisma.artist.create({
      data: { name: mock.name, imageKey: '' },
    });

    const imageKey = keyFor.artist(artist.id);
    await putObject(StorageBucket.ArtistArt, imageKey, mock.image);
    const updated = await prisma.artist.update({
      where: { id: artist.id },
      data: { imageKey },
    });

    artists.push(updated);
  }

  return artists;
};

const seedAlbums = async (artists: { id: string }[]) => {
  const albums = [];

  for (const mock of MOCK_ALBUMS) {
    const artist = artists[mock.artistIndex];

    const album = await prisma.album.create({
      data: {
        title: mock.title,
        imageKey: '',
        releaseDate: mock.releaseDate,
        compilation: mock.compilation,
        genres: mock.genres,
        albumArtists: { create: [{ artistId: artist.id }] },
      },
    });

    const imageKey = keyFor.album(album.id);
    await putObject(StorageBucket.AlbumArt, imageKey, mock.image);
    const updated = await prisma.album.update({
      where: { id: album.id },
      data: { imageKey },
    });

    albums.push({ ...updated, genres: mock.genres });
  }

  return albums;
};

const seedTracks = async (
  albums: { id: string; genres: string[] }[],
  artists: { id: string }[],
) => {
  for (const mock of MOCK_TRACKS) {
    const album = albums[mock.albumIndex];
    const artist = artists[mock.artistIndex];

    const fileKey = keyFor.track(album.id, mock.trackNumber);
    await putObject(StorageBucket.Tracks, fileKey, PLACEHOLDER_AUDIO);

    await prisma.track.create({
      data: {
        title: mock.title,
        fileKey,
        albumId: album.id,
        trackNumber: mock.trackNumber,
        discNumber: 1,
        duration: 180,
        size: PLACEHOLDER_AUDIO.length,
        suffix: 'flac',
        genres: album.genres,
        bitRate: 1000,
        sampleRate: 44100,
        releaseDate: new Date('2020-01-01'),
        trackArtists: { create: [{ artistId: artist.id }] },
      },
    });
  }
};

const seed = async () => {
  console.log('clearing database...');
  await clearDatabase();
  console.log('clearing storage...');
  await clearStorage();
  console.log('seeding artists...');
  const artists = await seedArtists();
  console.log('seeding albums...');
  const albums = await seedAlbums(artists);
  console.log('seeding tracks...');
  await seedTracks(albums, artists);
  console.log('Seed complete');
};

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
