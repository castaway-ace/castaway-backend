import { Prisma } from '../../generated/prisma/client.js';

export type RefreshTokenWithDevice = Prisma.RefreshTokenGetPayload<{
  include: { device: true };
}>;
