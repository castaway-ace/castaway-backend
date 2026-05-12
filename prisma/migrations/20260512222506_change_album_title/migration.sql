/*
  Warnings:

  - You are about to drop the column `name` on the `albums` table. All the data in the column will be lost.
  - Added the required column `title` to the `albums` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "albums_name_idx";

-- AlterTable
ALTER TABLE "albums" DROP COLUMN "name",
ADD COLUMN     "title" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "albums_title_idx" ON "albums"("title");
