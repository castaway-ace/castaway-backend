import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { StorageBucket } from '../types/storage.js';
import { UserService } from '../user/user.service.js';
import { join } from 'path';
import { readdir, readFile } from 'fs/promises';
import { AdminService } from '../admin/admin.service.js';
import { AuthService } from '../auth/auth.service.js';

interface StorageConfig {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

const AUDIO_DIR = join(process.cwd(), 'seed', 'audio');

const BUCKETS = Object.values(StorageBucket);

@Injectable()
export class SeedService {
  private readonly client: S3Client;
  private readonly storageConfig: StorageConfig;

  constructor(
    private readonly userService: UserService,
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.storageConfig = this.loadStorageConfig(configService);

    this.client = new S3Client({
      endpoint: this.storageConfig.endpoint,
      region: this.storageConfig.region ?? 'us-east-1',
      credentials: {
        accessKeyId: this.storageConfig.accessKey,
        secretAccessKey: this.storageConfig.secretKey,
      },
      forcePathStyle: true,
    });
  }

  async clearDatabase(): Promise<void> {
    await this.prisma.trackAnnotation.deleteMany();
    await this.prisma.trackArtist.deleteMany();
    await this.prisma.albumArtist.deleteMany();
    await this.prisma.track.deleteMany();
    await this.prisma.album.deleteMany();
    await this.prisma.artist.deleteMany();
    await this.prisma.user.deleteMany();
  }

  async clearBucket(bucket: string): Promise<void> {
    const listObjectCommand = new ListObjectsV2Command({
      Bucket: bucket,
    });

    const listObjectResponse = await this.client.send(listObjectCommand);

    const contents = listObjectResponse.Contents ?? [];

    if (contents.length > 0) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: contents.map((obj) => ({ Key: obj.Key! })),
          },
        }),
      );
    }
  }

  async clearStorage(): Promise<void> {
    for (const bucket of BUCKETS) {
      await this.clearBucket(bucket);
    }
  }

  async createUsers(): Promise<void> {
    const passwordHash = await this.authService.hashPassword('A1234567sds8');
    const userData = {
      userName: 'wewe',
      email: 'test123@yahoo.com',
      passwordHash,
    };
    const user = await this.userService.create(userData);
    await this.userService.upgradeAdmin(user.id);
  }

  async loadAlbumFiles(albumDir: string): Promise<Express.Multer.File[]> {
    const files = await readdir(albumDir);
    const audioFiles = files.filter((f) => /\.(flac|mp3|m4a|ogg)$/i.test(f));

    return Promise.all(
      audioFiles.map(async (filename) => {
        const buffer = await readFile(join(albumDir, filename));
        return {
          fieldname: 'files',
          originalname: filename,
          encoding: '7bit',
          mimetype: this.mimeTypeFor(filename),
          buffer,
          size: buffer.length,
          stream: null as never,
          destination: '',
          filename,
          path: '',
        } satisfies Express.Multer.File;
      }),
    );
  }

  mimeTypeFor(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'flac':
        return 'audio/flac';
      case 'mp3':
        return 'audio/mpeg';
      case 'm4a':
        return 'audio/mp4';
      case 'ogg':
        return 'audio/ogg';
      default:
        throw new Error(`Unknown audio extension: ${ext}`);
    }
  }

  async uploadAlbums(): Promise<void> {
    const albumDirs = await readdir(AUDIO_DIR, { withFileTypes: true });

    for (const dirent of albumDirs) {
      if (!dirent.isDirectory()) continue;

      const albumPath = join(AUDIO_DIR, dirent.name);
      console.log(`Seeding album from ${albumPath}`);

      try {
        const files = await this.loadAlbumFiles(albumPath);
        await this.adminService.uploadAlbum(files);
        console.log(`  Done: ${files.length} tracks`);
      } catch (err: any) {
        console.error(`  Failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  async run() {
    await this.clearDatabase();
    await this.clearStorage();
    await this.createUsers();
    await this.uploadAlbums();
  }

  private loadStorageConfig(configService: ConfigService): StorageConfig {
    const endpoint = configService.get<string>('STORAGE_ENDPOINT');
    const region = configService.get<string>('STORAGE_REGION');
    const accessKey = configService.get<string>('STORAGE_ACCESS_KEY');
    const secretKey = configService.get<string>('STORAGE_SECRET_ACCESS_KEY');

    if (!endpoint || !region || !accessKey || !secretKey) {
      throw new Error('JWT configuration is incomplete');
    }

    return {
      endpoint,
      region,
      accessKey,
      secretKey,
    };
  }
}
