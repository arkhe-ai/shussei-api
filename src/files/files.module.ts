import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { FileCleanupService } from '../cleanup/file-cleanup.service';
import { DatabaseModule } from '../database/database.module';
import { FilesAccessService } from './files-access.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [AuthModule, DatabaseModule, StorageModule],
  controllers: [FilesController],
  providers: [FilesAccessService, FilesService, FileCleanupService],
  exports: [FilesService],
})
export class FilesModule {}
