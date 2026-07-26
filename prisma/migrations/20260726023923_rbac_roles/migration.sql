-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "roles" "Role"[] DEFAULT ARRAY['USER']::"Role"[];

-- Backfill: existing admins get the ADMIN role. The column default already
-- assigned every other existing row the [USER] role.
UPDATE "users" SET "roles" = ARRAY['ADMIN']::"Role"[] WHERE "is_admin" = true;
