import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AlbumIngestProcessor } from './album-ingest.processor.js';

describe('AlbumIngestProcessor', () => {
  it('processes a job without throwing (skeleton) and logs its id', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const processor = new AlbumIngestProcessor();

    await expect(
      processor.process({ id: 'job-1' } as Job),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('job-1'));

    log.mockRestore();
  });
});
