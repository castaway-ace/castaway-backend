/*
  Warnings:

  - A unique constraint covering the columns `[user_id,client_id]` on the table `devices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `client_id` to the `devices` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "devices_name_model_key";

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "client_id" UUID NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "model" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_client_id_key" ON "devices"("user_id", "client_id");
