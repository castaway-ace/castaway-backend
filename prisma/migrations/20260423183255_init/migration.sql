/*
  Warnings:

  - The primary key for the `accounts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `album_artists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `albums` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `image_url` on the `albums` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `albums` table. All the data in the column will be lost.
  - The primary key for the `artists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `image_url` on the `artists` table. All the data in the column will be lost.
  - The primary key for the `playlist_tracks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `added_at` on the `playlist_tracks` table. All the data in the column will be lost.
  - The primary key for the `playlists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `user_id` on the `playlists` table. All the data in the column will be lost.
  - The primary key for the `refresh_tokens` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `track_artists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `tracks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `password_hash` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `genres` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `liked_tracks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `track_genres` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_mfa` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[playlist_id,position]` on the table `playlist_tracks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[owner_id,name]` on the table `playlists` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[file_key]` on the table `tracks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[display_name]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `id` on the `accounts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `accounts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `album_id` on the `album_artists` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `artist_id` on the `album_artists` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `name` to the `albums` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `albums` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `artists` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - The required column `id` was added to the `playlist_tracks` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Changed the type of `playlist_id` on the `playlist_tracks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `track_id` on the `playlist_tracks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `owner_id` to the `playlists` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `playlists` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `refresh_tokens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `refresh_tokens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `track_id` on the `track_artists` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `artist_id` on the `track_artists` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `file_key` to the `tracks` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `tracks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `album_id` on the `tracks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "album_artists" DROP CONSTRAINT "album_artists_album_id_fkey";

-- DropForeignKey
ALTER TABLE "album_artists" DROP CONSTRAINT "album_artists_artist_id_fkey";

-- DropForeignKey
ALTER TABLE "liked_tracks" DROP CONSTRAINT "liked_tracks_track_id_fkey";

-- DropForeignKey
ALTER TABLE "liked_tracks" DROP CONSTRAINT "liked_tracks_user_id_fkey";

-- DropForeignKey
ALTER TABLE "playlist_tracks" DROP CONSTRAINT "playlist_tracks_playlist_id_fkey";

-- DropForeignKey
ALTER TABLE "playlist_tracks" DROP CONSTRAINT "playlist_tracks_track_id_fkey";

-- DropForeignKey
ALTER TABLE "playlists" DROP CONSTRAINT "playlists_user_id_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "track_artists" DROP CONSTRAINT "track_artists_artist_id_fkey";

-- DropForeignKey
ALTER TABLE "track_artists" DROP CONSTRAINT "track_artists_track_id_fkey";

-- DropForeignKey
ALTER TABLE "track_genres" DROP CONSTRAINT "track_genres_genre_id_fkey";

-- DropForeignKey
ALTER TABLE "track_genres" DROP CONSTRAINT "track_genres_track_id_fkey";

-- DropForeignKey
ALTER TABLE "tracks" DROP CONSTRAINT "tracks_album_id_fkey";

-- DropForeignKey
ALTER TABLE "user_mfa" DROP CONSTRAINT "user_mfa_user_id_fkey";

-- DropIndex
DROP INDEX "album_artists_artist_id_idx";

-- DropIndex
DROP INDEX "albums_title_idx";

-- DropIndex
DROP INDEX "playlists_user_id_idx";

-- DropIndex
DROP INDEX "track_artists_artist_id_idx";

-- AlterTable
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "album_artists" DROP CONSTRAINT "album_artists_pkey",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT '',
DROP COLUMN "album_id",
ADD COLUMN     "album_id" UUID NOT NULL,
DROP COLUMN "artist_id",
ADD COLUMN     "artist_id" UUID NOT NULL,
ADD CONSTRAINT "album_artists_pkey" PRIMARY KEY ("album_id", "artist_id");

-- AlterTable
ALTER TABLE "albums" DROP CONSTRAINT "albums_pkey",
DROP COLUMN "image_url",
DROP COLUMN "title",
ADD COLUMN     "compilation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "genres" TEXT[],
ADD COLUMN     "image_key" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "release_date" DROP NOT NULL,
ADD CONSTRAINT "albums_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "artists" DROP CONSTRAINT "artists_pkey",
DROP COLUMN "image_url",
ADD COLUMN     "image_key" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "artists_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "playlist_tracks" DROP CONSTRAINT "playlist_tracks_pkey",
DROP COLUMN "added_at",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "playlist_id",
ADD COLUMN     "playlist_id" UUID NOT NULL,
DROP COLUMN "track_id",
ADD COLUMN     "track_id" UUID NOT NULL,
ADD CONSTRAINT "playlist_tracks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "playlists" DROP CONSTRAINT "playlists_pkey",
DROP COLUMN "user_id",
ADD COLUMN     "owner_id" UUID NOT NULL,
ADD COLUMN     "public" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "playlists_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_pkey",
ADD COLUMN     "device_name" TEXT,
ADD COLUMN     "device_type" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "track_artists" DROP CONSTRAINT "track_artists_pkey",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sub_role" TEXT NOT NULL DEFAULT '',
DROP COLUMN "track_id",
ADD COLUMN     "track_id" UUID NOT NULL,
DROP COLUMN "artist_id",
ADD COLUMN     "artist_id" UUID NOT NULL,
ADD CONSTRAINT "track_artists_pkey" PRIMARY KEY ("track_id", "artist_id");

-- AlterTable
ALTER TABLE "tracks" DROP CONSTRAINT "tracks_pkey",
ADD COLUMN     "bit_depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bit_rate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "disc_number" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "file_key" TEXT NOT NULL,
ADD COLUMN     "genres" TEXT[],
ADD COLUMN     "release_date" DATE,
ADD COLUMN     "sample_rate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "size" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suffix" VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "album_id",
ADD COLUMN     "album_id" UUID NOT NULL,
ADD CONSTRAINT "tracks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "password_hash",
DROP COLUMN "username",
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "password" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "genres";

-- DropTable
DROP TABLE "liked_tracks";

-- DropTable
DROP TABLE "track_genres";

-- DropTable
DROP TABLE "user_mfa";

-- CreateTable
CREATE TABLE "track_annotations" (
    "user_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "play_date" TIMESTAMP(3),
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "liked_at" TIMESTAMP(3),

    CONSTRAINT "track_annotations_pkey" PRIMARY KEY ("user_id","track_id")
);

-- CreateTable
CREATE TABLE "album_annotations" (
    "user_id" UUID NOT NULL,
    "album_id" UUID NOT NULL,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "liked_at" TIMESTAMP(3),

    CONSTRAINT "album_annotations_pkey" PRIMARY KEY ("user_id","album_id")
);

-- CreateTable
CREATE TABLE "artist_annotations" (
    "user_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "liked_at" TIMESTAMP(3),

    CONSTRAINT "artist_annotations_pkey" PRIMARY KEY ("user_id","artist_id")
);

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "album_artists_role_idx" ON "album_artists"("role");

-- CreateIndex
CREATE INDEX "albums_created_at_idx" ON "albums"("created_at");

-- CreateIndex
CREATE INDEX "albums_name_idx" ON "albums"("name");

-- CreateIndex
CREATE INDEX "albums_genres_idx" ON "albums" USING GIN ("genres");

-- CreateIndex
CREATE INDEX "playlist_tracks_track_id_idx" ON "playlist_tracks"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_tracks_playlist_id_position_key" ON "playlist_tracks"("playlist_id", "position");

-- CreateIndex
CREATE INDEX "playlists_created_at_idx" ON "playlists"("created_at");

-- CreateIndex
CREATE INDEX "playlists_updated_at_idx" ON "playlists"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "playlists_owner_id_name_key" ON "playlists"("owner_id", "name");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "track_artists_role_idx" ON "track_artists"("role");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_file_key_key" ON "tracks"("file_key");

-- CreateIndex
CREATE INDEX "tracks_album_id_idx" ON "tracks"("album_id");

-- CreateIndex
CREATE INDEX "tracks_disc_number_track_number_idx" ON "tracks"("disc_number", "track_number");

-- CreateIndex
CREATE INDEX "tracks_genres_idx" ON "tracks" USING GIN ("genres");

-- CreateIndex
CREATE UNIQUE INDEX "users_display_name_key" ON "users"("display_name");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_annotations" ADD CONSTRAINT "track_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_annotations" ADD CONSTRAINT "track_annotations_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_annotations" ADD CONSTRAINT "album_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_annotations" ADD CONSTRAINT "album_annotations_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_annotations" ADD CONSTRAINT "artist_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_annotations" ADD CONSTRAINT "artist_annotations_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
