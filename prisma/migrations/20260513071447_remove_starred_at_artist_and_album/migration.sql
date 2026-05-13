/*
  Warnings:

  - You are about to drop the column `starred_at` on the `album_annotations` table. All the data in the column will be lost.
  - You are about to drop the column `starred_at` on the `artist_annotations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "album_annotations" DROP COLUMN "starred_at";

-- AlterTable
ALTER TABLE "artist_annotations" DROP COLUMN "starred_at";
