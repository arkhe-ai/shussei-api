import { Global, Module } from '@nestjs/common';
import { StoragePathService } from './storage-path.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StoragePathService, StorageService],
  exports: [StoragePathService, StorageService],
})
export class StorageModule {}
