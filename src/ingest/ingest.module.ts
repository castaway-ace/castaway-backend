import { Module } from '@nestjs/common';
import { IngestService } from './ingest.service.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { ArtistsModule } from '../artists/artists.module.js';
import { TracksModule } from '../tracks/tracks.module.js';

/**
 * Shared album-ingest planning and persistence. Exports `IngestService` for the
 * synchronous admin upload path and (later) the async worker. PrismaService is
 * provided globally by PrismaModule.
 */
@Module({
  imports: [AlbumsModule, ArtistsModule, TracksModule],
  providers: [IngestService],
  exports: [IngestService],
})
export class IngestModule {}
