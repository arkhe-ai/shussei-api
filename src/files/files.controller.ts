import Busboy from 'busboy';
import {
  Body,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { JwtSessionGuard } from '../auth/jwt-session.guard';
import type { SessionUser } from '../common/types/session-user';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { FilesService } from './files.service';

type AuthenticatedRequest = Request & { user?: SessionUser };

@Controller('/api/v1')
@UseGuards(JwtSessionGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('/channels/:channelId/folders')
  listFolders(@Param('channelId') channelId: string, @Query('parentId') parentId?: string) {
    return this.filesService.listContents(channelId, this.parseNullableId(parentId));
  }

  @Post('/channels/:channelId/folders')
  @HttpCode(HttpStatus.CREATED)
  createFolder(
    @Param('channelId') channelId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateFolderDto,
  ) {
    return this.filesService.createFolder(channelId, request.user!.id, body);
  }

  @Get('/channels/:channelId/files')
  async listFiles(@Param('channelId') channelId: string, @Query('folderId') folderId?: string) {
    return { files: await this.filesService.listFiles(channelId, this.parseNullableId(folderId)) };
  }

  @Post('/channels/:channelId/files')
  @HttpCode(HttpStatus.CREATED)
  uploadFile(
    @Param('channelId') channelId: string,
    @Req() request: AuthenticatedRequest,
    @Query('folderId') folderId?: string,
  ) {
    return this.parseUpload(request).then(({ stream, originalName, mimeType }) =>
      this.filesService.uploadFile(channelId, request.user!.id, this.parseNullableId(folderId), {
        stream,
        originalName,
        mimeType,
      }),
    );
  }

  @Get('/files/:fileId')
  downloadFile(
    @Param('fileId') fileId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.streamFile(fileId, request.headers.range, response);
  }

  @Head('/files/:fileId')
  @HttpCode(HttpStatus.OK)
  headFile(
    @Param('fileId') fileId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    return this.setFileHeaders(fileId, request.headers.range, response);
  }

  @Delete('/files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(@Param('fileId') fileId: string): Promise<void> {
    await this.filesService.deleteFile(fileId);
  }

  @Get('/folders/:folderId')
  getFolder(@Param('folderId') folderId: string) {
    return this.filesService.getFolder(folderId);
  }

  @Get('/folders/:folderId/breadcrumbs')
  async breadcrumbs(@Param('folderId') folderId: string) {
    return { breadcrumbs: await this.filesService.breadcrumbs(folderId) };
  }

  @Patch('/folders/:folderId')
  updateFolder(@Param('folderId') folderId: string, @Body() body: UpdateFolderDto) {
    return this.filesService.updateFolder(folderId, body);
  }

  @Delete('/folders/:folderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFolder(@Param('folderId') folderId: string): Promise<void> {
    await this.filesService.deleteFolder(folderId);
  }

  private async streamFile(fileId: string, range: string | undefined, response: Response) {
    const file = await this.filesService.getFile(fileId);
    const size = Number(file.sizeBytes);
    const parsedRange = this.parseRange(range, size);
    if (parsedRange === null && range) {
      response.statusCode = HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE;
      response.setHeader('Content-Range', `bytes */${size}`);
      return new StreamableFile(Readable.from([]));
    }

    const start = parsedRange?.start ?? 0;
    const end = parsedRange?.end ?? Math.max(size - 1, 0);
    response.statusCode = parsedRange ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK;
    this.setDownloadHeaders(response, file.originalName, file.mimeType, end - start + 1, size, parsedRange);
    return new StreamableFile(this.filesService.openRead(fileId, { start, end }));
  }

  private async setFileHeaders(fileId: string, range: string | undefined, response: Response): Promise<void> {
    const file = await this.filesService.getFile(fileId);
    const size = Number(file.sizeBytes);
    const parsedRange = this.parseRange(range, size);
    if (parsedRange === null && range) {
      response.statusCode = HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE;
      response.setHeader('Content-Range', `bytes */${size}`);
      return;
    }
    const start = parsedRange?.start ?? 0;
    const end = parsedRange?.end ?? Math.max(size - 1, 0);
    response.statusCode = parsedRange ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK;
    this.setDownloadHeaders(response, file.originalName, file.mimeType, end - start + 1, size, parsedRange);
  }

  private setDownloadHeaders(
    response: Response,
    originalName: string,
    mimeType: string,
    contentLength: number,
    size: number,
    range: { start: number; end: number } | null,
  ): void {
    const safeName = originalName.replace(/[\r\n"\\]/g, '_') || 'download';
    response.setHeader('Content-Type', mimeType);
    response.setHeader('Content-Length', contentLength);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Disposition', `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    if (range) response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  }

  private parseRange(range: string | undefined, size: number): { start: number; end: number } | null {
    if (!range) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]) || size === 0) return null;
    if (!match[1]) {
      const suffixLength = Number(match[2]);
      if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
      return { start: Math.max(size - suffixLength, 0), end: size - 1 };
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) return null;
    return { start, end: Math.min(end, size - 1) };
  }

  private parseNullableId(value?: string): string | null {
    return !value || value === 'null' ? null : value;
  }

  private parseUpload(request: AuthenticatedRequest): Promise<{
    stream: import('node:stream').Readable;
    originalName: string;
    mimeType: string;
  }> {
    return new Promise((resolve, reject) => {
      const contentType = request.headers['content-type'];
      if (!contentType) {
        reject(new Error('multipart_content_type_required'));
        return;
      }

      const parser = Busboy({
        headers: { 'content-type': contentType },
        limits: { files: 1, fields: 0 },
      });
      let settled = false;

      parser.on('file', (_fieldName, stream, info) => {
        if (settled) {
          stream.resume();
          return;
        }
        settled = true;
        resolve({
          stream,
          originalName: info.filename,
          mimeType: info.mimeType,
        });
      });
      parser.on('filesLimit', () => reject(new Error('only_one_file_allowed')));
      parser.on('error', reject);
      parser.on('finish', () => {
        if (!settled) reject(new Error('file_required'));
      });
      request.pipe(parser);
    });
  }
}
