/*
  Warnings:

  - A unique constraint covering the columns `[title,artistId]` on the table `albums` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "albums_title_artistId_releaseYear_key";

-- CreateIndex
CREATE UNIQUE INDEX "albums_title_artistId_key" ON "albums"("title", "artistId");
