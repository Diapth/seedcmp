function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

export function isFetchableFileUrl(value = '') {
  const url = String(value || '').trim();
  return /^(https?:|blob:|data:)/i.test(url)
    || /^\/(uploads|v1|clowder-api|api|static|assets)\//i.test(url);
}

export function firstFetchableFileUrl(...values) {
  return values.map((value) => String(value || '').trim()).find(isFetchableFileUrl) || '';
}

export function normalizeWorkspaceArtifactPath(value = '') {
  const raw = String(value || '').trim();
  if (!raw || isFetchableFileUrl(raw) || /^javascript:/i.test(raw)) return '';
  return raw.replace(/^\.?\//, '').replace(/\\/g, '/');
}

export function workspaceRawFileUrl(worktreeId = '', workspacePath = '') {
  const tree = String(worktreeId || '').trim();
  const path = normalizeWorkspaceArtifactPath(workspacePath);
  if (!tree || !path) return '';
  return `/v1/clowder/workspace/file/raw?worktreeId=${encodeURIComponent(tree)}&path=${encodeURIComponent(path)}`;
}

export function resolvePreviewFileSource(source = {}) {
  const name = firstText(source.name, source.fileName, source.filename, source.content, '未命名文件');
  const rawType = firstText(source.fileType, source.file_type, source.ext, source.type, getTypeFromName(name), 'file');
  const detectedType = rawType.toLowerCase();
  const workspacePath = normalizeWorkspaceArtifactPath(firstText(
    source.workspacePath,
    source.workspace_path,
    source.workspaceRelativePath,
    source.workspace_relative_path,
    source.relativePath,
    source.relative_path,
    source.path
  ));
  const worktreeId = firstText(
    source.worktreeId,
    source.worktree_id,
    source.workspaceWorktreeId,
    source.workspace_worktree_id,
    source.worktree?.id,
    source.workspace?.worktreeId,
    source.workspace?.worktree_id
  );
  const explicitUrl = firstFetchableFileUrl(
    source.url,
    source.sourceUrl,
    source.source_url,
    source.contentUrl,
    source.content_url,
    source.previewUrl,
    source.preview_url,
    source.downloadUrl,
    source.download_url
  );
  const workspaceUrl = explicitUrl ? '' : workspaceRawFileUrl(worktreeId, workspacePath);

  return {
    id: firstText(source.id),
    conversationId: firstText(source.conversationId, source.channelId, source.channel_id),
    name,
    size: firstText(source.size, source.fileSize, source.file_size, '未知大小'),
    type: detectedType === 'file' ? getTypeFromName(name) : detectedType,
    url: explicitUrl || workspaceUrl,
    path: workspacePath,
    absolutePath: firstText(source.absolutePath, source.absolute_path),
    worktreeId,
    content: firstText(source.previewContent, source.preview_content, source.contentText, source.content_text, source.markdown, source.text)
  };
}

export function previewContentOrEmpty({ fetchedContent = '', fileContent = '' } = {}) {
  return firstText(fetchedContent, fileContent);
}

export function buildPreviewFilePayload(file = {}) {
  const normalized = resolvePreviewFileSource(file);
  const content = firstText(file.content, file.fileName, file.name, normalized.name);
  const previewContent = firstText(
    file.previewContent,
    file.preview_content,
    file.contentText,
    file.content_text,
    file.markdown,
    file.text
  );
  const sourceUrl = firstText(file.sourceUrl, file.source_url, normalized.url);
  const contentUrl = firstText(file.contentUrl, file.content_url, normalized.url);

  return {
    ...normalized,
    content,
    previewContent,
    fileName: firstText(file.fileName, file.name, normalized.name),
    fileSize: firstText(file.fileSize, file.file_size, file.size, normalized.size),
    size: firstText(file.size, file.fileSize, normalized.size),
    fileType: firstText(file.fileType, file.file_type, file.ext, normalized.type),
    ext: firstText(file.ext, file.fileType, normalized.type),
    path: normalized.path,
    workspacePath: normalized.path,
    absolutePath: firstText(file.absolutePath, file.absolute_path, normalized.absolutePath),
    worktreeId: firstText(file.worktreeId, file.worktree_id, normalized.worktreeId),
    source: firstText(file.source, file.source_type),
    generatedByAgent: Boolean(file.generatedByAgent ?? file.generated_by_agent),
    sourceUrl,
    contentUrl,
    previewUrl: firstText(file.previewUrl, file.preview_url, sourceUrl),
    downloadUrl: firstText(file.downloadUrl, file.download_url, contentUrl),
    contentText: firstText(file.contentText, file.content_text),
    markdown: firstText(file.markdown),
    text: firstText(file.text)
  };
}

export const encodePreviewFile = (file = {}) => encodeURIComponent(JSON.stringify(buildPreviewFilePayload(file)));

function getTypeFromName(name = '') {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : 'file';
}
