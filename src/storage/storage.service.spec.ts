import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { StoragePathService } from './storage-path.service';
import { StorageService } from './storage.service';

describe('StoragePathService', () => {
  it('partitions a UUID using its first four characters', () => {
    const service = new StoragePathService();
    const path = service.pathFor('550e8400-e29b-41d4-a716-446655440000');

    expect(path).toMatch(/55[\\/]0e[\\/]550e8400-e29b-41d4-a716-446655440000\.bin$/);
  });

  it('rejects values that are not UUIDs', () => {
    expect(() => new StoragePathService().pathFor('../outside')).toThrow('invalid_storage_file_id');
  });
});

describe('StorageService', () => {
  let root: string;
  let service: StorageService;

  beforeEach(async () => {
    root = await mkdtemp(`${tmpdir()}/shussei-storage-`);
    process.env.STORAGE_ROOT_PATH = root;
    service = new StorageService(new StoragePathService());
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    delete process.env.STORAGE_ROOT_PATH;
  });

  it('writes a stream to a temporary file and promotes it', async () => {
    const fileId = randomUUID();
    const content = Buffer.from('shussei file content');
    const result = await service.writeTemp(Readable.from([content]), fileId);
    const finalPath = await service.promote(result.tempPath, fileId);

    expect(result.sizeBytes).toBe(BigInt(content.length));
    expect(result.checksum).toBe('e82e9b548134f573cb239a53080940f36a25e4b7f6804ae63fe1041c01a48eec');
    await expect(readFile(finalPath)).resolves.toEqual(content);
  });

  it('reads a bounded range and deletes an existing or absent file idempotently', async () => {
    const fileId = randomUUID();
    const result = await service.writeTemp(Readable.from(['0123456789']), fileId);
    await service.promote(result.tempPath, fileId);

    const chunks: Buffer[] = [];
    for await (const chunk of service.openRead(fileId, { start: 2, end: 5 })) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('2345');

    await service.remove(fileId);
    await expect(service.remove(fileId)).resolves.toBeUndefined();
  });
});
