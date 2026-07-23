-- CreateEnum
CREATE TYPE "ImportSessionStatus" AS ENUM ('PENDING_UPLOAD', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'ABORTED');

-- CreateEnum
CREATE TYPE "ImportPhase" AS ENUM ('PARSING', 'COPYING', 'PERSISTING', 'CLEANUP');

-- CreateTable
CREATE TABLE "import_sessions" (
    "id" UUID NOT NULL,
    "status" "ImportSessionStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "phase" "ImportPhase",
    "progress_current" INTEGER NOT NULL DEFAULT 0,
    "progress_total" INTEGER NOT NULL DEFAULT 0,
    "error" JSONB,
    "album_id" UUID,
    "created_by" UUID NOT NULL,
    "part_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queued_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_files" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "object_key" TEXT NOT NULL,
    "upload_id" TEXT,
    "part_count" INTEGER,
    "uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_sessions_status_created_at_idx" ON "import_sessions"("status", "created_at");

-- CreateIndex
CREATE INDEX "import_files_session_id_idx" ON "import_files"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_files_session_id_object_key_key" ON "import_files"("session_id", "object_key");

-- AddForeignKey
ALTER TABLE "import_files" ADD CONSTRAINT "import_files_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
