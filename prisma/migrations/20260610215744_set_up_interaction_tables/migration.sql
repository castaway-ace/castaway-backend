/*
  Warnings:

  - You are about to drop the column `last_used_at` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the `play_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "play_history" DROP CONSTRAINT "play_history_track_id_fkey";

-- DropForeignKey
ALTER TABLE "play_history" DROP CONSTRAINT "play_history_user_id_fkey";

-- AlterTable
ALTER TABLE "devices" DROP COLUMN "last_used_at",
ADD COLUMN     "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "play_history";

-- CreateTable
CREATE TABLE "play_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_played" INTEGER,
    "was_skipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "play_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_interactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "album_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "album_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_interactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "playlist_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlist_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_interactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artist_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "play_histories_user_id_played_at_idx" ON "play_histories"("user_id", "played_at" DESC);

-- CreateIndex
CREATE INDEX "play_histories_track_id_idx" ON "play_histories"("track_id");

-- CreateIndex
CREATE INDEX "album_interactions_user_id_updated_at_idx" ON "album_interactions"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "album_interactions_album_id_user_id_key" ON "album_interactions"("album_id", "user_id");

-- CreateIndex
CREATE INDEX "playlist_interactions_user_id_updated_at_idx" ON "playlist_interactions"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "playlist_interactions_playlist_id_user_id_key" ON "playlist_interactions"("playlist_id", "user_id");

-- CreateIndex
CREATE INDEX "artist_interactions_user_id_updated_at_idx" ON "artist_interactions"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "artist_interactions_artist_id_user_id_key" ON "artist_interactions"("artist_id", "user_id");

-- AddForeignKey
ALTER TABLE "play_histories" ADD CONSTRAINT "play_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_histories" ADD CONSTRAINT "play_histories_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_interactions" ADD CONSTRAINT "album_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_interactions" ADD CONSTRAINT "album_interactions_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_interactions" ADD CONSTRAINT "playlist_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_interactions" ADD CONSTRAINT "playlist_interactions_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_interactions" ADD CONSTRAINT "artist_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_interactions" ADD CONSTRAINT "artist_interactions_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
