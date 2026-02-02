/*
  Warnings:

  - You are about to drop the column `provider` on the `accounts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider_id]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "accounts_provider_provider_id_key";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "provider",
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_name_key" ON "accounts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_id_key" ON "accounts"("provider_id");
