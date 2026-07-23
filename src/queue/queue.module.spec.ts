import { buildRedisConnection } from './queue.module.js';

describe('buildRedisConnection', () => {
  it('parses host and port from a basic redis URL', () => {
    expect(buildRedisConnection('redis://redis:6379')).toEqual({
      host: 'redis',
      port: 6379,
      username: undefined,
      password: undefined,
      maxRetriesPerRequest: null,
    });
  });

  it('defaults the port to 6379 when the URL omits it', () => {
    expect(buildRedisConnection('redis://cache')).toMatchObject({
      host: 'cache',
      port: 6379,
    });
  });

  it('extracts and decodes credentials when present', () => {
    expect(buildRedisConnection('redis://user:p%40ss@host:6380')).toEqual({
      host: 'host',
      port: 6380,
      username: 'user',
      password: 'p@ss',
      maxRetriesPerRequest: null,
    });
  });

  it('always sets maxRetriesPerRequest to null (required by BullMQ)', () => {
    expect(
      buildRedisConnection('redis://redis:6379').maxRetriesPerRequest,
    ).toBeNull();
  });

  it.each([undefined, ''])(
    'throws a clear error when REDIS_URL is missing (%p)',
    (value) => {
      expect(() => buildRedisConnection(value)).toThrow(
        'REDIS_URL is not configured',
      );
    },
  );
});
