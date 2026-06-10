export function buildPreviewFilePayload(file = {}) {
  return {
    id: file?.id || '',
    conversationId: file?.conversationId || '',
    name: file?.name || file?.fileName || file?.content || '',
    fileName: file?.fileName || file?.name || file?.content || '',
    content: file?.content || '',
    fileSize: file?.fileSize || file?.size || '',
    size: file?.size || file?.fileSize || '',
    fileType: file?.fileType || file?.ext || '',
    ext: file?.ext || file?.fileType || '',
    url: file?.url || '',
    sourceUrl: file?.sourceUrl || '',
    contentUrl: file?.contentUrl || '',
    previewUrl: file?.previewUrl || '',
    downloadUrl: file?.downloadUrl || '',
    path: file?.path || '',
    workspacePath: file?.workspacePath || file?.workspace_path || '',
    worktreeId: file?.worktreeId || file?.worktree_id || '',
    source: file?.source || '',
    generatedByAgent: Boolean(file?.generatedByAgent),
    previewContent: file?.previewContent || file?.contentText || file?.markdown || file?.text || '',
    contentText: file?.contentText || '',
    markdown: file?.markdown || '',
    text: file?.text || ''
  };
}

export function encodePreviewFile(file = {}) {
  return encodeURIComponent(JSON.stringify(buildPreviewFilePayload(file)));
}
