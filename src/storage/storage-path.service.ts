import { Injectable } from '@nestjs/common';
import { join, resolve } from 'node:path';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class StoragePathService {
  private readonly rootPath = resolve(process.env.STORAGE_ROOT_PATH ?? './storage');

  root(): string {
    return this.rootPath;
  }

  pathFor(fileId: string): string {
    if (!UUID_PATTERN.test(fileId)) {
      throw new Error('invalid_storage_file_id');
    }

    const normalizedId = fileId.toLowerCase();
    return join(this.rootPath, normalizedId.slice(0, 2), normalizedId.slice(2, 4), `${normalizedId}.bin`);
  }

  tempPath(fileId: string): string {
    if (!UUID_PATTERN.test(fileId)) {
      throw new Error('invalid_storage_file_id');
    }

    return join(this.rootPath, '.tmp', `${fileId.toLowerCase()}.${process.pid}.${Date.now()}.upload`);
  }
}
