import { gzipSync } from 'node:zlib';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import type { ResolvedDeploymentArtifact } from './DeploymentArtifactResolver.js';

export interface SourcePackageResult {
  downloadFilePath: string;
  sourcePackagePath: string;
  downloadUrl: string;
}

export interface SourcePackageExecutorOptions {
  deploymentsDir: string;
  publicBaseUrl?: string;
  maxBytes?: number;
}

interface TarEntry {
  absolutePath: string;
  relativePath: string;
  type: 'file' | 'directory';
  size: number;
  mtime: number;
}

const DEFAULT_MAX_PACKAGE_BYTES = 100 * 1024 * 1024;
const DENIED_NAMES = new Set(['.git', 'node_modules', 'secrets']);
const DENIED_FILE_PATTERNS = [/^\.env(?:\.|$)/, /\.pem$/i, /\.key$/i, /^id_rsa$/i];

function isDeniedName(name: string): boolean {
  if (DENIED_NAMES.has(name)) return true;
  return DENIED_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function publicDownloadUrl(baseUrl: string | undefined, deploymentId: string): string {
  const path = `/api/deployments/${encodeURIComponent(deploymentId)}/download`;
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function normalizeTarPath(path: string): string {
  return path.split(sep).join('/').replace(/^\/+/, '');
}

function writeOctal(buffer: Buffer, value: number, offset: number, length: number): void {
  const text = Math.max(0, Math.floor(value)).toString(8).padStart(length - 1, '0').slice(-(length - 1));
  buffer.write(`${text}\0`, offset, length, 'ascii');
}

function splitTarName(path: string): { name: string; prefix: string } {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: '' };
  const parts = path.split('/');
  let name = parts.pop() || '';
  let prefix = parts.join('/');
  while ((Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) && prefix.includes('/')) {
    name = `${prefix.slice(prefix.lastIndexOf('/') + 1)}/${name}`;
    prefix = prefix.slice(0, prefix.lastIndexOf('/'));
  }
  if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) {
    throw new Error(`Path too long for tar package: ${path}`);
  }
  return { name, prefix };
}

function tarHeader(entry: TarEntry): Buffer {
  const header = Buffer.alloc(512, 0);
  const tarPath = entry.type === 'directory' && !entry.relativePath.endsWith('/')
    ? `${entry.relativePath}/`
    : entry.relativePath;
  const { name, prefix } = splitTarName(tarPath);
  header.write(name, 0, 100, 'utf-8');
  writeOctal(header, entry.type === 'directory' ? 0o755 : 0o644, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, entry.type === 'file' ? entry.size : 0, 124, 12);
  writeOctal(header, Math.floor(entry.mtime / 1000), 136, 12);
  header.fill(' ', 148, 156);
  header.write(entry.type === 'directory' ? '5' : '0', 156, 1, 'ascii');
  header.write('ustar', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  header.write('cat-cafe', 265, 32, 'ascii');
  header.write('cat-cafe', 297, 32, 'ascii');
  if (prefix) header.write(prefix, 345, 155, 'utf-8');
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const checksumText = checksum.toString(8).padStart(6, '0');
  header.write(`${checksumText}\0 `, 148, 8, 'ascii');
  return header;
}

function pad512(size: number): Buffer {
  const remainder = size % 512;
  return remainder === 0 ? Buffer.alloc(0) : Buffer.alloc(512 - remainder, 0);
}

async function collectEntries(root: string, base: string, maxBytes: number): Promise<TarEntry[]> {
  const entries: TarEntry[] = [];
  let totalBytes = 0;

  async function walk(path: string): Promise<void> {
    const name = basename(path);
    if (isDeniedName(name)) return;
    const fileStat = await stat(path);
    const rel = normalizeTarPath(relative(base, path));
    if (!rel) {
      if (fileStat.isDirectory()) {
        const children = await readdir(path);
        for (const child of children) await walk(join(path, child));
      }
      return;
    }

    if (fileStat.isDirectory()) {
      entries.push({ absolutePath: path, relativePath: rel, type: 'directory', size: 0, mtime: fileStat.mtimeMs });
      const children = await readdir(path);
      for (const child of children) await walk(join(path, child));
      return;
    }
    if (!fileStat.isFile()) return;
    totalBytes += fileStat.size;
    if (totalBytes > maxBytes) {
      throw new Error(`Source package exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit`);
    }
    entries.push({
      absolutePath: path,
      relativePath: rel,
      type: 'file',
      size: fileStat.size,
      mtime: fileStat.mtimeMs,
    });
  }

  await walk(root);
  return entries;
}

export class SourcePackageExecutor {
  constructor(private readonly options: SourcePackageExecutorOptions) {}

  async execute(deploymentId: string, artifact: ResolvedDeploymentArtifact): Promise<SourcePackageResult> {
    const deploymentRoot = resolve(this.options.deploymentsDir, deploymentId);
    await mkdir(deploymentRoot, { recursive: true });
    const downloadFilePath = join(deploymentRoot, 'source.tar.gz');
    const packageRootName = basename(artifact.targetPath) || 'source';
    const packageBase = artifact.stat.isFile() ? resolve(artifact.targetPath, '..') : artifact.targetPath;
    const entries = artifact.stat.isFile()
      ? [{
          absolutePath: artifact.targetPath,
          relativePath: packageRootName,
          type: 'file' as const,
          size: Number(artifact.stat.size),
          mtime: Number(artifact.stat.mtimeMs),
        }]
      : await collectEntries(artifact.targetPath, packageBase, this.options.maxBytes ?? DEFAULT_MAX_PACKAGE_BYTES);

    const chunks: Buffer[] = [];
    for (const entry of entries) {
      chunks.push(tarHeader(entry));
      if (entry.type === 'file') {
        const content = await readFile(entry.absolutePath);
        chunks.push(content, pad512(content.length));
      }
    }
    chunks.push(Buffer.alloc(1024, 0));
    await writeFile(downloadFilePath, gzipSync(Buffer.concat(chunks)));

    return {
      downloadFilePath,
      sourcePackagePath: artifact.targetPath,
      downloadUrl: publicDownloadUrl(this.options.publicBaseUrl, deploymentId),
    };
  }
}
