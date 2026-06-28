import { Prisma } from '../../generated/prisma/client.js';

export type RefreshTokenWithDevice = Prisma.RefreshTokenGetPayload<{
  include: { device: true };
}>;

export type RefreshTokenInput = Pick<
  Prisma.RefreshTokenUncheckedCreateInput,
  'deviceId' | 'familyId' | 'tokenHash' | 'expiresAt'
>;

export interface TokenPayload {
  sub: string;
  deviceId: string;
  isAdmin: boolean;
}
