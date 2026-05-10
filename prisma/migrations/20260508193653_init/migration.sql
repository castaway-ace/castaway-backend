-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "image_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "release_date" DATE NOT NULL,
    "compilation" BOOLEAN NOT NULL DEFAULT false,
    "image_key" TEXT,
    "genres" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_artists" (
    "album_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,

    CONSTRAINT "album_artists_pkey" PRIMARY KEY ("album_id","artist_id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "album_id" UUID NOT NULL,
    "track_number" INTEGER NOT NULL,
    "disc_number" INTEGER NOT NULL DEFAULT 1,
    "duration" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "codec" VARCHAR(16) NOT NULL,
    "suffix" VARCHAR(16) NOT NULL,
    "genres" TEXT[],
    "bit_rate" INTEGER NOT NULL,
    "sample_rate" INTEGER NOT NULL,
    "bit_depth" INTEGER,
    "release_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_artists" (
    "track_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,

    CONSTRAINT "track_artists_pkey" PRIMARY KEY ("track_id","artist_id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_tracks" (
    "id" UUID NOT NULL,
    "playlist_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "playlist_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "play_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_played" INTEGER,
    "was_skipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "play_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_annotations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "starred_at" TIMESTAMP(3),
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "last_played" TIMESTAMP(3),
    "skip_count" INTEGER NOT NULL DEFAULT 0,
    "last_skipped" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_annotations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "album_id" UUID NOT NULL,
    "starred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_annotations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "starred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_name_key" ON "users"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "artists_name_idx" ON "artists"("name");

-- CreateIndex
CREATE INDEX "albums_created_at_idx" ON "albums"("created_at");

-- CreateIndex
CREATE INDEX "albums_name_idx" ON "albums"("name");

-- CreateIndex
CREATE INDEX "album_artists_artist_id_idx" ON "album_artists"("artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_file_key_key" ON "tracks"("file_key");

-- CreateIndex
CREATE INDEX "tracks_title_idx" ON "tracks"("title");

-- CreateIndex
CREATE INDEX "tracks_album_id_disc_number_track_number_idx" ON "tracks"("album_id", "disc_number", "track_number");

-- CreateIndex
CREATE INDEX "track_artists_artist_id_idx" ON "track_artists"("artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "playlists_owner_id_position_key" ON "playlists"("owner_id", "position");

-- CreateIndex
CREATE INDEX "playlist_tracks_track_id_idx" ON "playlist_tracks"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_tracks_playlist_id_position_key" ON "playlist_tracks"("playlist_id", "position");

-- CreateIndex
CREATE INDEX "play_history_user_id_played_at_idx" ON "play_history"("user_id", "played_at" DESC);

-- CreateIndex
CREATE INDEX "play_history_track_id_idx" ON "play_history"("track_id");

-- CreateIndex
CREATE INDEX "track_annotations_user_id_starred_idx" ON "track_annotations"("user_id", "starred");

-- CreateIndex
CREATE INDEX "track_annotations_user_id_last_played_idx" ON "track_annotations"("user_id", "last_played");

-- CreateIndex
CREATE UNIQUE INDEX "track_annotations_user_id_track_id_key" ON "track_annotations"("user_id", "track_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_annotations_user_id_album_id_key" ON "album_annotations"("user_id", "album_id");

-- CreateIndex
CREATE UNIQUE INDEX "artist_annotations_user_id_artist_id_key" ON "artist_annotations"("user_id", "artist_id");

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
ALTER TABLE "play_history" ADD CONSTRAINT "play_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_history" ADD CONSTRAINT "play_history_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
