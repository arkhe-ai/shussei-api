import { FileCleanupService } from './file-cleanup.service';
import { StorageService } from '../storage/storage.service';

describe('FileCleanupService', () => {
  it('removes every file and tolerates idempotent storage deletion', async () => {
    const storage = { remove: jest.fn().mockResolvedValue(undefined) } as unknown as StorageService;
    const service = new FileCleanupService(storage);

    await service.removeFiles(['file-1', 'file-2']);

    expect(storage.remove).toHaveBeenNthCalledWith(1, 'file-1');
    expect(storage.remove).toHaveBeenNthCalledWith(2, 'file-2');
  });

  it('retries transient failures', async () => {
    const storage = {
      remove: jest.fn()
        .mockRejectedValueOnce(new Error('busy'))
        .mockResolvedValueOnce(undefined),
    } as unknown as StorageService;
    const service = new FileCleanupService(storage);

    await service.removeFiles(['file-1']);

    expect(storage.remove).toHaveBeenCalledTimes(2);
  });
});
