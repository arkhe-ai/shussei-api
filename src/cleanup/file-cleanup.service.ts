import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);

  constructor(private readonly storage: StorageService) {}

  async removeFiles(fileIds: string[], maxAttempts = 3): Promise<void> {
    for (const fileId of fileIds) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          await this.storage.remove(fileId);
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts) await this.delay(attempt * 25);
        }
      }
      if (lastError) {
        this.logger.error(`physical file cleanup failed: ${fileId}`, lastError as Error);
        throw lastError;
      }
    }
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
