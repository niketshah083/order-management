import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Request } from 'express';
import fs from 'fs';
import { BadRequestException } from '@nestjs/common';
import { FileConstants } from '../constants/file.constant';

export class FileUtils {
  static multerConfig = (allowedExtensions: string[][]) => ({
    storage: diskStorage({
      destination: (
        req: any,
        file: Express.Multer.File,
        callback: (error: Error | null, destination: string) => void,
      ) => {
        // Ensure req.body has orgId and companyId
        const organizationName = req.userDetails?.organizationName
          ? req.userDetails.organizationName
          : '';
        const companyName = req.userDetails?.companyName
          ? req.userDetails.companyName
          : '';

        // Define base upload path
        let uploadPath = './uploads';
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }

        if (organizationName) {
          // Create directory based on orgId
          uploadPath = join(uploadPath, `${organizationName}`);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
        }
        if (companyName) {
          // Create sub-directory based on companyName inside orgId directory
          uploadPath = join(uploadPath, `${companyName}`);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
        }

        callback(null, uploadPath);
      },
      filename: (
        req: Request,
        file: Express.Multer.File,
        callback: (error: Error | null, filename: string) => void,
      ) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName =
          file.fieldname + '-' + uniqueSuffix + extname(file.originalname);
        callback(null, fileName);
      },
    }),
    fileFilter: (
      req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const fileExt = extname(file.originalname).toLowerCase();
      let tAllowedExtensions = allowedExtensions.flat(1);
      if (
        -1 !== tAllowedExtensions.findIndex((e) => e.toLowerCase() === fileExt)
      ) {
        cb(null, true);
      } else {
        cb(
          new BadRequestException(
            `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`,
          ),
          false,
        );
      }
    },
    limits: {
      fileSize: FileConstants.FILE_SIZE.TEN_MB,
    },
  });
}
