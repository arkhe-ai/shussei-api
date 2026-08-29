import { BadRequestException, ConflictException, Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { PrismaService } from '../database/prisma.service';
import { FilesAccessService } from './files-access.service';
import { StorageService } from '../storage/storage.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

type FolderRecord = Prisma.FolderGetPayload<{
  include: { children: true; files: true };
}>;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FilesAccessService,
    private readonly storage: StorageService,
  ) {}

  async listContents(channelId: string, parentId: string | null) {
    await this.access.assertChannel(channelId);
    if (parentId) await this.access.assertFolder(parentId, channelId);

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: { channelId, parentId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.storedFile.findMany({
        where: { channelId, folderId: parentId, status: 'ready' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { folders, files: files.map((file) => this.toFileDto(file)) };
  }

  async createFolder(channelId: string, userId: string, input: CreateFolderDto) {
    await this.access.assertChannel(channelId);
    if (input.parentId) await this.access.assertFolder(input.parentId, channelId);

    try {
      return await this.prisma.folder.create({
        data: {
          channelId,
          parentId: input.parentId,
          name: input.name.trim(),
          createdByUserId: userId,
        },
      });
    } catch (error) {
      this.throwConflict(error);
    }
  }

  async uploadFile(
    channelId: string,
    userId: string,
    folderId: string | null,
    input: { stream: Readable; originalName: string; mimeType: string },
  ) {
    await this.access.assertChannel(channelId);
    if (folderId) await this.access.assertFolder(folderId, channelId);
    this.assertMimeType(input.mimeType);

    const fileId = randomUUID();
    const pending = await this.prisma.storedFile.create({
      data: {
        id: fileId,
        channelId,
        folderId,
        createdByUserId: userId,
        originalName: input.originalName.trim() || 'unnamed-file',
        mimeType: input.mimeType,
        sizeBytes: 0n,
        status: 'pending',
      },
    });

    try {
      const stored = await this.storage.writeTemp(input.stream, fileId);
      await this.storage.promote(stored.tempPath, fileId);
      const file = await this.prisma.storedFile.update({
        where: { id: pending.id },
        data: { sizeBytes: stored.sizeBytes, checksum: stored.checksum, status: 'ready' },
      });
      return this.toFileDto(file);
    } catch (error) {
      await this.storage.remove(fileId);
      await this.prisma.storedFile.deleteMany({ where: { id: fileId } });
      if (error instanceof Error && error.message === 'file_size_limit_exceeded') {
        throw new BadRequestException('file_size_limit_exceeded');
      }
      throw error;
    }
  }

  async getFolder(folderId: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      include: { children: { orderBy: { name: 'asc' } }, files: { where: { status: 'ready' }, orderBy: { createdAt: 'desc' } } },
    });
    if (!folder) throw new NotFoundException('folder_not_found');
    return this.toFolderDetailDto(folder);
  }

  async breadcrumbs(folderId: string) {
    await this.access.assertFolder(folderId);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; name: string; parentId: string | null }>>`
      WITH RECURSIVE ancestors AS (
        SELECT "id", "name", "parentId", 0 AS depth
        FROM "folders"
        WHERE "id" = ${folderId}::uuid
        UNION ALL
        SELECT parent."id", parent."name", parent."parentId", ancestors.depth + 1
        FROM "folders" parent
        JOIN ancestors ON ancestors."parentId" = parent."id"
      )
      SELECT "id", "name", "parentId"
      FROM ancestors
      ORDER BY depth DESC
    `;
    return rows;
  }

  async updateFolder(folderId: string, input: UpdateFolderDto) {
    const folder = await this.access.assertFolder(folderId);
    const parentId = input.parentId === undefined ? folder.parentId : input.parentId;

    if (parentId) {
      await this.access.assertFolder(parentId, folder.channelId);
      const descendants = await this.prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE descendants AS (
          SELECT "id" FROM "folders" WHERE "id" = ${folderId}::uuid
          UNION ALL
          SELECT child."id" FROM "folders" child
          JOIN descendants ON child."parentId" = descendants."id"
        )
        SELECT "id" FROM descendants
      `;
      if (descendants.some((item) => item.id === parentId)) {
        throw new ConflictException('folder_cycle');
      }
    }

    try {
      return await this.prisma.folder.update({
        where: { id: folderId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.parentId === undefined ? {} : { parentId }),
        },
      });
    } catch (error) {
      this.throwConflict(error);
    }
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.access.assertFolder(folderId);
    await this.prisma.folder.delete({ where: { id: folderId } });
  }

  private toFolderDetailDto(folder: FolderRecord) {
    return {
      folder: folder,
      folders: folder.children,
      files: folder.files.map((file) => this.toFileDto(file)),
    };
  }

  private assertMimeType(mimeType: string): void {
    const allowed = new Set(
      (process.env.ALLOWED_FILE_MIME_TYPES ?? 'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (!allowed.has(mimeType)) throw new UnsupportedMediaTypeException('file_mime_type_not_allowed');
  }

  private toFileDto(file: { id: string; originalName: string; mimeType: string; sizeBytes: bigint; createdAt: Date }) {
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
      createdAt: file.createdAt,
      downloadUrl: `/api/v1/files/${file.id}`,
    };
  }

  private throwConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('folder_name_already_exists');
    }
    throw error;
  }
}
