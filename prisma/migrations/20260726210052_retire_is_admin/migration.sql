-- Retire the legacy is_admin boolean. Authorization now derives entirely from
-- the roles[] column (admins were backfilled to [ADMIN] in the rbac_roles
-- migration), so this column is no longer read by the application.

-- AlterTable
ALTER TABLE "users" DROP COLUMN "is_admin";
