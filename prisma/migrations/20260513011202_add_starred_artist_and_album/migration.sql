-- AlterTable
ALTER TABLE "album_annotations" ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "artist_annotations" ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;
