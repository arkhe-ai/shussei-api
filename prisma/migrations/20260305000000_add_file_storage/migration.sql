CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channelId" TEXT NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channelId" TEXT NOT NULL,
    "folderId" UUID,
    "createdByUserId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "folders_channelId_parentId_name_idx"
    ON "folders"("channelId", "parentId", "name");
CREATE INDEX "folders_createdByUserId_idx"
    ON "folders"("createdByUserId");
CREATE INDEX "files_channelId_folderId_createdAt_idx"
    ON "files"("channelId", "folderId", "createdAt");
CREATE INDEX "files_createdByUserId_idx"
    ON "files"("createdByUserId");
CREATE INDEX "files_status_idx"
    ON "files"("status");

CREATE UNIQUE INDEX "folders_channel_parent_name_key"
    ON "folders"("channelId", "parentId", "name") NULLS NOT DISTINCT;

ALTER TABLE "folders"
    ADD CONSTRAINT "folders_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "channels"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "folders"
    ADD CONSTRAINT "folders_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "folders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "folders"
    ADD CONSTRAINT "folders_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "files"
    ADD CONSTRAINT "files_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "channels"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "files"
    ADD CONSTRAINT "files_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "folders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "files"
    ADD CONSTRAINT "files_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
