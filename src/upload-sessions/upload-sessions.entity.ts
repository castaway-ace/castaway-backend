import { ApiProperty } from '@nestjs/swagger';
import { ImportPhase, ImportSessionStatus } from '../generated/prisma/enums.js';
import type { UploadMode } from './upload-sessions.types.js';

export class UploadPartTarget {
  @ApiProperty({ description: '1-based part number.' })
  partNumber!: number;

  @ApiProperty({ description: 'Presigned URL for uploading this part.' })
  url!: string;
}

export class UploadFileTarget {
  @ApiProperty()
  fileId!: string;

  @ApiProperty({ description: 'Echoed original file name.' })
  name!: string;

  @ApiProperty({ enum: ['single', 'multipart'] })
  mode!: UploadMode;

  @ApiProperty({
    required: false,
    description: 'Multipart upload id (multipart mode only).',
  })
  uploadId?: string;

  @ApiProperty({
    type: [UploadPartTarget],
    required: false,
    description: 'Presigned part URLs (multipart mode only).',
  })
  parts?: UploadPartTarget[];

  @ApiProperty({
    required: false,
    description: 'Presigned single PUT URL (single mode only).',
  })
  url?: string;
}

export class CreateUploadSessionResponse {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty({ description: 'Part size in bytes used to split large files.' })
  partSize!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When the presigned URLs expire.',
  })
  expiresAt!: Date;

  @ApiProperty({ type: [UploadFileTarget] })
  files!: UploadFileTarget[];
}

export class UploadSessionFileStatus {
  @ApiProperty()
  fileId!: string;

  @ApiProperty({ description: 'Original file name.' })
  name!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the file finished uploading, or null if pending.',
  })
  uploadedAt!: Date | null;
}

export class UploadSessionProgress {
  @ApiProperty()
  current!: number;

  @ApiProperty()
  total!: number;
}

export class UploadSessionStatusResponse {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty({ enum: ImportSessionStatus })
  status!: ImportSessionStatus;

  @ApiProperty({ enum: ImportPhase, nullable: true })
  phase!: ImportPhase | null;

  @ApiProperty({ type: UploadSessionProgress })
  progress!: UploadSessionProgress;

  @ApiProperty({
    type: Object,
    nullable: true,
    description: 'Structured failure detail, present when status is FAILED.',
  })
  error!: unknown;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Created album id, present when status is COMPLETED.',
  })
  albumId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: Date | null;

  @ApiProperty({ type: [UploadSessionFileStatus] })
  files!: UploadSessionFileStatus[];
}
