import { ApiProperty } from '@nestjs/swagger';
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
