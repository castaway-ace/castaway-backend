/*
  Warnings:

  - You are about to drop the `referral_codes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "referral_codes" DROP CONSTRAINT "referral_codes_createdById_fkey";

-- DropForeignKey
ALTER TABLE "referral_codes" DROP CONSTRAINT "referral_codes_usedById_fkey";

-- DropTable
DROP TABLE "referral_codes";
