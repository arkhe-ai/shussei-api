import { Readable } from 'node:stream';
import { FilesController } from './files.controller';

describe('FilesController', () => {
  const files = {
    listContents: jest.fn(),
    listFiles: jest.fn(),
    createFolder: jest.fn(),
    getFolder: jest.fn(),
    breadcrumbs: jest.fn(),
    updateFolder: jest.fn(),
    deleteFolder: jest.fn(),
    uploadFile: jest.fn(),
    getFile: jest.fn(),
    openRead: jest.fn(),
    deleteFile: jest.fn(),
  } as any;
  const controller = new FilesController(files);

  beforeEach(() => jest.clearAllMocks());

  it('lists root files and folders using a nullable parent', async () => {
    files.listContents.mockResolvedValue({ folders: [], files: [] });

    await expect(controller.listFolders('channel-1')).resolves.toEqual({ folders: [], files: [] });
    expect(files.listContents).toHaveBeenCalledWith('channel-1', null);
  });

  it('creates a folder using the authenticated user', async () => {
    files.createFolder.mockResolvedValue({ id: 'folder-1' });
    const request = { user: { id: 'user-1' } } as any;

    await controller.createFolder('channel-1', request, { name: 'Fotos' });

    expect(files.createFolder).toHaveBeenCalledWith('channel-1', 'user-1', { name: 'Fotos' });
  });

  it('sets partial-content headers and streams only the requested bytes', async () => {
    files.getFile.mockResolvedValue({
      id: 'file-1',
      originalName: 'foto.png',
      mimeType: 'image/png',
      sizeBytes: 10n,
      status: 'ready',
    });
    files.openRead.mockReturnValue(Readable.from(['2345']));
    const response = {
      statusCode: 200,
      setHeader: jest.fn(),
    } as any;

    const result = await controller.downloadFile('file-1', { headers: { range: 'bytes=2-5' } } as any, response);

    expect(response.statusCode).toBe(206);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes 2-5/10');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', 4);
    expect(files.openRead).toHaveBeenCalledWith('file-1', { start: 2, end: 5 });
    expect(result).toBeDefined();
  });
});
