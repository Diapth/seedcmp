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

function uniqueTexts(values = []) {
  return [...new Set(values.map((value) => firstText(value)).filter(Boolean))];
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
  const extension = String(name || '').includes('.') ? String(name).split('.').pop() : '';
  const previewType = firstText(doc.fileType, doc.file_type, doc.ext, extension, doc.type, doc.kind, 'md').toLowerCase();
  return {
    id: firstText(doc.id, doc.artifactId, doc.path, name),
    name,
    fileName: firstText(doc.fileName, doc.filename, name),
    type: previewType,
    fileType: previewType,
    kind: firstText(doc.kind, doc.type, previewType),
    summary: firstText(doc.summary, doc.description, doc.desc, workspacePath, 'Clowder 任务产物'),
    path: workspacePath,
    workspacePath,
    worktreeId: firstText(doc.worktreeId, doc.worktree_id, doc.workspaceWorktreeId, doc.workspace_worktree_id, doc.workspaceId, doc.workspace_id),
    workspaceId: firstText(doc.workspaceId, doc.workspace_id),
    absolutePath: firstText(doc.absolutePath, doc.absolute_path),
    url: firstText(doc.url, doc.rawUrl, doc.raw_url, doc.downloadUrl, doc.download_url),
    sourceUrl: firstText(doc.sourceUrl, doc.source_url, doc.rawUrl, doc.raw_url),
    contentUrl: firstText(doc.contentUrl, doc.content_url, doc.rawUrl, doc.raw_url),
    previewUrl: firstText(doc.previewUrl, doc.preview_url),
    downloadUrl: firstText(doc.downloadUrl, doc.download_url),
    ownerCatId: firstText(doc.ownerCatId, doc.owner_cat_id, doc.catId, doc.cat_id),
    taskId: firstText(doc.taskId, doc.task_id),
    source: firstText(doc.source, 'clowder'),
    generatedByAgent: Boolean(doc.generatedByAgent ?? doc.generated_by_agent ?? doc.path ?? doc.workspacePath ?? doc.workspace_path),
    status: firstText(doc.status, 'available'),
    createdAt: doc.createdAt || doc.created_at || 0,
    raw: doc
  };
}

function documentKey(doc = {}) {
  return firstText(
    doc.id,
    doc.workspacePath,
    doc.workspace_path,
    doc.workspaceRelativePath,
    doc.workspace_relative_path,
    doc.path,
    doc.url,
    doc.sourceUrl,
    doc.contentUrl,
    doc.name
  );
}

function appendUniqueDocuments(documents = [], additions = []) {
  const next = [...documents];
  const seen = new Set(next.map(documentKey).filter(Boolean));
  additions.forEach((doc, index) => {
    const normalized = normalizeDocument(doc, documents.length + index);
    const key = documentKey(normalized);
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    next.push(normalized);
  });
  return next;
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

function artifactTaskKey(artifact = {}, index = 0) {
  return firstText(
    artifact.taskId,
    artifact.task_id,
    artifact.task?.id,
    artifact.task?.taskId,
    artifact.ownerCatId,
    artifact.owner_cat_id,
    artifact.catId,
    artifact.cat_id,
    `artifact-task-${index + 1}`
  );
}

function artifactOwnerId(artifact = {}) {
  return firstText(artifact.ownerCatId, artifact.owner_cat_id, artifact.catId, artifact.cat_id, artifact.agentId, artifact.agent_id, 'clowder');
}

function synthesizeArtifactTask(artifactGroup = [], index = 0) {
  const first = artifactGroup[0] || {};
  const agentId = artifactOwnerId(first);
  const documents = artifactGroup.map(normalizeDocument);
  const allAvailable = documents.every((doc) => String(doc.status || '').toLowerCase() === 'available');
  const anyBroken = documents.some((doc) => ['missing', 'outside_project', 'forbidden', 'failed', 'error'].includes(String(doc.status || '').toLowerCase()));
  const status = allAvailable ? 'done' : anyBroken ? 'blocked' : 'doing';
  const title = firstText(
    first.taskTitle,
    first.task_title,
    first.task,
    first.title,
    first.description,
    first.desc,
    `${agentId} 的产出文件`
  );
  return {
    id: firstText(first.taskId, first.task_id, first.id, `${agentId}-artifact-${index + 1}`),
    agentId,
    status,
    progress: status === 'done' ? 100 : 0,
    task: title,
    goal: firstText(first.goal, first.description, first.desc, documents[0]?.summary, title),
    modifyHint: firstText(first.modifyHint, first.modify_hint, '请根据实际产物补充或修正文档。'),
    documents,
    logs: documents.map((doc, docIndex) => ({
      time: firstText(doc.createdAt, `#${docIndex + 1}`),
      title: '登记产物',
      detail: doc.summary
    }))
  };
}

function mergeArtifactsIntoTasks(tasks = [], artifacts = []) {
  const normalizedTasks = firstArray(tasks).map(normalizeBoardTask);
  const taskIndex = new Map(normalizedTasks.map((task, index) => [task.id, index]));
  const unmatched = [];

  firstArray(artifacts).forEach((artifact, index) => {
    const key = firstText(artifact.taskId, artifact.task_id);
    if (key && taskIndex.has(key)) {
      const targetIndex = taskIndex.get(key);
      normalizedTasks[targetIndex] = {
        ...normalizedTasks[targetIndex],
        documents: appendUniqueDocuments(normalizedTasks[targetIndex].documents, [artifact])
      };
      return;
    }
    unmatched.push({ artifact, index });
  });

  const groups = new Map();
  unmatched.forEach(({ artifact, index }) => {
    const key = artifactTaskKey(artifact, index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(artifact);
  });

  return [
    ...normalizedTasks,
    ...Array.from(groups.values()).map((group, index) => synthesizeArtifactTask(group, index))
  ];
}

export function collectProjectBoardDocuments(board = {}) {
  return firstArray(board.tasks).flatMap((task) => firstArray(task.documents));
}

export function mergeSharedFilesWithBoardDocuments(messageFiles = [], board = {}) {
  const boardFiles = collectProjectBoardDocuments(board).map((doc) => ({
    ...doc,
    type: 'file',
    fileType: doc.fileType || doc.type,
    source: firstText(doc.source, 'clowder'),
    generatedByAgent: true
  }));
  const next = [];
  const seen = new Set();
  [...boardFiles, ...firstArray(messageFiles)].forEach((file) => {
    const key = documentKey(file);
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    next.push(file);
  });
  return next;
}

export function resolveProjectBoardThreadIds(binding = {}, group = {}) {
  return uniqueTexts([
    binding.projectThreadId,
    binding.project_thread_id,
    binding.threadId,
    binding.thread_id,
    binding.directThreadId,
    binding.direct_thread_id,
    binding.clowderThreadId,
    binding.clowder_thread_id,
    group.projectThreadId,
    group.project_thread_id,
    group.threadId,
    group.thread_id,
    group.directThreadId,
    group.direct_thread_id,
    group.clowderThreadId,
    group.clowder_thread_id,
    group.binding?.projectThreadId,
    group.binding?.project_thread_id,
    group.binding?.threadId,
    group.binding?.thread_id,
    group.binding?.directThreadId,
    group.binding?.direct_thread_id,
    group.binding?.clowderThreadId,
    group.binding?.clowder_thread_id,
    group.raw?.projectThreadId,
    group.raw?.project_thread_id,
    group.raw?.threadId,
    group.raw?.thread_id,
    group.raw?.directThreadId,
    group.raw?.direct_thread_id,
    group.raw?.clowderThreadId,
    group.raw?.clowder_thread_id,
    group.raw?.binding?.projectThreadId,
    group.raw?.binding?.project_thread_id,
    group.raw?.binding?.threadId,
    group.raw?.binding?.thread_id,
    group.raw?.binding?.directThreadId,
    group.raw?.binding?.direct_thread_id,
    group.raw?.binding?.clowderThreadId,
    group.raw?.binding?.clowder_thread_id
  ]);
}

export function normalizeClowderProjectBoard({ binding = {}, tasks = [], artifacts = [], agents = [] } = {}) {
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
  const normalizedTasks = mergeArtifactsIntoTasks(tasks, artifacts);
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

export function shouldSyncRemoteProjectBoard(group = {}) {
  if (!group || !firstText(group.id, group.groupId, group.groupNo, group.group_no, group.channelId)) return false;
  if (group.remoteBoardSync === false) return false;
  const source = firstText(group.source).toLowerCase();
  if (['mock', 'local', 'demo', 'static'].includes(source)) return false;
  return true;
}
