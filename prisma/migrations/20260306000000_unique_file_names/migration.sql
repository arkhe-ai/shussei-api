CREATE UNIQUE INDEX "files_channel_folder_name_key"
    ON "files"("channelId", "folderId", "originalName") NULLS NOT DISTINCT;
