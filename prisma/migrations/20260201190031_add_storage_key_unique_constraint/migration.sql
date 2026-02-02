/*
  Warnings:

  - A unique constraint covering the columns `[storageKey]` on the table `audio_files` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "audio_files_storageKey_key" ON "audio_files"("storageKey");
