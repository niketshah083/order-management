import { Injectable, NotFoundException } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs-extra';
import { Upload } from '@aws-sdk/lib-storage';
import { dirname, join } from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'fs';

@Injectable()
export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  async getFilePathFromUrl(
    fileKey: string,
    bucketName: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      });
      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      throw new NotFoundException(`Error retrieving file: ${error.message}`);
    }
  }

  async uploadS3File(
    file: Express.Multer.File,
    bucketName: string,
    fileKey: string,
  ): Promise<string> {
    // Check if the file path exists
    if (!file || !file.path) {
      throw new Error('File not provided or path is missing');
    }

    // Create a read stream from the file path
    const fileStream = fs.createReadStream(file.path);

    return await this.uploadS3Stream(
      fileStream,
      file.mimetype,
      bucketName,
      fileKey,
    );
  }

  async uploadS3Stream(
    fileStream: any,
    mimetype: string,
    bucketName: string,
    fileKey: string,
  ): Promise<string> {
    const uploader = new Upload({
      client: this.s3Client,
      params: {
        Bucket: bucketName,
        Key: fileKey,
        Body: fileStream, // Use the stream instead of the buffer
        ContentType: mimetype,
      },
      leavePartsOnError: false, // Optional
    });

    try {
      const result = await uploader.done();
      return result.Location; // Returns the URL of the uploaded file
    } catch (err) {
      console.error(err, 'Upload failed');
      throw new Error('Failed to upload file');
    }
  }

  async deleteS3File(bucketName: string, key: string): Promise<void> {
    const deleteParams = {
      Bucket: bucketName,
      Key: key,
    };

    try {
      await this.s3Client.send(new DeleteObjectCommand(deleteParams));
      console.log(`File deleted successfully: ${key}`);
    } catch (error) {
      console.error(`Error deleting file: ${error.message}`);
      throw new Error(`Unable to delete file from S3: ${error.message}`);
    }
  }

  async downloadFileFromS3(
    bucketName: string,
    fileKey: string,
    path: string,
    fileName: string,
  ): Promise<Express.Multer.File> {
    const tempFilePath = join(__dirname, '../../../', path, fileName);
    const tempDir = dirname(tempFilePath);
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      });

      const { Body, ContentType, ContentLength } =
        await this.s3Client.send(command);

      if (!Body) throw new Error('File not found in S3');

      const streamPipeline = promisify(pipeline);
      await streamPipeline(
        Body as NodeJS.ReadableStream,
        createWriteStream(tempFilePath),
      );

      const buffer = readFileSync(tempFilePath);

      const multerFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: fileName,
        encoding: '7bit',
        mimetype: ContentType || 'application/octet-stream',
        size: ContentLength ?? buffer.length,
        destination: tempDir,
        filename: fileName,
        path: tempFilePath,
        buffer: buffer,
        stream: fs.createReadStream(tempFilePath),
      };

      return multerFile;
    } catch (error) {
      throw new Error(`Error downloading file: ${error.message}`);
    }
  }
}
