/*
  Warnings:

  - You are about to drop the column `albumArtKey` on the `albums` table. All the data in the column will be lost.
  - You are about to drop the column `artistId` on the `albums` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `albums` table. All the data in the column will be lost.
  - You are about to drop the column `releaseYear` on the `albums` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `albums` table. All the data in the column will be lost.
  - You are about to drop the column `artistArtPath` on the `artists` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `artists` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `artists` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `audio_files` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `audio_files` table. All the data in the column will be lost.
  - You are about to drop the column `sampleRate` on the `audio_files` table. All the data in the column will be lost.
  - You are about to drop the column `storageKey` on the `audio_files` table. All the data in the column will be lost.
  - You are about to drop the column `trackId` on the `audio_files` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `audio_files` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `authorization_codes` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `authorization_codes` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `authorization_codes` table. All the data in the column will be lost.
  - You are about to drop the column `playedAt` on the `listening_history` table. All the data in the column will be lost.
  - You are about to drop the column `trackId` on the `listening_history` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `listening_history` table. All the data in the column will be lost.
  - You are about to drop the column `currentTrackId` on the `playback_queues` table. All the data in the column will be lost.
  - You are about to drop the column `repeatMode` on the `playback_queues` table. All the data in the column will be lost.
  - You are about to drop the column `shuffleEnabled` on the `playback_queues` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `playback_queues` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `playback_queues` table. All the data in the column will be lost.
  - You are about to drop the column `addedAt` on the `playlist_tracks` table. All the data in the column will be lost.
  - You are about to drop the column `playlistId` on the `playlist_tracks` table. All the data in the column will be lost.
  - You are about to drop the column `trackId` on the `playlist_tracks` table. All the data in the column will be lost.
  - You are about to drop the column `coverImage` on the `playlists` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `playlists` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `playlists` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `playlists` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `playlists` table. All the data in the column will be lost.
  - You are about to drop the column `queueId` on the `queue_items` table. All the data in the column will be lost.
  - You are about to drop the column `trackId` on the `queue_items` table. All the data in the column will be lost.
  - The primary key for the `track_artists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `artistId` on the `track_artists` table. All the data in the column will be lost.
  - You are about to drop the column `trackId` on the `track_artists` table. All the data in the column will be lost.
  - You are about to drop the column `albumId` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `discNumber` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `lastPlayedAt` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `playCount` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `trackNumber` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `tracks` table. All the data in the column will be lost.
  - You are about to drop the `user_library` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[user_id,name]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,provider_id]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[title,artist_id]` on the table `albums` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[track_id]` on the table `audio_files` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[storage_key]` on the table `audio_files` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `playback_queues` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[playlist_id,track_id]` on the table `playlist_tracks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[queue_id,position]` on the table `queue_items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `artist_id` to the `albums` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `albums` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `artists` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_size` to the `audio_files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storage_key` to the `audio_files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `track_id` to the `audio_files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `audio_files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires_at` to the `authorization_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `authorization_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `track_id` to the `listening_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `listening_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `playback_queues` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `playback_queues` table without a default value. This is not possible if the table is not empty.
  - Added the required column `playlist_id` to the `playlist_tracks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `track_id` to the `playlist_tracks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `playlists` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `playlists` table without a default value. This is not possible if the table is not empty.
  - Added the required column `queue_id` to the `queue_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `track_id` to the `queue_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `artist_id` to the `track_artists` table without a default value. This is not possible if the table is not empty.
  - Added the required column `track_id` to the `track_artists` table without a default value. This is not possible if the table is not empty.
  - Added the required column `album_id` to the `tracks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `tracks` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "albums" DROP CONSTRAINT "albums_artistId_fkey";

-- DropForeignKey
ALTER TABLE "audio_files" DROP CONSTRAINT "audio_files_trackId_fkey";

-- DropForeignKey
ALTER TABLE "authorization_codes" DROP CONSTRAINT "authorization_codes_userId_fkey";

-- DropForeignKey
ALTER TABLE "listening_history" DROP CONSTRAINT "listening_history_trackId_fkey";

-- DropForeignKey
ALTER TABLE "listening_history" DROP CONSTRAINT "listening_history_userId_fkey";

-- DropForeignKey
ALTER TABLE "playback_queues" DROP CONSTRAINT "playback_queues_currentTrackId_fkey";

-- DropForeignKey
ALTER TABLE "playback_queues" DROP CONSTRAINT "playback_queues_userId_fkey";

-- DropForeignKey
ALTER TABLE "playlist_tracks" DROP CONSTRAINT "playlist_tracks_playlistId_fkey";

-- DropForeignKey
ALTER TABLE "playlist_tracks" DROP CONSTRAINT "playlist_tracks_trackId_fkey";

-- DropForeignKey
ALTER TABLE "playlists" DROP CONSTRAINT "playlists_userId_fkey";

-- DropForeignKey
ALTER TABLE "queue_items" DROP CONSTRAINT "queue_items_queueId_fkey";

-- DropForeignKey
ALTER TABLE "queue_items" DROP CONSTRAINT "queue_items_trackId_fkey";

-- DropForeignKey
ALTER TABLE "track_artists" DROP CONSTRAINT "track_artists_artistId_fkey";

-- DropForeignKey
ALTER TABLE "track_artists" DROP CONSTRAINT "track_artists_trackId_fkey";

-- DropForeignKey
ALTER TABLE "tracks" DROP CONSTRAINT "tracks_albumId_fkey";

-- DropForeignKey
ALTER TABLE "user_library" DROP CONSTRAINT "user_library_trackId_fkey";

-- DropForeignKey
ALTER TABLE "user_library" DROP CONSTRAINT "user_library_userId_fkey";

-- DropIndex
DROP INDEX "accounts_name_key";

-- DropIndex
DROP INDEX "accounts_provider_id_key";

-- DropIndex
DROP INDEX "albums_title_artistId_key";

-- DropIndex
DROP INDEX "audio_files_storageKey_key";

-- DropIndex
DROP INDEX "audio_files_trackId_key";

-- DropIndex
DROP INDEX "listening_history_trackId_idx";

-- DropIndex
DROP INDEX "listening_history_userId_playedAt_idx";

-- DropIndex
DROP INDEX "playback_queues_userId_key";

-- DropIndex
DROP INDEX "playlist_tracks_playlistId_idx";

-- DropIndex
DROP INDEX "playlist_tracks_playlistId_trackId_key";

-- DropIndex
DROP INDEX "playlist_tracks_trackId_idx";

-- DropIndex
DROP INDEX "playlists_userId_idx";

-- DropIndex
DROP INDEX "queue_items_queueId_idx";

-- AlterTable
ALTER TABLE "albums" DROP COLUMN "albumArtKey",
DROP COLUMN "artistId",
DROP COLUMN "createdAt",
DROP COLUMN "releaseYear",
DROP COLUMN "updatedAt",
ADD COLUMN     "album_art_key" TEXT,
ADD COLUMN     "artist_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "release_year" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "artists" DROP COLUMN "artistArtPath",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "artist_art_path" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "audio_files" DROP COLUMN "createdAt",
DROP COLUMN "fileSize",
DROP COLUMN "sampleRate",
DROP COLUMN "storageKey",
DROP COLUMN "trackId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "file_size" BIGINT NOT NULL,
ADD COLUMN     "sample_rate" INTEGER,
ADD COLUMN     "storage_key" TEXT NOT NULL,
ADD COLUMN     "track_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "authorization_codes" DROP COLUMN "createdAt",
DROP COLUMN "expiresAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "listening_history" DROP COLUMN "playedAt",
DROP COLUMN "trackId",
DROP COLUMN "userId",
ADD COLUMN     "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "track_id" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "playback_queues" DROP COLUMN "currentTrackId",
DROP COLUMN "repeatMode",
DROP COLUMN "shuffleEnabled",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "current_track_id" TEXT,
ADD COLUMN     "repeat_mode" "RepeatMode" NOT NULL DEFAULT 'OFF',
ADD COLUMN     "shuffle_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "playlist_tracks" DROP COLUMN "addedAt",
DROP COLUMN "playlistId",
DROP COLUMN "trackId",
ADD COLUMN     "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "playlist_id" TEXT NOT NULL,
ADD COLUMN     "track_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "playlists" DROP COLUMN "coverImage",
DROP COLUMN "createdAt",
DROP COLUMN "isPublic",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "queue_items" DROP COLUMN "queueId",
DROP COLUMN "trackId",
ADD COLUMN     "queue_id" TEXT NOT NULL,
ADD COLUMN     "track_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "track_artists" DROP CONSTRAINT "track_artists_pkey",
DROP COLUMN "artistId",
DROP COLUMN "trackId",
ADD COLUMN     "artist_id" TEXT NOT NULL,
ADD COLUMN     "track_id" TEXT NOT NULL,
ADD CONSTRAINT "track_artists_pkey" PRIMARY KEY ("track_id", "artist_id");

-- AlterTable
ALTER TABLE "tracks" DROP COLUMN "albumId",
DROP COLUMN "createdAt",
DROP COLUMN "discNumber",
DROP COLUMN "lastPlayedAt",
DROP COLUMN "playCount",
DROP COLUMN "trackNumber",
DROP COLUMN "updatedAt",
ADD COLUMN     "album_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "disc_number" INTEGER,
ADD COLUMN     "track_number" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "user_library";

-- CreateTable
CREATE TABLE "liked_tracks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liked_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_albums" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_artists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_artists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liked_tracks_user_id_idx" ON "liked_tracks"("user_id");

-- CreateIndex
CREATE INDEX "liked_tracks_track_id_idx" ON "liked_tracks"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "liked_tracks_user_id_track_id_key" ON "liked_tracks"("user_id", "track_id");

-- CreateIndex
CREATE INDEX "saved_albums_user_id_idx" ON "saved_albums"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_albums_user_id_album_id_key" ON "saved_albums"("user_id", "album_id");

-- CreateIndex
CREATE INDEX "saved_artists_user_id_idx" ON "saved_artists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_artists_user_id_artist_id_key" ON "saved_artists"("user_id", "artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_name_key" ON "accounts"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_name_provider_id_key" ON "accounts"("name", "provider_id");

-- CreateIndex
CREATE INDEX "albums_artist_id_idx" ON "albums"("artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "albums_title_artist_id_key" ON "albums"("title", "artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "audio_files_track_id_key" ON "audio_files"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "audio_files_storage_key_key" ON "audio_files"("storage_key");

-- CreateIndex
CREATE INDEX "listening_history_user_id_played_at_idx" ON "listening_history"("user_id", "played_at");

-- CreateIndex
CREATE INDEX "listening_history_track_id_idx" ON "listening_history"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "playback_queues_user_id_key" ON "playback_queues"("user_id");

-- CreateIndex
CREATE INDEX "playlist_tracks_playlist_id_idx" ON "playlist_tracks"("playlist_id");

-- CreateIndex
CREATE INDEX "playlist_tracks_track_id_idx" ON "playlist_tracks"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_tracks_playlist_id_track_id_key" ON "playlist_tracks"("playlist_id", "track_id");

-- CreateIndex
CREATE INDEX "playlists_user_id_idx" ON "playlists"("user_id");

-- CreateIndex
CREATE INDEX "queue_items_queue_id_idx" ON "queue_items"("queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "queue_items_queue_id_position_key" ON "queue_items"("queue_id", "position");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_files" ADD CONSTRAINT "audio_files_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liked_tracks" ADD CONSTRAINT "liked_tracks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liked_tracks" ADD CONSTRAINT "liked_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_history" ADD CONSTRAINT "listening_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_history" ADD CONSTRAINT "listening_history_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_queues" ADD CONSTRAINT "playback_queues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_queues" ADD CONSTRAINT "playback_queues_current_track_id_fkey" FOREIGN KEY ("current_track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "playback_queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_albums" ADD CONSTRAINT "saved_albums_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_albums" ADD CONSTRAINT "saved_albums_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_artists" ADD CONSTRAINT "saved_artists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_artists" ADD CONSTRAINT "saved_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
