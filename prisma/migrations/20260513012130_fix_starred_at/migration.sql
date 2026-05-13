/*
  Warnings:

  - Added the required column `updated_at` to the `album_annotations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `artist_annotations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "album_annotations" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "starred_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "artist_annotations" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "starred_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "album_annotations_user_id_starred_idx" ON "album_annotations"("user_id", "starred");

-- CreateIndex
CREATE INDEX "artist_annotations_user_id_starred_idx" ON "artist_annotations"("user_id", "starred");
