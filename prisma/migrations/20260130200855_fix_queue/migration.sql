/*
  Warnings:

  - You are about to drop the column `currentSongId` on the `playback_queues` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "playback_queues" DROP CONSTRAINT "playback_queues_currentSongId_fkey";

-- AlterTable
ALTER TABLE "playback_queues" DROP COLUMN "currentSongId",
ADD COLUMN     "currentTrackId" TEXT;

-- AddForeignKey
ALTER TABLE "playback_queues" ADD CONSTRAINT "playback_queues_currentTrackId_fkey" FOREIGN KEY ("currentTrackId") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
