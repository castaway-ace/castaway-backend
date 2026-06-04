import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistsService } from './playlists.service.js';
import { MockMetadata, ModuleMocker } from 'jest-mock';

const moduleMocker = new ModuleMocker(global);

describe('PlaylistsService', () => {
  let playlistsService: PlaylistsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlaylistsService],
    })
      .useMocker((token) => {
        if (typeof token === 'function') {
          const mockMetadata = moduleMocker.getMetadata(token) as MockMetadata<
            any,
            any
          >;
          const Mock = moduleMocker.generateFromMetadata(
            mockMetadata,
          ) as ObjectConstructor;
          return new Mock();
        }
      })
      .compile();

    playlistsService = module.get(PlaylistsService);
  });

  it('should be defined', () => {
    expect(playlistsService).toBeDefined();
  });
});
