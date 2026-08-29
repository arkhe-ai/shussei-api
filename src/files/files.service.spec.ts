import { FilesService } from './files.service';
import { FilesAccessService } from './files-access.service';
import { StorageService } from '../storage/storage.service';
import { FileCleanupService } from '../cleanup/file-cleanup.service';

describe('FilesService', () => {
  const prisma = {
    channel: { findUnique: jest.fn() },
    folder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    storedFile: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  } as any;
  const access = { assertChannel: jest.fn(), assertFolder: jest.fn() } as any;
  const storage = { remove: jest.fn(), writeTemp: jest.fn(), promote: jest.fn() } as any;
  const cleanup = { removeFiles: jest.fn().mockResolvedValue(undefined) } as any;
  const service = new FilesService(prisma, access, storage, cleanup);

  beforeEach(() => jest.clearAllMocks());

  it('updates a file name and moves it within the same channel', async () => {
    prisma.storedFile.findUnique.mockResolvedValue({ id: 'file-1', status: 'ready', channelId: 'channel-1' });
    access.assertFolder.mockResolvedValue({ id: 'folder-1', channelId: 'channel-1' });
    prisma.storedFile.update.mockResolvedValue({
      id: 'file-1', originalName: 'renamed.png', mimeType: 'image/png', sizeBytes: 12n, createdAt: new Date(),
    });

    await expect(service.updateFile('file-1', { originalName: 'renamed.png', folderId: 'folder-1' })).resolves.toMatchObject({
      originalName: 'renamed.png', sizeBytes: 12,
    });
    expect(prisma.storedFile.update).toHaveBeenCalled();
  });

  it('deletes metadata and then the physical file', async () => {
    prisma.storedFile.findUnique.mockResolvedValue({ id: 'file-1', status: 'ready' });
    prisma.storedFile.delete.mockResolvedValue(undefined);

    await service.deleteFile('file-1');

    expect(prisma.storedFile.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
    expect(cleanup.removeFiles).toHaveBeenCalledWith(['file-1']);
  });

  it('collects descendant file IDs before deleting a folder cascade', async () => {
    access.assertFolder.mockResolvedValue({ id: 'folder-1' });
    prisma.$queryRaw.mockResolvedValue([{ id: 'file-1' }, { id: 'file-2' }]);
    prisma.folder.delete.mockResolvedValue(undefined);

    await service.deleteFolder('folder-1');

    expect(prisma.folder.delete).toHaveBeenCalledWith({ where: { id: 'folder-1' } });
    expect(cleanup.removeFiles).toHaveBeenCalledWith(['file-1', 'file-2']);
  });
});
