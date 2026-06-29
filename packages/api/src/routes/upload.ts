import { randomUUID } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { isS3Configured, uploadToS3 } from '../services/s3.js';
import { moderateImageBuffer } from '../services/content-moderation.js';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);
const MAX_BYTES = 8 * 1024 * 1024;

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  if (!isS3Configured()) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  app.post('/upload/image', { preHandler: requireAuth }, async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_BYTES } });
    if (!file) return reply.code(400).send({ error: 'BadRequest', message: 'No file uploaded' });

    const ext = extname(file.filename).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return reply.code(400).send({
        error: 'BadRequest',
        message: `Unsupported file type. Allowed: ${[...ALLOWED_EXT].join(', ')}`,
      });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (file.file.truncated) {
      return reply.code(413).send({ error: 'PayloadTooLarge', message: 'Max 8MB' });
    }

    const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream';

    // Strip EXIF/GPS metadata for privacy — rotate based on orientation first
    const stripped = await sharp(buffer)
      .rotate() // auto-orient from EXIF before stripping
      .withMetadata({ orientation: undefined })
      .toBuffer();

    // Auto-moderate BEFORE persisting so blocked images never hit storage
    // (fail-open if unconfigured / API error).
    if ((await moderateImageBuffer(stripped, contentType)).blocked) {
      return reply.code(422).send({
        error: 'ContentBlocked',
        message: 'This image may violate our community guidelines and can’t be uploaded.',
      });
    }

    if (isS3Configured()) {
      const url = await uploadToS3(stripped, ext, contentType);
      return reply.send({ url, filename: url.split('/').pop() });
    }

    const id = randomUUID();
    const filename = `${id}${ext}`;
    const dest = join(UPLOAD_DIR, filename);
    await pipeline(
      (async function* () { yield stripped; })(),
      createWriteStream(dest),
    );
    const baseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    return reply.send({ url: `${baseUrl}/uploads/${filename}`, filename });
  });

  app.get<{ Params: { filename: string } }>('/uploads/:filename', async (request, reply) => {
    const filename = request.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const ext = extname(filename).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return reply.code(404).send({ error: 'NotFound' });
    const path = join(UPLOAD_DIR, filename);
    try {
      const s = await stat(path);
      reply
        .header('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream')
        .header('Content-Length', s.size);
      return reply.send(createReadStream(path));
    } catch {
      return reply.code(404).send({ error: 'NotFound' });
    }
  });
}
