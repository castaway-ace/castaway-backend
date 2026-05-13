/*
  Warnings:

  - You are about to drop the column `created_at` on the `album_annotations` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `album_annotations` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `artist_annotations` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `artist_annotations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "album_annotations" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ALTER COLUMN "starred_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "artist_annotations" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ALTER COLUMN "starred_at" DROP NOT NULL;
