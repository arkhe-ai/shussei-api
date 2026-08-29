import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
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

  private parseNullableId(value?: string): string | null {
    return !value || value === 'null' ? null : value;
  }
}
