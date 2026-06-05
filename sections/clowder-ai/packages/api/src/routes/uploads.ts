/**
 * Uploads Static File Route
 * Serves uploaded images from the uploads directory.
 */

import { basename, resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyPluginAsync } from 'fastify';

export interface UploadsRoutesOptions {
  uploadDir: string;
}

export const uploadsRoutes: FastifyPluginAsync<UploadsRoutesOptions> = async (app, opts) => {
  await app.register(fastifyStatic, {
    root: resolve(opts.uploadDir),
    prefix: '/uploads/',
    decorateReply: false,
    setHeaders(res, pathName) {
      const fileName = basename(pathName);
      if (isArchiveDownload(fileName)) {
        res.setHeader('Content-Disposition', `attachment; filename="${escapeHeaderFilename(fileName)}"`);
      }
    },
  });
};

function isArchiveDownload(fileName: string) {
  return /\.(?:zip|tar\.gz|tgz|gz|rar|7z)$/i.test(fileName);
}

function escapeHeaderFilename(fileName: string) {
  return fileName.replace(/["\\\r\n]/g, '_');
}
