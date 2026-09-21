import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { detectImageFileType, detectImageType } from './image-type.js';

describe('detectImageType', () => {
  it.each([
    ['image/jpeg', [0xff, 0xd8, 0xff, 0xe0]],
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['image/gif', [...Buffer.from('GIF89a')]],
    ['image/webp', [...Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'latin1')]],
  ])('detects %s', (type, bytes) => {
    expect(detectImageType(Buffer.from(bytes))).toBe(type);
  });

  it.each([
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ['a WAV file', Buffer.from('RIFF\x00\x00\x00\x00WAVE', 'latin1')],
    ['text', Buffer.from('not an image')],
    ['empty data', Buffer.alloc(0)],
  ])('rejects %s', (_label, data) => {
    expect(detectImageType(data)).toBeUndefined();
  });
});

describe('detectImageFileType', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'image-type-spec-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads the type from the start of the file, ignoring its name', async () => {
    const path = join(dir, 'photo.svg');
    await writeFile(
      path,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
    );

    expect(await detectImageFileType(path)).toBe('image/png');
  });
});
