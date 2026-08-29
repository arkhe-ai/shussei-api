import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { mkdir, rename, stat as statFile, unlink } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StoragePathService } from './storage-path.service';

export type StorageStat = {
  sizeBytes: number;
  modifiedAt: Date;
};

@Injectable()
export class StorageService {
  constructor(private readonly paths: StoragePathService) {}

  async writeTemp(
    input: Readable,
    fileId: string,
    maxBytes = Number(process.env.MAX_FILE_SIZE_BYTES ?? 52_428_800),
  ): Promise<{ tempPath: string; sizeBytes: bigint; checksum: string }> {
    const tempPath = this.paths.tempPath(fileId);
    await mkdir(join(this.paths.root(), '.tmp'), { recursive: true });

    let sizeBytes = 0n;
    const hash = createHash('sha256');
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sizeBytes += BigInt(chunk.length);
        if (sizeBytes > BigInt(maxBytes)) {
          callback(new Error('file_size_limit_exceeded'));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(input, counter, createWriteStream(tempPath, { flags: 'wx' }));
      return { tempPath, sizeBytes, checksum: hash.digest('hex') };
    } catch (error) {
      await this.removePath(tempPath);
      throw error;
    }
  }

  async promote(tempPath: string, fileId: string): Promise<string> {
    const finalPath = this.paths.pathFor(fileId);
    await mkdir(dirname(finalPath), { recursive: true });
    await rename(tempPath, finalPath);
    return finalPath;
  }

  openRead(fileId: string, options?: { start?: number; end?: number }): Readable {
    return createReadStream(this.paths.pathFor(fileId), options);
  }

  async stat(fileId: string): Promise<StorageStat> {
    const result = await statFile(this.paths.pathFor(fileId));
    return { sizeBytes: result.size, modifiedAt: result.mtime };
  }

  async remove(fileId: string): Promise<void> {
    await this.removePath(this.paths.pathFor(fileId));
  }

  private async removePath(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

}
