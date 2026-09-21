import { open } from 'fs/promises';

// Raster formats every client can display, recognised by their leading bytes.
// SVG is left out on purpose: images are served from public buckets, and an
// SVG can carry script.
const IMAGE_SIGNATURES: [string, (data: Uint8Array) => boolean][] = [
  ['image/jpeg', (data) => matchesAt(data, 0, [0xff, 0xd8, 0xff])],
  [
    'image/png',
    (data) =>
      matchesAt(data, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  [
    'image/gif',
    (data) => matchesAt(data, 0, 'GIF87a') || matchesAt(data, 0, 'GIF89a'),
  ],
  [
    'image/webp',
    (data) => matchesAt(data, 0, 'RIFF') && matchesAt(data, 8, 'WEBP'),
  ],
];

const SIGNATURE_LENGTH = 12;

/**
 * Returns the content type of a JPEG, PNG, GIF or WebP image, or `undefined`
 * for anything else. Clients can't be trusted to label uploads, so the type is
 * read from the data itself.
 */
export function detectImageType(data: Uint8Array): string | undefined {
  return IMAGE_SIGNATURES.find(([, matches]) => matches(data))?.[0];
}

/** Like {@link detectImageType}, reading only the start of the file. */
export async function detectImageFileType(
  path: string,
): Promise<string | undefined> {
  const file = await open(path);
  try {
    const { buffer, bytesRead } = await file.read(
      Buffer.alloc(SIGNATURE_LENGTH),
      0,
      SIGNATURE_LENGTH,
      0,
    );
    return detectImageType(buffer.subarray(0, bytesRead));
  } finally {
    await file.close();
  }
}

function matchesAt(
  data: Uint8Array,
  offset: number,
  expected: number[] | string,
): boolean {
  const bytes =
    typeof expected === 'string'
      ? [...Buffer.from(expected, 'latin1')]
      : expected;
  return bytes.every((byte, index) => data[offset + index] === byte);
}
