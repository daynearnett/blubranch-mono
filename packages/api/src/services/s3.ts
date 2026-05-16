import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials:
    process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY,
        }
      : undefined,
});

const BUCKET = process.env.S3_BUCKET ?? '';

export function isS3Configured(): boolean {
  return Boolean(BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

export async function uploadToS3(
  buffer: Buffer,
  ext: string,
  contentType: string,
  folder: string = 'uploads',
): Promise<string> {
  const key = `${folder}/${randomUUID()}${ext}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  const region = process.env.S3_REGION ?? 'us-east-1';
  return `https://${BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

export async function deleteFromS3(url: string): Promise<void> {
  const match = url.match(/amazonaws\.com\/(.+)$/);
  if (!match) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: match[1] }));
}
