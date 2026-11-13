import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

export interface UploadedFileResult {
  originalName: string;
  fileName: string;
  filePath: string; // Relative URL e.g. /uploads/2026/F-1024/171500000.webp
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class SharpImagePipe implements PipeTransform<Express.Multer.File, Promise<UploadedFileResult>> {
  constructor(private readonly subFolder: string = 'general') {}

  async transform(file: Express.Multer.File): Promise<UploadedFileResult> {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.');
    }

    const currentYear = new Date().getFullYear().toString();
    const baseUploadDir = process.env.UPLOAD_BASE_PATH || path.join(process.cwd(), 'uploads');
    const targetDir = path.join(baseUploadDir, currentYear, this.subFolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Handle PDF files directly without image conversion
    if (file.mimetype === 'application/pdf') {
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}.pdf`;
      const fullPath = path.join(targetDir, fileName);
      fs.writeFileSync(fullPath, file.buffer);
      return {
        originalName: file.originalname,
        fileName,
        filePath: `/uploads/${currentYear}/${this.subFolder}/${fileName}`,
        mimeType: 'application/pdf',
        sizeBytes: file.size,
      };
    }

    // Convert and compress images to WebP
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
    const fullPath = path.join(targetDir, fileName);

    const compressedBuffer = await sharp(file.buffer)
      .rotate() // Auto-orient based on EXIF orientation
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(fullPath);

    return {
      originalName: file.originalname,
      fileName,
      filePath: `/uploads/${currentYear}/${this.subFolder}/${fileName}`,
      mimeType: 'image/webp',
      sizeBytes: compressedBuffer.size,
    };
  }
}

