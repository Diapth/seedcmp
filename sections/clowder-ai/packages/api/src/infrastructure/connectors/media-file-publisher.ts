import { copyFile, mkdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { getDefaultUploadDir } from '../../utils/upload-paths.js';

export interface PublishAgentFileResult {
  publicUrl: string;
  absolutePath: string;
}

/**
 * Copy an agent-generated file from its local workspace path into the public
 * uploads/ directory and return a browser-accessible URL.
 *
 * This is the bridge between agent private workspace files and outbound
 * connector media delivery (e.g. IM Web FileCell).
 */
export async function publishAgentFile(
  sourcePath: string,
  options: {
    fileName?: string;
    uploadDir?: string;
    log?: FastifyBaseLogger;
  } = {},
): Promise<PublishAgentFileResult | undefined> {
  const log = options.log;
  try {
    const fileStat = await stat(sourcePath);
    if (!fileStat.isFile()) {
      log?.warn({ sourcePath }, '[publishAgentFile] source is not a file');
      return undefined;
    }

    const uploadDir = options.uploadDir ? resolve(options.uploadDir) : getDefaultUploadDir(process.env.UPLOAD_DIR);
    const destName = `${Date.now()}-${randomUUID().slice(0, 8)}-${options.fileName ?? basename(sourcePath)}`;
    const destPath = resolve(uploadDir, destName);

    // Security: ensure destination stays inside uploadDir
    if (!destPath.startsWith(uploadDir + '/') && destPath !== uploadDir) {
      log?.warn({ sourcePath, destPath, uploadDir }, '[publishAgentFile] path traversal blocked');
      return undefined;
    }

    await mkdir(uploadDir, { recursive: true });
    await copyFile(sourcePath, destPath);

    log?.info(
      { sourcePath, destPath, publicUrl: `/uploads/${destName}` },
      '[publishAgentFile] file published',
    );

    return {
      publicUrl: `/uploads/${destName}`,
      absolutePath: destPath,
    };
  } catch (err) {
    log?.warn({ err, sourcePath }, '[publishAgentFile] failed');
    return undefined;
  }
}
