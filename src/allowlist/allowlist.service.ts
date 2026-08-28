import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';

export type AllowlistEntryDto = {
  id: string;
  email: string;
  createdAt: Date;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AllowlistService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(entry: { id: string; email: string; createdAt: Date }): AllowlistEntryDto {
    return { id: entry.id, email: entry.email, createdAt: entry.createdAt };
  }

  async listEntries(): Promise<AllowlistEntryDto[]> {
    const entries = await this.prisma.allowedUser.findMany({
      orderBy: { email: 'asc' },
      select: { id: true, email: true, createdAt: true },
    });
    return entries.map((entry) => this.toDto(entry));
  }

  async createEntry(input: { email: string }): Promise<AllowlistEntryDto> {
    try {
      const entry = await this.prisma.allowedUser.create({
        data: { email: normalizeEmail(input.email) },
      });
      return this.toDto(entry);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('email_already_allowed');
      }
      throw error;
    }
  }

  async deleteEntry(email: string): Promise<void> {
    try {
      await this.prisma.allowedUser.delete({ where: { email: normalizeEmail(email) } });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('allowlist_entry_not_found');
      }
      throw error;
    }
  }
}
