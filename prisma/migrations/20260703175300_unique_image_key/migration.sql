/*
  Warnings:

  - A unique constraint covering the columns `[image_key]` on the table `albums` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "albums_image_key_key" ON "albums"("image_key");
