/*
  Warnings:

  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `play_histories` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[user_id,album_id]` on the table `album_interactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,artist_id]` on the table `artist_interactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,playlist_id]` on the table `playlist_interactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `password_hash` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "play_histories" DROP CONSTRAINT "play_histories_track_id_fkey";

-- DropForeignKey
ALTER TABLE "play_histories" DROP CONSTRAINT "play_histories_user_id_fkey";

-- DropIndex
DROP INDEX "album_interactions_album_id_user_id_key";

-- DropIndex
DROP INDEX "artist_interactions_artist_id_user_id_key";

-- DropIndex
DROP INDEX "artists_name_idx";

-- DropIndex
DROP INDEX "devices_user_id_idx";

-- DropIndex
DROP INDEX "playlist_interactions_playlist_id_user_id_key";

-- DropIndex
DROP INDEX "track_annotations_user_id_starred_idx";

-- AlterTable
ALTER TABLE "users" RENAME COLUMN "password" TO "password_hash";

-- DropTable
DROP TABLE "play_histories";

-- CreateIndex
CREATE UNIQUE INDEX "album_interactions_user_id_album_id_key" ON "album_interactions"("user_id", "album_id");

-- CreateIndex
CREATE UNIQUE INDEX "artist_interactions_user_id_artist_id_key" ON "artist_interactions"("user_id", "artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_interactions_user_id_playlist_id_key" ON "playlist_interactions"("user_id", "playlist_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "track_annotations_user_id_starred_starred_at_idx" ON "track_annotations"("user_id", "starred", "starred_at" DESC);
