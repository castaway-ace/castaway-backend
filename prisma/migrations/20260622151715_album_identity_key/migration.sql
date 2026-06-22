/*
  Warnings:

  - A unique constraint covering the columns `[identity_key]` on the table `albums` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `identity_key` to the `albums` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "albums" ADD COLUMN     "identity_key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "albums_identity_key_key" ON "albums"("identity_key");
