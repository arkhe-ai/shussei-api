import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtSessionGuard } from '../auth/jwt-session.guard';
import { AllowlistService } from './allowlist.service';
import { CreateAllowlistEntryDto } from './dto/create-allowlist-entry.dto';

@Controller('/api/v1/allowlist')
@UseGuards(JwtSessionGuard)
export class AllowlistController {
  constructor(private readonly allowlistService: AllowlistService) {}

  @Get()
  async list() {
    return { entries: await this.allowlistService.listEntries() };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateAllowlistEntryDto) {
    return this.allowlistService.createEntry(body);
  }

  @Delete('/:email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('email') email: string): Promise<void> {
    await this.allowlistService.deleteEntry(email);
  }
}
