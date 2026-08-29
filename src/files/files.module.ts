import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { FilesAccessService } from './files-access.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FilesController],
  providers: [FilesAccessService, FilesService],
  exports: [FilesService],
})
export class FilesModule {}
