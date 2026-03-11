import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { mkdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class MealFilesService implements OnModuleInit {
  private readonly uploadsRoot = path.join(process.cwd(), 'uploads');
  private readonly mealsUploadsRoot = path.join(this.uploadsRoot, 'meals');

  async onModuleInit(): Promise<void> {
    await this.ensureUploadsDirectory();
  }

  async ensureUploadsDirectory(): Promise<void> {
    await mkdir(this.mealsUploadsRoot, { recursive: true });
  }

  toStorageKeyFromUploadedPath(uploadedPath: string): string {
    const relative = path
      .relative(this.uploadsRoot, uploadedPath)
      .replace(/\\/g, '/');
    if (!relative.startsWith('meals/')) {
      throw new BadRequestException('Uploaded file path is invalid');
    }

    return relative;
  }

  toStorageKey(photoPath: string): string {
    const trimmed = photoPath.trim();
    const withoutPrefix = trimmed.startsWith('/uploads/')
      ? trimmed.slice('/uploads/'.length)
      : trimmed;

    const normalized = path.posix.normalize(withoutPrefix);

    if (!normalized.startsWith('meals/')) {
      throw new BadRequestException('photoPath must point to /uploads/meals/*');
    }

    if (normalized.includes('..')) {
      throw new BadRequestException(
        'photoPath contains invalid traversal segments',
      );
    }

    return normalized;
  }

  toPublicPath(storageKey: string): string {
    return `/uploads/${storageKey}`;
  }

  async assertFileExists(storageKey: string): Promise<void> {
    const absolutePath = path.join(this.uploadsRoot, storageKey);
    try {
      await access(absolutePath, fsConstants.F_OK);
    } catch {
      throw new BadRequestException(
        'Referenced uploaded photo does not exist on server',
      );
    }
  }
}
