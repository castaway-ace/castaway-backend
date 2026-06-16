/*
  Warnings:

  - You are about to drop the column `position` on the `playlists` table. All the data in the column will be lost.
  - You are about to drop the column `public` on the `playlists` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PlaylistType" AS ENUM ('USER', 'LIKED');

-- DropIndex
DROP INDEX "playlists_owner_id_position_key";

-- AlterTable
ALTER TABLE "playlists" DROP COLUMN "position",
DROP COLUMN "public",
ADD COLUMN     "type" "PlaylistType" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "playlists_owner_id_idx" ON "playlists"("owner_id");

CREATE UNIQUE INDEX "playlists_owner_id_liked_key"
ON "playlists" ("owner_id")
WHERE "type" = 'LIKED'::"PlaylistType";

INSERT INTO "playlists" ("id", "owner_id", "name", "type", "created_at", "updated_at")
SELECT gen_random_uuid(), u."id", 'Liked Songs', 'LIKED'::"PlaylistType", now(), now()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "playlists" p
  WHERE p."owner_id" = u."id" AND p."type" = 'LIKED'
);
