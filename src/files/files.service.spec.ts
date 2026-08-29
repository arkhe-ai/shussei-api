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
    },
    storedFile: {
      findUnique: jest.fn(),
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
