import { Request } from 'express';
import fs from 'fs';
import 'moment-timezone';

export class CommonUtils {
  static getIpFromReq(req: Request) {
    return (req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress) as string;
  }

  static removeFile = (file: Express.Multer.File) => {
    // Handle errors and optionally remove the local file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  };

  static removeFiles = (files: Express.Multer.File[]) => {
    if (files?.length) {
      files.forEach((file) => {
        this.removeFile(file);
      });
    }
  };
}
