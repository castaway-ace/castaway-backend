-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "ArtistRole" AS ENUM ('PRIMARY', 'FEATURED', 'PRODUCER', 'COMPOSER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_name" TEXT,
    "device_type" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_codes" (
    "id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_genres" (
    "album_id" UUID NOT NULL,
    "genre_id" UUID NOT NULL,

    CONSTRAINT "album_genres_pkey" PRIMARY KEY ("album_id","genre_id")
);

-- CreateTable
CREATE TABLE "track_genres" (
    "track_id" UUID NOT NULL,
    "genre_id" UUID NOT NULL,

    CONSTRAINT "track_genres_pkey" PRIMARY KEY ("track_id","genre_id")
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
    "release_date" DATE,
    "compilation" BOOLEAN NOT NULL DEFAULT false,
    "image_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_artists" (
    "album_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "role" "ArtistRole" NOT NULL DEFAULT 'PRIMARY',

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
    "size" INTEGER,
    "suffix" VARCHAR(16),
    "bit_rate" INTEGER,
    "sample_rate" INTEGER,
    "bit_depth" INTEGER,
    "release_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_artists" (
    "track_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "role" "ArtistRole" NOT NULL DEFAULT 'PRIMARY',
    "sub_role" TEXT,

    CONSTRAINT "track_artists_pkey" PRIMARY KEY ("track_id","artist_id","role")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "public" BOOLEAN NOT NULL DEFAULT false,
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
CREATE TABLE "play_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "played_ms" INTEGER,

    CONSTRAINT "play_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_annotations" (
    "user_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "last_played_at" TIMESTAMP(3),
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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_display_name_key" ON "users"("display_name");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_id_key" ON "accounts"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_key" ON "refresh_tokens"("replaced_by_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "authorization_codes_code_hash_key" ON "authorization_codes"("code_hash");

-- CreateIndex
CREATE INDEX "authorization_codes_user_id_idx" ON "authorization_codes"("user_id");

-- CreateIndex
CREATE INDEX "authorization_codes_expires_at_idx" ON "authorization_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE INDEX "album_genres_genre_id_idx" ON "album_genres"("genre_id");

-- CreateIndex
CREATE INDEX "track_genres_genre_id_idx" ON "track_genres"("genre_id");

-- CreateIndex
CREATE INDEX "artists_name_idx" ON "artists"("name");

-- CreateIndex
CREATE INDEX "albums_created_at_idx" ON "albums"("created_at");

-- CreateIndex
CREATE INDEX "albums_name_idx" ON "albums"("name");

-- CreateIndex
CREATE INDEX "album_artists_role_idx" ON "album_artists"("role");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_file_key_key" ON "tracks"("file_key");

-- CreateIndex
CREATE INDEX "tracks_title_idx" ON "tracks"("title");

-- CreateIndex
CREATE INDEX "tracks_album_id_idx" ON "tracks"("album_id");

-- CreateIndex
CREATE INDEX "tracks_disc_number_track_number_idx" ON "tracks"("disc_number", "track_number");

-- CreateIndex
CREATE INDEX "track_artists_role_idx" ON "track_artists"("role");

-- CreateIndex
CREATE INDEX "playlists_owner_id_idx" ON "playlists"("owner_id");

-- CreateIndex
CREATE INDEX "playlists_created_at_idx" ON "playlists"("created_at");

-- CreateIndex
CREATE INDEX "playlists_updated_at_idx" ON "playlists"("updated_at");

-- CreateIndex
CREATE INDEX "playlist_tracks_track_id_idx" ON "playlist_tracks"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_tracks_playlist_id_position_key" ON "playlist_tracks"("playlist_id", "position");

-- CreateIndex
CREATE INDEX "play_events_user_id_played_at_idx" ON "play_events"("user_id", "played_at" DESC);

-- CreateIndex
CREATE INDEX "play_events_track_id_idx" ON "play_events"("track_id");

-- CreateIndex
CREATE INDEX "track_annotations_user_id_liked_idx" ON "track_annotations"("user_id", "liked");

-- CreateIndex
CREATE INDEX "track_annotations_user_id_last_played_at_idx" ON "track_annotations"("user_id", "last_played_at" DESC);

-- CreateIndex
CREATE INDEX "album_annotations_user_id_liked_idx" ON "album_annotations"("user_id", "liked");

-- CreateIndex
CREATE INDEX "artist_annotations_user_id_liked_idx" ON "artist_annotations"("user_id", "liked");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_genres" ADD CONSTRAINT "album_genres_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_genres" ADD CONSTRAINT "album_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "play_events" ADD CONSTRAINT "play_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_events" ADD CONSTRAINT "play_events_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
