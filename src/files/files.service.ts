import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { FilesAccessService } from './files-access.service';
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
