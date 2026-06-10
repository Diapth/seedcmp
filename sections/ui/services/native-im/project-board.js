function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeTaskStatus(value = '') {
  const text = String(value || '').toLowerCase();
  if (['done', 'completed', 'complete', 'success', 'closed'].includes(text)) return 'done';
  if (['review', 'pending_review', 'needs_review'].includes(text)) return 'review';
  if (['blocked', 'failed', 'error', 'needs_changes'].includes(text)) return 'blocked';
  return 'doing';
}

function normalizeProgress(task = {}) {
  if (task.progress !== undefined) return Math.max(0, Math.min(100, toNumber(task.progress, 0)));
  if (normalizeTaskStatus(task.status || task.state) === 'done') return 100;
  return 0;
}

function normalizeDocument(doc = {}, index = 0) {
  const workspacePath = firstText(doc.workspacePath, doc.workspace_path, doc.workspaceRelativePath, doc.workspace_relative_path, doc.path);
  const name = firstText(doc.name, doc.filename, doc.fileName, doc.title, workspacePath.split('/').filter(Boolean).pop(), `产出文档 ${index + 1}`);
  return {
    id: firstText(doc.id, doc.artifactId, doc.path, name),
    name,
    fileName: firstText(doc.fileName, doc.filename, name),
    type: firstText(doc.type, doc.kind, doc.ext, name.split('.').pop(), 'md').toLowerCase(),
    fileType: firstText(doc.fileType, doc.type, doc.kind, doc.ext, name.split('.').pop(), 'md').toLowerCase(),
    summary: firstText(doc.summary, doc.description, doc.desc, workspacePath, 'Clowder 任务产物'),
    path: workspacePath,
    workspacePath,
    worktreeId: firstText(doc.worktreeId, doc.worktree_id, doc.workspaceWorktreeId, doc.workspace_worktree_id, doc.workspaceId, doc.workspace_id),
    workspaceId: firstText(doc.workspaceId, doc.workspace_id),
    url: firstText(doc.url, doc.rawUrl, doc.raw_url, doc.downloadUrl, doc.download_url),
    sourceUrl: firstText(doc.sourceUrl, doc.source_url, doc.rawUrl, doc.raw_url),
    contentUrl: firstText(doc.contentUrl, doc.content_url, doc.rawUrl, doc.raw_url),
    source: firstText(doc.source, 'clowder'),
    generatedByAgent: Boolean(doc.generatedByAgent ?? doc.generated_by_agent ?? doc.path ?? doc.workspacePath ?? doc.workspace_path),
    status: firstText(doc.status, 'available'),
    raw: doc
  };
}

function normalizeLog(log = {}, index = 0) {
  return {
    time: firstText(log.time, log.createdAt, log.created_at, log.updatedAt, log.updated_at, `#${index + 1}`),
    title: firstText(log.title, log.event, log.action, log.status, '任务日志'),
    detail: firstText(log.detail, log.message, log.description, log.content, '')
  };
}

function normalizeBoardTask(task = {}, index = 0) {
  const agentId = firstText(
    task.assigneeCatId,
    task.assignee_cat_id,
    task.catId,
    task.cat_id,
    task.agentId,
    task.agent_id,
    task.ownerCatId,
    'clowder'
  );
  const title = firstText(task.task, task.title, task.name, `Clowder 任务 ${index + 1}`);
  const documents = firstArray(task.documents, task.artifacts, task.outputs, task.files).map(normalizeDocument);
  const logs = firstArray(task.logs, task.events, task.timeline).map(normalizeLog);

  return {
    id: firstText(task.id, task.taskId, task.task_id, `${agentId}-${index + 1}`),
    agentId,
    status: normalizeTaskStatus(task.status || task.state),
    progress: normalizeProgress(task),
    task: title,
    goal: firstText(task.goal, task.description, task.desc, task.prompt, title),
    modifyHint: firstText(task.modifyHint, task.modify_hint, task.nextAction, task.next_action, '请根据最新上下文补充任务进展。'),
    documents,
    logs
  };
}

export function normalizeClowderProjectBoard({ binding = {}, tasks = [], agents = [] } = {}) {
  const groupId = firstText(
    binding.projectGroupNo,
    binding.project_group_no,
    binding.projectGroupId,
    binding.project_group_id,
    binding.groupNo,
    binding.group_no
  );
  if (!groupId) return null;

  const catMemberIds = firstArray(binding.catMemberIds, binding.cat_member_ids, binding.cats)
    .map((item) => firstText(item.catId, item.id, item))
    .filter(Boolean);
  const userMemberIds = firstArray(binding.userMemberIds, binding.user_member_ids, binding.members)
    .map((item) => firstText(item.uid, item.id, item))
    .filter(Boolean);
  const normalizedTasks = firstArray(tasks).map(normalizeBoardTask);
  const agentNames = new Map((agents || []).map((agent) => [String(agent.id || agent.uid || agent.catId), agent.name || agent.nickname || agent.displayName]));

  return {
    id: `clowder-board-${firstText(binding.id, binding.bindingId, groupId)}`,
    bindingId: firstText(binding.id, binding.bindingId),
    groupId,
    groupName: firstText(binding.projectName, binding.project_name, binding.name, 'Clowder 项目群'),
    threadId: firstText(binding.projectThreadId, binding.project_thread_id, binding.threadId, binding.thread_id),
    summary: firstText(
      binding.summary,
      binding.description,
      catMemberIds.length
        ? `Clowder 项目群已同步 ${catMemberIds.map((id) => agentNames.get(id) || id).join('、')}。`
        : 'Clowder 项目群任务与智能体参与记录。'
    ),
    memberCount: new Set([...userMemberIds, ...catMemberIds]).size,
    source: 'clowder',
    tasks: normalizedTasks
  };
}
