<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  buildClowderCatContactId,
  getClowderCatIdFromContactId,
  useChannelStore,
  useClowderStore,
  useGroupStore,
  useMessageStore,
  useUserStore
} from '@tsdaodao/datasource-vue';
import { useRemoteConfig } from '@tsdaodao/base-vue';
import {
  getClowderCatDisplayNameFromPayload,
  isClowderPayload
} from '@tsdaodao/base-vue/utils/clowderMessageIdentity';
import { buildDeploymentCardMessage } from '../utils/deploymentRequestCard';
import { resolveProjectGroupName } from '../utils/clowderProjectGroup';
import CoordinatorSummaryCard from './CoordinatorSummaryCard.vue';
import {
  TextCell,
  ImageCell,
  SystemCell,
  TimeCell,
  VoiceCell,
  FileCell,
  VideoCell,
  GifCell,
  StickerCell,
  LocationCell,
  CardCell,
  MergeCell,
  ChannelAvatar,
  ContextMenu,
  AppDialog
} from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const props = defineProps<{
  channelId: string;
  channelType: number;
}>();

const emit = defineEmits<{
  (event: 'open-preview', payload: any): void;
  (event: 'mention-user', payload: { uid: string; name: string }): void;
  (event: 'view-user-profile', payload: { uid: string }): void;
}>();

const messageStore = useMessageStore();
const userStore = useUserStore();
const channelStore = useChannelStore();
const clowderStore = useClowderStore();
const groupStore = useGroupStore();
const { remoteConfig } = useRemoteConfig();
const appRouter = getCurrentInstance()?.appContext.config.globalProperties.$router as { push?: (path: string) => Promise<unknown> } | undefined;

const scrollContainer = ref<HTMLDivElement | null>(null);
const scrollTop = ref(0);
const historyWindowSize = ref(300);
const isLoadingEarlier = ref(false);
const estimatedRowHeight = 72;
const topHistoryLoadThreshold = 96;

const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const selectedMsg = ref<any>(null);
const showAvatarMenu = ref(false);
const avatarMenuX = ref(0);
const avatarMenuY = ref(0);
const selectedAvatarMsg = ref<any>(null);
const editDialogVisible = ref(false);
const editDialogText = ref('');
const channelKey = computed(() => `${props.channelId}-${props.channelType}`);
const deploymentActionKeys = new Set<string>();
const deploymentFieldKeys = new Set<string>();
const deploymentFieldQueues = new Map<string, Promise<void>>();
const deploymentResultSummaryKeys = new Set<string>();
const deploymentPollableStatuses = new Set(['confirmed', 'queued', 'running', 'submitting']);
const deploymentTerminalStatuses = new Set(['succeeded', 'failed', 'cancelled', 'canceled']);
const deploymentPollIntervalMs = 2500;
const projectGroupActionKeys = new Set<string>();
const CLOWDER_COORDINATOR_CAT_ID = 'coordinator';
const CLOWDER_COORDINATOR_MEMBER_ID = buildClowderCatContactId(CLOWDER_COORDINATOR_CAT_ID);
let deploymentPollTimer: ReturnType<typeof setInterval> | null = null;
let deploymentPollInFlight = false;
const coordinatorActionKey = ref('');
const coordinationHydrationIds = new Set<string>();

interface CoordinatorSummarySubtaskView {
  id: string;
  title: string;
  targetCatId?: string;
  targetName?: string;
  status: string;
  result?: string;
  failureReason?: string;
  artifactRefs?: readonly string[];
}

interface CoordinatorSummaryView {
  coordinationId?: string;
  status: string;
  goal?: string;
  aggregateSummary?: string;
  failureReason?: string;
  conflict?: boolean;
  targetCatIds?: readonly string[];
  subtasks?: readonly CoordinatorSummarySubtaskView[];
}

interface ProjectGroupHandoffView {
  groupNo: string;
  groupName: string;
  bindingId?: string;
  reused: boolean;
}

interface ProjectGroupConfirmationView {
  projectName: string;
  status: 'pending_confirmation' | 'creating' | 'created' | 'failed' | 'cancelled' | string;
  sourceText: string;
  sourceMessageId?: string;
  targetCatIds: string[];
  workerCatIds: string[];
  workspaceId?: string;
  pmDirectChannelId: string;
  pmDirectChannelType: number;
  pmDirectThreadId?: string;
  groupNo?: string;
  groupName?: string;
  bindingId?: string;
  projectThreadId?: string;
  reused?: boolean;
  error?: string;
}

const emptyCoordinatorSummary: CoordinatorSummaryView = { status: 'succeeded' };

const messages = computed(() => {
  return messageStore.messages[channelKey.value] || [];
});

const supportedMessageTypes = new Set([1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 1000]);

function isRenderableMessage(msg: any): boolean {
  if (!msg) return false;
  if (msg.isRevoked) return true;
  const type = Number(msg.content?.type || 0);
  return supportedMessageTypes.has(type);
}

const renderableMessages = computed(() => {
  return messages.value.filter(isRenderableMessage);
});

const visibleStart = computed(() => {
  if (renderableMessages.value.length <= historyWindowSize.value) return 0;
  const estimatedStart = Math.floor(scrollTop.value / estimatedRowHeight) - 20;
  return Math.max(0, Math.min(estimatedStart, renderableMessages.value.length - historyWindowSize.value));
});

const visibleEnd = computed(() => {
  return Math.min(renderableMessages.value.length, visibleStart.value + historyWindowSize.value);
});

const visibleMessages = computed(() => {
  return renderableMessages.value.slice(visibleStart.value, visibleEnd.value).map((msg, index) => ({
    msg,
    index: visibleStart.value + index
  }));
});

const pollingDeploymentRequestIds = computed(() => {
  const ids = new Set<string>();
  for (const msg of messages.value) {
    if (!isDeploymentCardMessage(msg)) continue;
    const content = msg.content || {};
    const status = String(content.status || 'pending_confirmation');
    if (!deploymentPollableStatuses.has(status)) continue;
    const requestId = getDeploymentRequestIdFromMessage(msg);
    if (requestId) ids.add(requestId);
  }
  return Array.from(ids);
});

const topSpacerHeight = computed(() => visibleStart.value * estimatedRowHeight);
const bottomSpacerHeight = computed(() => Math.max(0, renderableMessages.value.length - visibleEnd.value) * estimatedRowHeight);

function isNearBottom() {
  const container = scrollContainer.value;
  if (!container) return true;
  return container.scrollHeight - container.scrollTop - container.clientHeight < 120;
}

async function loadEarlierMessages() {
  const container = scrollContainer.value;
  if (!container || isLoadingEarlier.value || renderableMessages.value.length === 0) return;

  const activeChannelKey = channelKey.value;
  const previousScrollHeight = container.scrollHeight;
  const previousScrollTop = container.scrollTop;

  isLoadingEarlier.value = true;
  try {
    const loadedCount = await messageStore.loadEarlierMessages(props.channelId, props.channelType);
    if (loadedCount <= 0 || channelKey.value !== activeChannelKey) return;

    await nextTick();
    if (!scrollContainer.value) return;
    const nextScrollHeight = container.scrollHeight;
    scrollContainer.value.scrollTop = nextScrollHeight - previousScrollHeight + previousScrollTop;
    scrollTop.value = scrollContainer.value.scrollTop;
  } finally {
    isLoadingEarlier.value = false;
  }
}

function handleScroll() {
  const container = scrollContainer.value;
  scrollTop.value = container?.scrollTop || 0;
  if (container && container.scrollTop <= topHistoryLoadThreshold) {
    void loadEarlierMessages();
  }
}

function scrollToBottom(behavior: 'auto' | 'smooth' = 'auto') {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
      scrollTop.value = scrollContainer.value.scrollTop;
    }
  });
}

watch(() => messages.value.length, (_newLength, oldLength) => {
  if (isLoadingEarlier.value) return;
  if (oldLength && !isNearBottom()) return;
  scrollToBottom('smooth');
}, { immediate: true });

watch(() => props.channelId, () => {
  scrollToBottom('auto');
});

watch(messages, (newMsgs) => {
  const missingUids = newMsgs
    .map(m => m.fromUID)
    .filter(uid => uid && !userStore.userCache[uid]);

  if (missingUids.length > 0) {
    userStore.getUsersByIds([...new Set(missingUids)]);
  }
}, { immediate: true, deep: true });

watch(() => [props.channelId, props.channelType], () => {
  void hydrateActiveDeploymentRequestCard();
}, { immediate: true });

watch(pollingDeploymentRequestIds, (ids) => {
  if (ids.length > 0) {
    startDeploymentPolling();
  } else {
    stopDeploymentPolling();
  }
}, { immediate: true });

function shouldShowTime(msg: any, index: number): boolean {
  if (index === 0) return true;
  const prevMsg = renderableMessages.value[index - 1];
  return (msg.timestamp - prevMsg.timestamp) > 300;
}

function isClowderConnectorMessage(msg: any): boolean {
  const content = msg?.content || msg?.payload || {};
  return isClowderPayload(content);
}

function isMe(msg: any): boolean {
  if (isClowderConnectorMessage(msg)) return false;
  return msg.fromUID === userStore.currentUser?.uid;
}

function getClowderSenderNameFromMessage(msg: any): string {
  const content = msg?.content || msg?.payload || {};
  const connectorId = content.connectorId || content.connector_id;
  const isDirectCatChannel = props.channelType === 1 && String(props.channelId || '').startsWith('clowder_cat:');
  if (connectorId !== 'im-web' && !content.catDisplayName && !content.cat_display_name && !content.catId && !content.cat_id && !isDirectCatChannel) {
    return '';
  }
  const explicitName = getClowderCatDisplayNameFromPayload(content);
  if (explicitName) return explicitName;

  if (isDirectCatChannel) {
    const catId = String(props.channelId || '').slice('clowder_cat:'.length);
    const cachedName = String(channelStore.channels[channelKey.value]?.name || '').trim();
    if (cachedName && cachedName !== props.channelId && cachedName !== catId) return cachedName;
  }

  return String(content.catId || content.cat_id || '');
}

function getMessageStableKey(msg: any) {
  return String(msg?.clientMsgNo || msg?.messageID || `${msg?.fromUID || ''}:${msg?.messageSeq || ''}:${msg?.timestamp || ''}`);
}

function getNearbyClowderSenderName(msg: any): string {
  if (!isClowderConnectorMessage(msg)) return '';
  const currentKey = getMessageStableKey(msg);
  const index = renderableMessages.value.findIndex(item => item === msg || getMessageStableKey(item) === currentKey);
  if (index <= 0) return '';

  const currentFrom = String(msg?.fromUID || '');
  const currentTimestamp = Number(msg?.timestamp || 0);
  for (let i = index - 1; i >= 0; i--) {
    const candidate = renderableMessages.value[i];
    if (!isClowderConnectorMessage(candidate)) {
      break;
    }
    if (currentFrom && String(candidate.fromUID || '') !== currentFrom) {
      break;
    }
    const candidateTimestamp = Number(candidate.timestamp || 0);
    if (currentTimestamp && candidateTimestamp && Math.abs(currentTimestamp - candidateTimestamp) > 180) {
      break;
    }
    const name = getClowderSenderNameFromMessage(candidate);
    if (name) return name;
  }

  return '';
}

function getClowderSenderName(msg: any): string {
  return getClowderSenderNameFromMessage(msg) || getNearbyClowderSenderName(msg);
}

function normalizeCatLookupToken(value: string) {
  return String(value || '').replace(/^@/, '').replace(/[🐱🐈🐾\s]+$/g, '').trim().toLowerCase();
}

function findCatContactByDisplayName(displayName: string) {
  const lookup = normalizeCatLookupToken(displayName);
  if (!lookup) return undefined;
  const groups = Object.values(clowderStore.groupCatMemberships || {}).flat();
  const directory = [
    ...groups,
    ...(clowderStore.connectedCatContacts || []),
    ...(clowderStore.catContactDirectory || [])
  ];
  return directory.find(cat => [
    cat.catId,
    cat.displayName,
    cat.name,
    ...(cat.aliases || []),
    ...(cat.mentionNames || [])
  ].some(token => normalizeCatLookupToken(String(token || '')) === lookup));
}

function getClowderSenderCatId(msg: any): string {
  const content = msg?.content || msg?.payload || {};
  const directCatId = getClowderCatIdFromContactId(String(props.channelId || ''));
  const explicitCatId = String(content.catId || content.cat_id || directCatId || '').trim();
  if (explicitCatId) return explicitCatId;
  const displayName = getClowderSenderName(msg);
  return findCatContactByDisplayName(displayName)?.catId || normalizeCatLookupToken(displayName);
}

function getMentionTargetForMessage(msg: any) {
  if (isClowderConnectorMessage(msg)) {
    const catId = getClowderSenderCatId(msg);
    if (!catId) return undefined;
    return {
      uid: buildClowderCatContactId(catId),
      name: getClowderSenderName(msg) || catId
    };
  }
  const uid = String(msg?.fromUID || '');
  if (!uid) return undefined;
  return {
    uid,
    name: getMessageSenderName(msg)
  };
}

function getClowderSenderAvatar(msg: any): string {
  const content = msg?.content || msg?.payload || {};
  const metadata = content.metadata || {};
  const avatar = content.avatar ||
    content.catAvatar ||
    content.cat_avatar ||
    metadata.avatar ||
    metadata.catAvatar ||
    metadata.cat_avatar ||
    '';
  if (avatar) return String(avatar);

  if (props.channelType === 1 && String(props.channelId || '').startsWith('clowder_cat:')) {
    return String(channelStore.channels[channelKey.value]?.avatar || '');
  }
  return '';
}

function getMessageSenderName(msg: any): string {
  const clowderName = getClowderSenderName(msg);
  if (clowderName) return clowderName;
  return userStore.userCache[msg.fromUID]?.name || msg.fromUID || '加载中';
}

function getMessageSenderAvatar(msg: any): string {
  const clowderAvatar = getClowderSenderAvatar(msg);
  if (clowderAvatar) return clowderAvatar;
  if (isClowderConnectorMessage(msg)) return '';
  return userStore.userCache[msg.fromUID]?.avatar || '';
}

function textFromTranscriptItem(item: any): string {
  if (item === undefined || item === null || item === '') return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  return String(
    item.text ||
    item.content ||
    item.body ||
    item.message ||
    item.reasoning ||
    item.thinking ||
    item.summary ||
    ''
  ).trim();
}

function transcriptValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(textFromTranscriptItem).filter(Boolean);
  const text = textFromTranscriptItem(value);
  return text ? [text] : [];
}

function visibleTranscriptText(msg: any): string {
  const content = msg?.content || msg?.payload || {};
  const metadata = content.metadata || {};
  return [
    ...transcriptValues(content.thinking),
    ...transcriptValues(content.thought),
    ...transcriptValues(content.thoughts),
    ...transcriptValues(content.reasoning),
    ...transcriptValues(content.reasoning_content),
    ...transcriptValues(content.transcript),
    ...transcriptValues(content.transcriptBlocks || content.transcript_blocks),
    ...transcriptValues(metadata.thinking),
    ...transcriptValues(metadata.thought),
    ...transcriptValues(metadata.thoughts),
    ...transcriptValues(metadata.reasoning),
    ...transcriptValues(metadata.reasoning_content),
    ...transcriptValues(metadata.transcript),
    ...transcriptValues(metadata.transcriptBlocks || metadata.transcript_blocks)
  ].filter(Boolean).join('\n');
}

function buildMessageCopyText(msg: any): string {
  const content = msg?.content || msg?.payload || {};
  const body = String(content.text || content.content || '').trim();
  const transcript = visibleTranscriptText(msg).trim();
  return [body, transcript].filter(Boolean).join('\n\n');
}

function getMessageBodyText(msg: any): string {
  const content = msg?.content || msg?.payload || {};
  return String(content.text || content.content || content.markdown || '').trim();
}

function getMessageSource(msg: any): any {
  const content = msg?.content || msg?.payload || {};
  const metadata = content.metadata || {};
  return content.source || content.connectorSource || metadata.source || msg?.source || msg?.extra?.source || {};
}

function getCoordinationContext(msg: any): any {
  const content = msg?.content || msg?.payload || {};
  const metadata = content.metadata || {};
  return content.coordination || metadata.coordination || content.extra?.coordination || msg?.extra?.coordination;
}

function getProjectGroupHandoff(msg: any): ProjectGroupHandoffView | null {
  const content = msg?.content || msg?.payload || {};
  const metadata = content.metadata || {};
  const groupNo = String(
    metadata.project_group_no ||
    metadata.projectGroupNo ||
    content.project_group_no ||
    content.projectGroupNo ||
    ''
  ).trim();
  const isHandoff = metadata.project_handoff === true || metadata.projectHandoff === true || Boolean(groupNo);
  if (!isHandoff || !groupNo) return null;
  const groupName = String(
    metadata.project_group_name ||
    metadata.projectGroupName ||
    content.project_group_name ||
    content.projectGroupName ||
    groupNo
  ).trim();
  return {
    groupNo,
    groupName,
    bindingId: String(metadata.project_binding_id || metadata.projectBindingId || '').trim() || undefined,
    reused: metadata.reused === true || metadata.reused === 'true',
  };
}

async function openProjectGroupFromHandoff(msg: any) {
  const handoff = getProjectGroupHandoff(msg);
  if (!handoff?.groupNo) return;
  const path = `/chat/conversation/${handoff.groupNo}/2`;
  try {
    if (appRouter?.push) {
      await appRouter.push(path);
      return;
    }
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch (err) {
    console.warn('[MessageList] open project group failed', err);
  }
}

function asStringList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，\s]+/)
      : [];
  return Array.from(new Set(raw.map(item => String(item || '').trim()).filter(Boolean)));
}

function getProjectGroupConfirmation(msg: any): ProjectGroupConfirmationView | null {
  const content = msg?.content || msg?.payload || {};
  const metadata = content.metadata || {};
  const isConfirmation = metadata.project_group_confirmation === true ||
    metadata.projectGroupConfirmation === true ||
    content.project_group_confirmation === true ||
    content.projectGroupConfirmation === true;
  if (!isConfirmation) return null;

  const sourceText = String(
    metadata.source_text ||
    metadata.sourceText ||
    content.source_text ||
    content.sourceText ||
    content.text ||
    ''
  ).trim();
  const projectName = String(
    metadata.project_name ||
    metadata.projectName ||
    content.project_name ||
    content.projectName ||
    resolveProjectGroupName(sourceText)
  ).trim();
  const pmDirectChannelId = String(metadata.pmDirectChannelId || content.pmDirectChannelId || props.channelId || '').trim();
  const pmDirectChannelType = Number(metadata.pmDirectChannelType || content.pmDirectChannelType || props.channelType || 1);
  return {
    projectName: projectName || '项目群聊',
    status: String(metadata.project_group_status || metadata.projectGroupStatus || content.project_group_status || content.projectGroupStatus || 'pending_confirmation'),
    sourceText,
    sourceMessageId: String(metadata.source_message_id || metadata.sourceMessageId || content.sourceMessageId || '').trim() || undefined,
    targetCatIds: asStringList(metadata.targetCatIds || content.targetCatIds),
    workerCatIds: asStringList(metadata.workerCatIds || content.workerCatIds),
    workspaceId: String(metadata.workspaceId || content.workspaceId || '').trim() || undefined,
    pmDirectChannelId,
    pmDirectChannelType,
    pmDirectThreadId: String(metadata.pmDirectThreadId || content.pmDirectThreadId || '').trim() || undefined,
    groupNo: String(metadata.project_group_no || metadata.projectGroupNo || content.projectGroupNo || '').trim() || undefined,
    groupName: String(metadata.project_group_name || metadata.projectGroupName || content.projectGroupName || '').trim() || undefined,
    bindingId: String(metadata.project_binding_id || metadata.projectBindingId || content.projectBindingId || '').trim() || undefined,
    projectThreadId: String(metadata.projectThreadId || content.projectThreadId || '').trim() || undefined,
    reused: metadata.reused === true || metadata.reused === 'true' || content.reused === true,
    error: String(metadata.error || content.error || '').trim() || undefined,
  };
}

function projectGroupConfirmationStatusText(confirmation?: ProjectGroupConfirmationView | null) {
  if (!confirmation) return '';
  if (confirmation.status === 'creating') return '正在创建或复用项目群，并准备投递任务。';
  if (confirmation.status === 'created') return confirmation.reused ? '已复用项目群，任务已投递。' : '已创建项目群，任务已投递。';
  if (confirmation.status === 'failed') return confirmation.error || '项目群创建失败，可以重试。';
  if (confirmation.status === 'cancelled') return '已取消创建项目群。';
  return '确认后，PM 会创建或复用项目群，并把这条任务投递到项目群继续执行。';
}

function projectGroupConfirmationText(confirmation: ProjectGroupConfirmationView) {
  const actionText = confirmation.status === 'created'
    ? (confirmation.reused ? '已复用项目群' : '已创建项目群')
    : 'PM 建议创建项目群';
  return [
    `${actionText}「${confirmation.groupName || confirmation.projectName}」。`,
    '',
    projectGroupConfirmationStatusText(confirmation)
  ].join('\n');
}

function canConfirmProjectGroup(confirmation?: ProjectGroupConfirmationView | null) {
  if (!confirmation) return false;
  return ['pending_confirmation', 'failed', 'cancelled'].includes(confirmation.status);
}

function updateProjectGroupConfirmationMessage(
  msg: any,
  next: Partial<ProjectGroupConfirmationView> & { status: ProjectGroupConfirmationView['status'] }
) {
  const current = getProjectGroupConfirmation(msg);
  if (!current) return;
  const content = msg?.content || {};
  const metadata = content.metadata || {};
  const confirmation = { ...current, ...next };
  const text = projectGroupConfirmationText(confirmation);
  messageStore.updateMessageStatus(msg.clientMsgNo, {
    content: {
      ...content,
      type: 1,
      text,
      content: text,
      format: 'markdown',
      markdown: true,
      connectorId: content.connectorId || content.connector_id || 'im-web',
      catId: content.catId || content.cat_id || CLOWDER_COORDINATOR_CAT_ID,
      catDisplayName: content.catDisplayName || content.cat_display_name || 'PM / 协调者',
      metadata: {
        ...metadata,
        project_group_confirmation: true,
        projectGroupConfirmation: true,
        project_group_status: confirmation.status,
        projectGroupStatus: confirmation.status,
        project_name: confirmation.projectName,
        projectName: confirmation.projectName,
        source_text: confirmation.sourceText,
        sourceText: confirmation.sourceText,
        source_message_id: confirmation.sourceMessageId,
        sourceMessageId: confirmation.sourceMessageId,
        targetCatIds: confirmation.targetCatIds,
        workerCatIds: confirmation.workerCatIds,
        workspaceId: confirmation.workspaceId,
        pmDirectChannelId: confirmation.pmDirectChannelId,
        pmDirectChannelType: confirmation.pmDirectChannelType,
        pmDirectThreadId: confirmation.pmDirectThreadId,
        project_group_no: confirmation.groupNo,
        projectGroupNo: confirmation.groupNo,
        project_group_name: confirmation.groupName,
        projectGroupName: confirmation.groupName,
        project_binding_id: confirmation.bindingId,
        projectBindingId: confirmation.bindingId,
        projectThreadId: confirmation.projectThreadId,
        project_handoff: confirmation.status === 'created' && Boolean(confirmation.groupNo),
        projectHandoff: confirmation.status === 'created' && Boolean(confirmation.groupNo),
        reused: confirmation.reused === true,
        error: confirmation.error
      }
    },
    status: confirmation.status === 'creating' ? 'sending' : 'success'
  });
}

function uniqueProjectWorkerCats() {
  const seen = new Set<string>();
  const candidates = [
    ...(clowderStore.connectedCatContacts || []),
    ...(clowderStore.catContactDirectory || [])
  ];
  return candidates.filter(cat => {
    if (!cat?.catId || cat.catId === CLOWDER_COORDINATOR_CAT_ID || seen.has(cat.catId)) return false;
    seen.add(cat.catId);
    return cat.connected !== false && cat.available !== false;
  });
}

function buildProjectGroupPromptContext(confirmation: ProjectGroupConfirmationView, targetCatIds: string[]) {
  const recentMessages = messageStore.getChannelMessages(props.channelId, props.channelType)
    .filter(message => getMessageBodyText(message))
    .slice(-12)
    .map(message => `- ${getMessageSenderName(message)}: ${getMessageBodyText(message)}`);
  return [
    `Conversation: ${confirmation.pmDirectChannelId} (type: ${confirmation.pmDirectChannelType})`,
    `Project group confirmation: ${confirmation.projectName}`,
    `Mention target cat ids: ${targetCatIds.length ? targetCatIds.join(', ') : 'none'}`,
    'Trigger reason: project_group_confirmation',
    `Current message: ${confirmation.sourceText}`,
    'Recent messages:',
    ...(recentMessages.length ? recentMessages : ['- No recent messages available.'])
  ].join('\n');
}

async function persistProjectGroupThreadFromRoute(bindingId?: string, currentThreadId?: string, routeResponse?: unknown) {
  const trimmedBindingId = String(bindingId || '').trim();
  const existingThreadId = String(currentThreadId || '').trim();
  const routedThreadId = String((routeResponse as { threadId?: unknown })?.threadId || '').trim();
  if (!trimmedBindingId || !routedThreadId || routedThreadId === existingThreadId) return existingThreadId || routedThreadId;
  try {
    const binding = await clowderStore.updateProjectGroupBindingThread(trimmedBindingId, routedThreadId);
    return binding?.projectThreadId || routedThreadId;
  } catch (err) {
    console.warn('[MessageList] project group thread binding update failed', err);
    return existingThreadId || routedThreadId;
  }
}

async function ensureProjectGroupFromConfirmation(confirmation: ProjectGroupConfirmationView) {
  if (clowderStore.connectedCatContacts.length === 0 && clowderStore.catContactDirectory.length === 0) {
    await clowderStore.loadCatContactDirectory({ includeUnavailable: true }).catch(() => undefined);
  }
  const workerCats = uniqueProjectWorkerCats();
  const directKey = `${confirmation.pmDirectChannelId}-${Number(confirmation.pmDirectChannelType)}`;
  const directThreadId = confirmation.pmDirectThreadId ||
    clowderStore.conversations[directKey]?.binding?.threadId ||
    undefined;
  const response = await clowderStore.ensureProjectGroup({
    projectName: confirmation.projectName,
    workspaceId: confirmation.workspaceId,
    pmDirectChannelId: confirmation.pmDirectChannelId,
    pmDirectChannelType: confirmation.pmDirectChannelType as 1,
    pmDirectThreadId: directThreadId,
    pmMemberId: CLOWDER_COORDINATOR_MEMBER_ID,
    pmDisplayName: 'PM / 协调者',
    userMemberIds: userStore.currentUser?.uid ? [userStore.currentUser.uid] : [],
    catMemberIds: workerCats.map(cat => cat.catId),
    createdBy: 'pm'
  });
  const groupNo = response.binding.projectGroupNo;
  const groupName = response.binding.projectName;
  if (response.group) {
    groupStore.upsertGroup(response.group);
  }
  if (workerCats.length > 0) {
    await clowderStore.syncMixedGroupCats({
      groupId: groupNo,
      groupName,
      humanMembers: [
        {
          id: userStore.currentUser?.uid || 'current-user',
          displayName: userStore.currentUser?.name || userStore.currentUser?.uid || '我',
          role: 'owner',
          mentionHandle: `@${userStore.currentUser?.name || userStore.currentUser?.uid || '我'}`
        },
        {
          id: CLOWDER_COORDINATOR_MEMBER_ID,
          displayName: 'PM / 协调者',
          role: 'pm',
          mentionHandle: '@PM'
        }
      ],
      catMembers: workerCats,
      rules: {
        proactiveReplies: true,
        privacy: 'PM direct chat is private; only project handoff, task summary, and explicit project context may be shared into this group.'
      }
    });
  }
  const targetCatIds = confirmation.targetCatIds.length ? confirmation.targetCatIds : [CLOWDER_COORDINATOR_CAT_ID];
  const routeResponse = await clowderStore.sendConversationMessage({
    channelId: groupNo,
    channelType: 2,
    targetCatIds,
    promptContext: buildProjectGroupPromptContext(confirmation, targetCatIds)
  }, confirmation.sourceText);
  const projectThreadId = await persistProjectGroupThreadFromRoute(
    response.binding.id,
    response.binding.projectThreadId,
    routeResponse
  );
  void messageStore.syncMessages(groupNo, 2, { hydrateVisibleHistory: true });
  return {
    groupNo,
    groupName,
    bindingId: response.binding.id,
    projectThreadId,
    reused: response.reused === true,
    targetCatIds,
    workerCatIds: workerCats.map(cat => cat.catId)
  };
}

async function confirmProjectGroupCreation(msg: any) {
  const confirmation = getProjectGroupConfirmation(msg);
  if (!confirmation || !canConfirmProjectGroup(confirmation)) return;
  const key = String(msg.clientMsgNo || msg.messageID || confirmation.sourceMessageId || '');
  if (key && projectGroupActionKeys.has(key)) return;
  if (key) projectGroupActionKeys.add(key);
  updateProjectGroupConfirmationMessage(msg, { ...confirmation, status: 'creating', error: undefined });
  try {
    const result = await ensureProjectGroupFromConfirmation(confirmation);
    updateProjectGroupConfirmationMessage(msg, {
      ...confirmation,
      status: 'created',
      groupNo: result.groupNo,
      groupName: result.groupName,
      bindingId: result.bindingId,
      projectThreadId: result.projectThreadId,
      reused: result.reused,
      targetCatIds: result.targetCatIds,
      workerCatIds: result.workerCatIds,
      error: undefined
    });
    Message.success(result.reused ? `已复用项目群「${result.groupName}」` : `已创建项目群「${result.groupName}」`);
  } catch (err) {
    const error = err instanceof Error ? err.message : '项目群创建失败';
    updateProjectGroupConfirmationMessage(msg, { ...confirmation, status: 'failed', error });
    Message.error('项目群创建失败，请重试');
  } finally {
    if (key) projectGroupActionKeys.delete(key);
  }
}

function cancelProjectGroupCreation(msg: any) {
  const confirmation = getProjectGroupConfirmation(msg);
  if (!confirmation || !canConfirmProjectGroup(confirmation)) return;
  updateProjectGroupConfirmationMessage(msg, { ...confirmation, status: 'cancelled', error: undefined });
}

function getCoordinationIdFromMessage(msg: any): string {
  const text = getMessageBodyText(msg);
  const coordination = getCoordinationContext(msg);
  const explicit = String(
    coordination?.coordinationId ||
    coordination?.id ||
    msg?.coordinationId ||
    ''
  ).trim();
  if (explicit) return explicit;
  const match = text.match(/\*\*Coordination\*\*:\s*([^\s]+)/i) || text.match(/\b(coord[-_][a-z0-9-]+)/i);
  return String(match?.[1] || '').trim();
}

function isCoordinatorSummaryMessage(msg: any): boolean {
  const text = getMessageBodyText(msg);
  const source = getMessageSource(msg);
  return Boolean(
    text.includes('Coordinator / Multi-Mention') ||
    text.includes('Coordinator / Multi-Mention 结果汇总') ||
    source.connector === 'multi-mention-result' ||
    source.label === 'Multi-Mention 结果' ||
    getCoordinationContext(msg)
  );
}

function maybeHydrateCoordination(coordinationId: string) {
  if (!coordinationId || clowderStore.getCoordination(coordinationId) || coordinationHydrationIds.has(coordinationId)) {
    return;
  }
  coordinationHydrationIds.add(coordinationId);
  void clowderStore.loadCoordination(coordinationId)
    .catch(() => undefined)
    .finally(() => {
      coordinationHydrationIds.delete(coordinationId);
    });
}

function lookupAgentName(catId?: string) {
  if (!catId) return '';
  const groupCats = clowderStore.groupCatMemberships[props.channelId] || [];
  const agent = [
    ...(clowderStore.agentDirectories[channelKey.value]?.agents || []),
    ...groupCats,
    ...(clowderStore.connectedCatContacts || []),
  ].find((item: any) => item.catId === catId || item.id === catId);
  return String(agent?.displayName || (agent as any)?.name || catId);
}

function inferCoordinatorStatusFromText(text: string): string {
  if (/失败|failed/i.test(text)) return 'failed';
  if (/超时|timeout/i.test(text)) return 'partial';
  return 'succeeded';
}

function extractQuestionFromCoordinatorText(text: string): string {
  const match = text.match(/\*\*问题\*\*:\s*(.+)/);
  return String(match?.[1] || '').trim();
}

function buildCoordinatorSummary(msg: any): CoordinatorSummaryView | null {
  if (!isCoordinatorSummaryMessage(msg)) return null;
  const text = getMessageBodyText(msg);
  const coordinationId = getCoordinationIdFromMessage(msg);
  if (coordinationId) maybeHydrateCoordination(coordinationId);
  const coordination = coordinationId ? clowderStore.getCoordination(coordinationId) : undefined;
  const source = getMessageSource(msg);
  const targetCatIds = coordination?.targetCatIds ||
    (Array.isArray(source?.meta?.targets) ? source.meta.targets.map((item: any) => String(item)) : []);

  if (coordination) {
    return {
      coordinationId: coordination.coordinationId,
      status: coordination.status,
      goal: coordination.goal,
      aggregateSummary: coordination.aggregateSummary || '',
      failureReason: coordination.failureReason || '',
      conflict: /冲突|conflict/i.test(`${coordination.aggregateSummary || ''}\n${coordination.failureReason || ''}`),
      targetCatIds,
      subtasks: coordination.subtasks.map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        targetCatId: subtask.targetCatId,
        targetName: lookupAgentName(subtask.targetCatId),
        status: subtask.status,
        result: subtask.result,
        failureReason: subtask.failureReason,
        artifactRefs: subtask.artifactRefs,
      })),
    };
  }

  return {
    coordinationId: coordinationId || undefined,
    status: inferCoordinatorStatusFromText(text),
    goal: extractQuestionFromCoordinatorText(text),
    aggregateSummary: '',
    failureReason: '',
    conflict: /冲突|conflict/i.test(text),
    targetCatIds,
    subtasks: targetCatIds.map((catId: string) => ({
      id: `${coordinationId || getMessageStableKey(msg)}:${catId}`,
      title: lookupAgentName(catId),
      targetCatId: catId,
      targetName: lookupAgentName(catId),
      status: inferCoordinatorStatusFromText(text),
    })),
  };
}

function coordinatorBusyAction(summary: CoordinatorSummaryView): 'redispatch' | 'cancel' | '' {
  const id = summary.coordinationId || '';
  if (!id) return '';
  if (coordinatorActionKey.value === `${id}:redispatch`) return 'redispatch';
  if (coordinatorActionKey.value === `${id}:cancel`) return 'cancel';
  return '';
}

function getMessageSearchText(msg: any): string {
  const content = msg?.content || msg?.payload || {};
  return [
    getMessageStableKey(msg),
    msg?.messageID,
    msg?.clientMsgNo,
    msg?.messageSeq,
    getMessageBodyText(msg),
    content.taskId,
    content.coordinationId,
  ].map((value) => String(value || '')).filter(Boolean).join('\n');
}

async function handleLocateMessageEvent(event: Event) {
  const detail = (event as CustomEvent)?.detail || {};
  const needles = [
    detail.messageId,
    detail.sourceMessageId,
    detail.taskId,
    detail.coordinationId,
  ].map((value) => String(value || '').trim()).filter(Boolean);
  if (!needles.length) return;

  const index = renderableMessages.value.findIndex((message) => {
    const searchable = getMessageSearchText(message);
    return needles.some((needle) => searchable.includes(needle));
  });
  if (index < 0) {
    Message.info('未找到对应聊天消息');
    return;
  }

  historyWindowSize.value = Math.max(historyWindowSize.value, renderableMessages.value.length);
  await nextTick();
  const container = scrollContainer.value;
  if (!container) return;
  container.scrollTop = Math.max(0, index * estimatedRowHeight - 80);
  scrollTop.value = container.scrollTop;
  await nextTick();
  const key = getMessageStableKey(renderableMessages.value[index]);
  const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-message-key]'));
  const target = rows.find((row) => row.dataset.messageKey === key);
  if (!target) return;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.classList.add('is-located');
  window.setTimeout(() => target.classList.remove('is-located'), 1800);
}

async function handleCoordinatorSummaryRedispatch(summary: CoordinatorSummaryView) {
  const coordinationId = String(summary.coordinationId || '').trim();
  if (!coordinationId || coordinatorActionKey.value) return;
  coordinatorActionKey.value = `${coordinationId}:redispatch`;
  const text = `/dispatch ${coordinationId} 请协调者重新派发未完成或失败的子任务，并重新汇总当前结果。`;
  try {
    await messageStore.sendMessage(props.channelId, props.channelType, text);
    await clowderStore.sendConversationMessage({
      channelId: props.channelId,
      channelType: props.channelType as 1 | 2,
      directCatId: getClowderCatIdFromContactId(props.channelId),
      targetCatIds: ['coordinator'],
      promptContext: [
        `Coordinator quick action: redispatch`,
        `Coordination: ${coordinationId}`,
        summary.goal ? `Goal: ${summary.goal}` : '',
      ].filter(Boolean).join('\n'),
    }, text);
    window.setTimeout(() => {
      void messageStore.syncMessages(props.channelId, props.channelType, { hydrateVisibleHistory: true });
    }, 2500);
    Message.success('已请求重新派发');
  } catch (err: any) {
    Message.error(err?.message || err?.msg || '重新派发失败');
  } finally {
    coordinatorActionKey.value = '';
  }
}

async function handleCoordinatorSummaryCancel(summary: CoordinatorSummaryView) {
  const coordinationId = String(summary.coordinationId || '').trim();
  if (!coordinationId || coordinatorActionKey.value) return;
  coordinatorActionKey.value = `${coordinationId}:cancel`;
  try {
    await clowderStore.cancelCoordination(coordinationId, 'cancelled from IM Web coordinator summary');
    Message.success('已取消协调任务');
  } catch (err: any) {
    Message.error(err?.message || err?.msg || '取消协调任务失败');
  } finally {
    coordinatorActionKey.value = '';
  }
}

function fallbackCopyText(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('copy failed');
  } finally {
    document.body.removeChild(textarea);
  }
}

async function copyTextToClipboard(text: string) {
  if (navigator?.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  fallbackCopyText(text);
}

function handleRightClick(e: MouseEvent, msg: any) {
  e.preventDefault();
  showAvatarMenu.value = false;
  selectedMsg.value = msg;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  showMenu.value = true;
}

function handleAvatarContextMenu(e: MouseEvent, msg: any) {
  e.preventDefault();
  e.stopPropagation();
  if (props.channelType !== 2 || isMe(msg)) return;
  showMenu.value = false;
  selectedAvatarMsg.value = msg;
  avatarMenuX.value = e.clientX;
  avatarMenuY.value = e.clientY;
  showAvatarMenu.value = true;
}

const menuReactions = computed(() => {
  if (!selectedMsg.value) return [];
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  return emojis.map(emoji => ({
    emoji,
    action: () => handleSendReaction(selectedMsg.value, emoji)
  }));
});

async function handleSendReaction(msg: any, emoji: string) {
  try {
    await messageStore.toggleReaction(props.channelId, props.channelType, msg, emoji);
  } catch (err: any) {
    Message.error(err.message || err.msg || '回应失败');
  }
}

const menuItems = computed(() => {
  if (!selectedMsg.value) return [];
  const items = [];
  const msg = selectedMsg.value;
  const canUseBackendAction = Boolean(msg.messageID && msg.messageSeq);

  if (msg.status === 'fail' && msg.retryable) {
    items.push({
      label: '重试发送',
      action: async () => {
        try {
          await messageStore.retryMessage(props.channelId, props.channelType, msg.clientMsgNo);
          Message.success('已重新发送');
        } catch (err: any) {
          Message.error(err.message || err.msg || '重试失败');
        }
      }
    });
  }

  const isText = msg.content?.type === 1;
  if (isText) {
    items.push({
      label: '复制',
      action: async () => {
        const text = buildMessageCopyText(selectedMsg.value);
        await copyTextToClipboard(text);
        Message.success('已复制到剪贴板');
      }
    });
  }

  const isMine = isMe(msg);
  const now = Math.floor(Date.now() / 1000);
  const isWithinWindow = (now - msg.timestamp) < remoteConfig.value.revoke_second;

  if (isMine && isText && isWithinWindow) {
    items.push({
      label: '编辑消息',
      disabled: !canUseBackendAction,
      action: () => {
        editDialogText.value = msg.content?.text || '';
        editDialogVisible.value = true;
      }
    });
  }

  if (isMine && isWithinWindow) {
    items.push({
      label: '撤回消息',
      danger: true,
      action: async () => {
        try {
          await messageStore.revokeMessage(
            props.channelId,
            props.channelType,
            selectedMsg.value.clientMsgNo,
            selectedMsg.value.messageID
          );
          Message.success('已撤回消息');
        } catch (err: any) {
          Message.error(err.msg || '撤回失败');
        }
      }
    });
  }

  items.push({
    label: msg.remoteExtra?.isPinned ? '取消置顶' : '设为置顶',
    disabled: !canUseBackendAction,
    action: async () => {
      try {
        await messageStore.togglePinnedMessage(props.channelId, props.channelType, msg);
        Message.success(msg.remoteExtra?.isPinned ? '已置顶消息' : '已取消置顶');
      } catch (err: any) {
        Message.error(err.message || err.msg || '置顶操作失败');
      }
    }
  });

  items.push({
    label: '查看回执',
    disabled: !canUseBackendAction,
    action: async () => {
      try {
        const receipt = await messageStore.fetchReceipt(msg.messageID);
        const readed = receipt.readed?.length || 0;
        const unread = receipt.unread?.length || 0;
        Message.info(`已读 ${readed} 人，未读 ${unread} 人`);
      } catch (err: any) {
        Message.warning(err.message || err.msg || '回执暂不可用');
      }
    }
  });

  items.push({
    label: '提醒暂不可用',
    disabled: true,
    action: () => {}
  });

  items.push({
    label: '引用回复',
    action: () => {
      messageStore.setReplyTarget(msg);
    }
  });

  items.push({
    label: '本地删除',
    danger: true,
    disabled: !canUseBackendAction,
    action: async () => {
      try {
        await messageStore.deleteLocalMessage(props.channelId, props.channelType, msg);
        Message.success('已在本地删除');
      } catch (err: any) {
        Message.error(err.message || err.msg || '删除失败');
      }
    }
  });

  if (isMine || props.channelType === 2) {
    items.push({
      label: '双向删除',
      danger: true,
      disabled: !canUseBackendAction,
      action: async () => {
        try {
          await messageStore.deleteMutualMessage(props.channelId, props.channelType, msg);
          Message.success('已双向删除');
        } catch (err: any) {
          Message.error(err.message || err.msg || '双向删除失败');
        }
      }
    });
  }

  return items;
});

const avatarMenuItems = computed(() => {
  if (!selectedAvatarMsg.value) return [];
  const msg = selectedAvatarMsg.value;
  const mentionTarget = getMentionTargetForMessage(msg);
  const items: Array<{ label: string; action: () => void; disabled?: boolean }> = [{
    label: '@TA',
    disabled: !mentionTarget?.uid,
    action: () => {
      if (!mentionTarget) return;
      emit('mention-user', mentionTarget);
      showAvatarMenu.value = false;
    }
  }];
  if (!isClowderConnectorMessage(msg)) {
    const uid = String(msg?.fromUID || '');
    items.push({
      label: '查看资料',
      disabled: !uid,
      action: () => {
        emit('view-user-profile', { uid });
        showAvatarMenu.value = false;
      }
    });
  }
  return items;
});

async function handleConfirmEdit(value?: string) {
  if (!selectedMsg.value) return;
  const nextText = String(value || '').trim();
  if (!nextText || nextText === selectedMsg.value.content?.text) {
    editDialogVisible.value = false;
    return;
  }
  try {
    await messageStore.editMessage(props.channelId, props.channelType, selectedMsg.value, nextText);
    Message.success('已编辑消息');
    editDialogVisible.value = false;
  } catch (err: any) {
    Message.error(err.message || err.msg || '编辑失败');
  }
}

function handleFilePreview(payload: any) {
  emit('open-preview', {
    source: 'file',
    ...payload
  });
}

function handleImagePreview(payload: any) {
  emit('open-preview', {
    source: 'image',
    ...payload
  });
}

function handleCodePreview(payload: any) {
  emit('open-preview', {
    source: 'ai-code',
    kind: 'ai-html',
    ...payload
  });
}

function updateDeploymentCardStatus(msg: any, status: string, extra: Record<string, unknown> = {}) {
  messageStore.updateMessageStatus(msg.clientMsgNo, {
    content: {
      ...(msg.content || {}),
      status,
      ...extra
    }
  });
}

function isDeploymentCardMessage(msg: any) {
  const content = msg?.content || msg?.payload || {};
  const type = String(content.cardType || content.kind || '').toLowerCase();
  return Number(content.type || 0) === 7 && ['deployment', 'deploy', 'deployment_confirmation', 'deploy_confirmation'].includes(type);
}

function getDeploymentRequestIdFromMessage(msg: any) {
  const content = msg?.content || msg?.payload || {};
  const request = content.deploymentRequest || {};
  return String(content.deploymentRequestId || request.deploymentRequestId || '').trim();
}

function findDeploymentCardMessage(deploymentRequestId: string) {
  const id = String(deploymentRequestId || '').trim();
  if (!id) return null;
  return messages.value.find((msg) => getDeploymentRequestIdFromMessage(msg) === id) || null;
}

function addDeploymentResultSummaryMessage(sourceMessage: any, deploymentRequest: any) {
  const deploymentRequestId = String(deploymentRequest?.id || '').trim();
  if (!deploymentRequestId || deploymentResultSummaryKeys.has(deploymentRequestId)) return;
  const status = String(deploymentRequest.status || '');
  if (!['succeeded', 'failed', 'cancelled', 'canceled'].includes(status)) return;
  deploymentResultSummaryKeys.add(deploymentRequestId);

  const sourceContent = sourceMessage?.content || {};
  const requestContext = sourceContent.deploymentRequest || {};
  const previewUrl = String(deploymentRequest.previewUrl || '').trim();
  const downloadUrl = String(deploymentRequest.downloadUrl || '').trim();
  const failureReason = String(deploymentRequest.failureReason || '').trim();
  const succeeded = status === 'succeeded';
  const text = [
    'Coordinator / Deployment 结果汇总',
    '',
    `- 部署状态：${succeeded ? '成功' : status === 'failed' ? '失败' : '已取消'}`,
    `- 部署目标：${String(deploymentRequest.target || sourceContent.target || '未填写')}`,
    `- 部署环境：${String(deploymentRequest.environment || sourceContent.environment || '未填写')}`,
    previewUrl ? `- 预览链接：${previewUrl}` : '',
    downloadUrl ? `- 源码下载：${downloadUrl}` : '',
    failureReason ? `- 风险/失败原因：${failureReason}` : '- 风险提示：请在发布前复核页面内容、资源路径和移动端表现。',
  ].filter(Boolean).join('\n');

  const clientMsgNo = `deployment-summary-${deploymentRequestId}`;
  messageStore.addMessage(props.channelId, props.channelType, {
    messageID: clientMsgNo,
    messageSeq: 0,
    clientMsgNo,
    fromUID: 'clowder_ai',
    timestamp: Math.floor(Date.now() / 1000),
    content: {
      type: 1,
      text,
      content: text,
      format: 'markdown',
      markdown: true,
      connectorId: 'im-web',
      catId: String(sourceContent.catId || requestContext.targetCatIds?.[0] || 'coordinator'),
      catDisplayName: String(sourceContent.catDisplayName || '协调者'),
      source: {
        connector: 'deployment-result',
        deploymentRequestId,
      },
    },
    isRevoked: false,
    status: 'success',
  }, { countUnread: false });
}

function enqueueDeploymentFieldUpdate(deploymentRequestId: string, task: () => Promise<void>) {
  const previous = deploymentFieldQueues.get(deploymentRequestId) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      if (deploymentFieldQueues.get(deploymentRequestId) === next) {
        deploymentFieldQueues.delete(deploymentRequestId);
      }
    });
  deploymentFieldQueues.set(deploymentRequestId, next);
  return next;
}

function deploymentEditableFieldValue(value: unknown, placeholder: string) {
  const text = String(value || '').trim();
  return text && text !== placeholder ? text : '';
}

function startDeploymentPolling() {
  if (deploymentPollTimer !== null) return;
  void refreshDeploymentRequestCards();
  deploymentPollTimer = setInterval(() => {
    void refreshDeploymentRequestCards();
  }, deploymentPollIntervalMs);
}

function stopDeploymentPolling() {
  if (deploymentPollTimer === null) return;
  clearInterval(deploymentPollTimer);
  deploymentPollTimer = null;
}

async function refreshDeploymentRequestCards(ids = pollingDeploymentRequestIds.value) {
  if (deploymentPollInFlight || ids.length === 0) return;
  deploymentPollInFlight = true;
  try {
    for (const deploymentRequestId of ids) {
      const msg = findDeploymentCardMessage(deploymentRequestId);
      if (!msg) continue;
      const previousStatus = String((msg.content || {}).status || '');
      if (!deploymentPollableStatuses.has(previousStatus)) continue;
      try {
        const deploymentRequest = await clowderStore.loadDeploymentRequest(deploymentRequestId);
        if (!deploymentRequest) continue;
        upsertDeploymentCardFromRequest(msg, deploymentRequest);
        if (!deploymentTerminalStatuses.has(previousStatus) && deploymentTerminalStatuses.has(deploymentRequest.status)) {
          if (deploymentRequest.status === 'succeeded') {
            Message.success('部署完成');
          } else if (deploymentRequest.status === 'failed') {
            Message.error(deploymentRequest.failureReason || '部署失败');
          }
          addDeploymentResultSummaryMessage(msg, deploymentRequest);
        }
      } catch (err) {
        console.warn('[MessageList] Failed to refresh deployment request', deploymentRequestId, err);
      }
    }
  } finally {
    deploymentPollInFlight = false;
  }
}

function upsertDeploymentCardFromRequest(
  sourceMessage: any,
  deploymentRequest: any,
  extra: { error?: string } = {},
) {
  const sourceContent = sourceMessage?.content || {};
  const requestContext = sourceContent.deploymentRequest || {};
  const deploymentCard = buildDeploymentCardMessage(deploymentRequest, {
    channelType: props.channelType,
    currentUserId: userStore.currentUser?.uid,
    robotId: 'clowder_ai',
    timestamp: deploymentRequest.createdAt || Number(sourceMessage?.timestamp || 0),
    sourceText: String(requestContext.text || sourceContent.originalText || deploymentRequest.originalText || ''),
    sourceMessageId: String(requestContext.sourceMessageId || deploymentRequest.sourceMessageId || sourceMessage?.clientMsgNo || ''),
    targetCatIds: Array.isArray(requestContext.targetCatIds) ? requestContext.targetCatIds : [],
    triggerReason: requestContext.triggerReason,
    promptContext: requestContext.promptContext,
    catId: String(sourceContent.catId || ''),
    catDisplayName: String(sourceContent.catDisplayName || ''),
    error: extra.error,
  });
  messageStore.addMessage(props.channelId, props.channelType, deploymentCard, { countUnread: false });
}

async function hydrateActiveDeploymentRequestCard() {
  try {
    const deploymentRequest = await clowderStore.loadActiveDeploymentRequest({
      channelId: props.channelId,
      channelType: props.channelType as 1 | 2,
    });
    if (!deploymentRequest) return;
    upsertDeploymentCardFromRequest(null, deploymentRequest);
  } catch (err) {
    console.warn('[MessageList] Failed to hydrate active deployment request', err);
  }
}

async function handleDeploymentFieldUpdate(payload: { field: 'target' | 'environment'; value: string; message: any }) {
  const msg = payload.message;
  const content = msg?.content || {};
  const request = content.deploymentRequest || {};
  const deploymentRequestId = String(content.deploymentRequestId || request.deploymentRequestId || msg?.clientMsgNo || '').trim();
  if (!deploymentRequestId) return;
  await enqueueDeploymentFieldUpdate(deploymentRequestId, async () => {
    const latestMsg = findDeploymentCardMessage(deploymentRequestId) || msg;
    const clientMsgNo = String(latestMsg?.clientMsgNo || msg?.clientMsgNo || '');
    const latestContent = latestMsg?.content || {};
    const latestRequest = latestContent.deploymentRequest || request;
    const actionKey = `${deploymentRequestId}:${payload.field}:${String(payload.value || '').trim()}`;
    if (!clientMsgNo || deploymentFieldKeys.has(actionKey)) return;

    const currentStatus = String(latestContent.status || 'pending_confirmation');
    if (['confirmed', 'queued', 'running', 'succeeded', 'cancelled', 'canceled', 'submitting'].includes(currentStatus)) return;

    const previousStatus = currentStatus;
    const fieldValue = String(payload.value || '').trim();
    const existingTarget = deploymentEditableFieldValue(latestContent.target, '待确认目标');
    const existingEnvironment = deploymentEditableFieldValue(latestContent.environment, '待确认环境');
    const target = payload.field === 'target' ? fieldValue : existingTarget;
    const environment = payload.field === 'environment' ? fieldValue : existingEnvironment;
    deploymentFieldKeys.add(actionKey);
    updateDeploymentCardStatus(latestMsg, 'submitting', { error: '' });
    try {
      const response = await clowderStore.updateDeploymentRequestFields(deploymentRequestId, {
        ...(payload.field === 'target' || target ? { target: target || null } : {}),
        ...(payload.field === 'environment' || environment ? { environment: environment || null } : {}),
        sourceMessageId: String(latestRequest.sourceMessageId || clientMsgNo),
        cardMessageId: clientMsgNo,
        ...(Array.isArray(latestContent.targetCandidates)
          ? { targetCandidates: latestContent.targetCandidates }
          : {}),
        ...(latestContent.workspaceId || latestRequest.workspaceId ? { workspaceId: String(latestContent.workspaceId || latestRequest.workspaceId || '') } : {}),
        ...(latestContent.workspacePath || latestRequest.workspacePath ? { workspacePath: String(latestContent.workspacePath || latestRequest.workspacePath || '') } : {}),
      });
      upsertDeploymentCardFromRequest(latestMsg, response);
      Message.success(payload.field === 'target' ? '已更新部署目标' : '已更新部署环境');
    } catch (err: any) {
      updateDeploymentCardStatus(latestMsg, previousStatus === 'needs_fields' ? 'needs_fields' : previousStatus, {
        error: err?.message || err?.msg || '部署字段更新失败，可重试'
      });
      Message.error(err?.message || err?.msg || '部署字段更新失败');
    } finally {
      deploymentFieldKeys.delete(actionKey);
    }
  });
}

async function handleDeploymentCardAction(payload: { action: 'confirm' | 'cancel' | 'retry' | 'open-preview' | 'download'; message: any }) {
  const msg = payload.message;
  const clientMsgNo = String(msg?.clientMsgNo || '');
  const content = msg?.content || {};
  const request = content.deploymentRequest || {};
  const deploymentRequestId = String(content.deploymentRequestId || request.deploymentRequestId || clientMsgNo || '').trim();

  if (payload.action === 'open-preview') {
    const previewUrl = String(content.previewUrl || '').trim();
    if (!previewUrl) {
      Message.warning('预览链接还没有生成');
      return;
    }
    emit('open-preview', {
      source: 'deployment',
      kind: 'html',
      url: previewUrl,
      title: '部署预览',
      name: `${String(content.target || '部署目标')} · ${String(content.environment || '环境')}`,
      deploymentRequestId,
      deploymentJobId: String(content.deploymentJobId || ''),
    });
    return;
  }

  if (payload.action === 'download') {
    const downloadUrl = String(content.downloadUrl || '').trim();
    if (!downloadUrl) {
      Message.warning('源码包还没有生成');
      return;
    }
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const actionKey = `${deploymentRequestId}:${payload.action}`;
  if (!clientMsgNo || !deploymentRequestId || deploymentActionKeys.has(actionKey)) return;

  const currentStatus = String(content.status || 'pending_confirmation');
  const backendAction = payload.action === 'retry' ? 'confirm' : payload.action;
  if (payload.action === 'retry' && currentStatus !== 'failed') return;
  if (payload.action !== 'retry' && ['confirmed', 'queued', 'running', 'succeeded', 'cancelled', 'canceled', 'submitting'].includes(currentStatus)) return;
  const missingFields = Array.isArray(content.missingFields) ? content.missingFields : [];
  if (backendAction === 'confirm' && (currentStatus === 'needs_fields' || missingFields.length > 0)) {
    Message.warning(String(content.disabledReason || '请先补充部署目标和环境'));
    return;
  }

  const previousStatus = currentStatus;
  const actionId = `${deploymentRequestId}:${payload.action}:${Date.now()}`;
  deploymentActionKeys.add(actionKey);
  updateDeploymentCardStatus(msg, 'submitting', { error: '' });
  try {
    const targetCatIds = Array.isArray(request.targetCatIds) ? request.targetCatIds : [];
    const response = await clowderStore.sendDeploymentAction({
      channelId: props.channelId,
      channelType: props.channelType as 1 | 2,
      deploymentRequestId,
      action: backendAction,
      actionId,
      cardMessageId: clientMsgNo,
      sourceMessageId: String(request.sourceMessageId || clientMsgNo),
      target: String(content.target || ''),
      environment: String(content.environment || ''),
      workspaceId: String(content.workspaceId || request.workspaceId || ''),
      missingFields,
      directCatId: getClowderCatIdFromContactId(props.channelId),
      targetCatIds,
      originalText: String(request.text || ''),
      promptContext: [
        request.promptContext || '',
        `Deployment action: user selected ${payload.action} from the IM Web deployment card.`
      ].filter(Boolean).join('\n')
    });
    const nextStatus = response.status || (payload.action === 'cancel' ? 'cancelled' : 'confirmed');
    if (response.deploymentRequest) {
      upsertDeploymentCardFromRequest(msg, response.deploymentRequest);
    } else {
      updateDeploymentCardStatus(msg, nextStatus, {
        actionId,
        missingFields: response.missingFields || missingFields,
        error: ''
      });
    }
    if (backendAction === 'confirm') startDeploymentPolling();
    Message.success(payload.action === 'cancel' ? '已取消部署' : payload.action === 'retry' ? '已重新提交部署' : '已确认部署');
  } catch (err: any) {
    updateDeploymentCardStatus(msg, previousStatus === 'needs_fields' ? 'needs_fields' : 'failed', {
      error: err?.message || err?.msg || '部署操作失败，可重试'
    });
    Message.error(err?.message || err?.msg || '部署操作失败');
  } finally {
    deploymentActionKeys.delete(actionKey);
  }
}

onMounted(() => {
  window.addEventListener('clowder:locate-message', handleLocateMessageEvent);
});

onBeforeUnmount(() => {
  stopDeploymentPolling();
  window.removeEventListener('clowder:locate-message', handleLocateMessageEvent);
});
</script>

<template>
  <div ref="scrollContainer" class="message-list" @scroll="handleScroll">
    <div v-if="topSpacerHeight > 0" class="history-spacer" :style="{ height: `${topSpacerHeight}px` }"></div>

    <div
      v-for="item in visibleMessages"
      :key="item.msg.clientMsgNo || item.msg.messageID"
      class="message-row-wrapper"
      :data-message-key="getMessageStableKey(item.msg)"
    >
      <TimeCell v-if="shouldShowTime(item.msg, item.index)" :timestamp="item.msg.timestamp" />

      <div
        v-if="item.msg.content?.type === 1000 || item.msg.isRevoked"
        class="sys-msg-row"
      >
        <SystemCell :message="item.msg" />
      </div>

      <div
        v-else
        class="msg-row"
        :class="{ 'is-me': isMe(item.msg) }"
        :data-message-status="item.msg.status"
        :data-message-seq="item.msg.messageSeq"
        @contextmenu="handleRightClick($event, item.msg)"
      >
        <ChannelAvatar
          v-if="!isMe(item.msg)"
          :name="getMessageSenderName(item.msg)"
          :avatar="getMessageSenderAvatar(item.msg)"
          :size="36"
          class="msg-avatar"
          @contextmenu.stop.prevent="handleAvatarContextMenu($event, item.msg)"
        />

        <div class="msg-bubble-container">
          <div
            v-if="channelType === 2 && !isMe(item.msg)"
            class="user-name-label"
          >
            {{ getMessageSenderName(item.msg) }}
          </div>

          <!-- Quote / Reply Reference Box -->
          <div v-if="item.msg.content?.reply" class="quote-reference-box" :class="{ 'is-me': isMe(item.msg) }">
            <span class="quote-author">@{{ item.msg.content.reply.fromName || item.msg.content.reply.fromUID }}:</span>
            <span class="quote-text">{{ item.msg.content.reply.content?.text || '[消息]' }}</span>
          </div>

          <TextCell
            v-if="item.msg.content?.type === 1"
            :message="item.msg"
            :is-me="isMe(item.msg)"
            @preview-code="handleCodePreview"
          />
          <div v-if="getProjectGroupConfirmation(item.msg)" class="project-confirm-card">
            <div class="project-confirm-card__header">
              <span>Project Group</span>
              <strong>{{ getProjectGroupConfirmation(item.msg)?.projectName }}</strong>
            </div>
            <p>{{ projectGroupConfirmationStatusText(getProjectGroupConfirmation(item.msg)) }}</p>
            <div class="project-confirm-card__meta">
              <span>PM 直聊</span>
              <span>{{ getProjectGroupConfirmation(item.msg)?.workerCatIds.length || 0 }} 个猫猫候选</span>
            </div>
            <div class="project-confirm-card__actions">
              <button
                v-if="canConfirmProjectGroup(getProjectGroupConfirmation(item.msg))"
                type="button"
                class="project-confirm-card__btn primary"
                @click.stop="confirmProjectGroupCreation(item.msg)"
              >
                确认创建项目群
              </button>
              <button
                v-if="getProjectGroupConfirmation(item.msg)?.status === 'pending_confirmation'"
                type="button"
                class="project-confirm-card__btn"
                @click.stop="cancelProjectGroupCreation(item.msg)"
              >
                取消
              </button>
              <button
                v-if="getProjectGroupConfirmation(item.msg)?.status === 'created'"
                type="button"
                class="project-confirm-card__btn primary"
                @click.stop="openProjectGroupFromHandoff(item.msg)"
              >
                打开项目群
              </button>
            </div>
          </div>
          <div v-if="getProjectGroupHandoff(item.msg)" class="project-handoff-row">
            <button
              type="button"
              class="project-handoff-link"
              @click.stop="openProjectGroupFromHandoff(item.msg)"
            >
              打开项目群「{{ getProjectGroupHandoff(item.msg)?.groupName }}」
            </button>
          </div>
          <CoordinatorSummaryCard
            v-if="buildCoordinatorSummary(item.msg)"
            :summary="buildCoordinatorSummary(item.msg) || emptyCoordinatorSummary"
            :busy-action="coordinatorBusyAction(buildCoordinatorSummary(item.msg) || emptyCoordinatorSummary)"
            @redispatch="handleCoordinatorSummaryRedispatch"
            @cancel="handleCoordinatorSummaryCancel"
          />
          <ImageCell
            v-else-if="item.msg.content?.type === 2"
            :message="item.msg"
            :is-me="isMe(item.msg)"
            @preview="handleImagePreview"
          />
          <GifCell
            v-else-if="item.msg.content?.type === 3"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <VoiceCell
            v-else-if="item.msg.content?.type === 4"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <VideoCell
            v-else-if="item.msg.content?.type === 5"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <LocationCell
            v-else-if="item.msg.content?.type === 6"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <CardCell
            v-else-if="item.msg.content?.type === 7"
            :message="item.msg"
            :is-me="isMe(item.msg)"
            @action="handleDeploymentCardAction"
            @deployment-field-update="handleDeploymentFieldUpdate"
          />
          <FileCell
            v-else-if="item.msg.content?.type === 8"
            :message="item.msg"
            :is-me="isMe(item.msg)"
            @preview="handleFilePreview"
          />
          <MergeCell
            v-else-if="item.msg.content?.type === 11"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <StickerCell
            v-else-if="item.msg.content?.type === 12 || item.msg.content?.type === 13"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <!-- Reactions Bar -->
          <div v-if="item.msg.reactions && item.msg.reactions.length > 0" class="reactions-bar">
            <div
              v-for="reaction in item.msg.reactions"
              :key="reaction.emoji"
              class="reaction-badge"
              @click="handleSendReaction(item.msg, reaction.emoji)"
            >
              <span class="reaction-emoji">{{ reaction.emoji }}</span>
              <span class="reaction-count">{{ reaction.count }}</span>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div v-if="bottomSpacerHeight > 0" class="history-spacer" :style="{ height: `${bottomSpacerHeight}px` }"></div>

    <ContextMenu
      v-if="showMenu && menuItems.length > 0"
      :x="menuX"
      :y="menuY"
      :items="menuItems"
      :reactions="menuReactions"
      @close="showMenu = false"
    />

    <ContextMenu
      v-if="showAvatarMenu && avatarMenuItems.length > 0"
      :x="avatarMenuX"
      :y="avatarMenuY"
      :items="avatarMenuItems"
      @close="showAvatarMenu = false"
    />

    <AppDialog
      v-model="editDialogText"
      :visible="editDialogVisible"
      title="编辑消息"
      mode="input"
      placeholder="输入新的消息内容"
      confirm-text="保存"
      @confirm="handleConfirmEdit"
      @close="editDialogVisible = false"
    />
  </div>
</template>

<style scoped>
.message-list {
  /* Fills the grid 1fr row. Must have overflow-y:auto for scrolling.
     height:100% + overflow-y:auto is the minimal correct pattern in a grid cell. */
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: var(--bg-primary);
  box-sizing: border-box;
}

.message-row-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 24px;
  overflow-anchor: none;
  flex-shrink: 0;
}

.project-confirm-card {
  width: min(360px, 100%);
  margin-top: 8px;
  padding: 12px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.project-confirm-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.project-confirm-card__header span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.project-confirm-card__header strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-confirm-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.project-confirm-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  color: var(--text-tertiary, var(--text-secondary));
  font-size: 11px;
}

.project-confirm-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.project-confirm-card__btn {
  min-height: 30px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.project-confirm-card__btn.primary {
  border-color: var(--primary-color, #165dff);
  background: var(--primary-color, #165dff);
  color: #fff;
}

.project-confirm-card__btn:hover {
  filter: brightness(0.98);
}

.project-handoff-row {
  margin-top: 8px;
}

.project-handoff-link {
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--primary-color, #165dff);
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.project-handoff-link:hover {
  background: var(--bg-hover);
}

.message-row-wrapper.is-located {
  animation: located-message-pulse 1.6s ease;
}

@keyframes located-message-pulse {
  0% { background-color: rgba(22, 93, 255, 0.16); }
  100% { background-color: transparent; }
}

.history-spacer {
  flex: 0 0 auto;
  pointer-events: none;
}

.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.msg-row.is-me {
  flex-direction: row-reverse;
}

.msg-avatar {
  margin-top: 4px;
  flex-shrink: 0;
}

.msg-bubble-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  max-width: min(70%, 720px);
  overflow-wrap: anywhere;
}

.msg-row.is-me .msg-bubble-container {
  align-items: flex-end;
}

.user-name-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 4px;
  margin-bottom: 2px;
}

.sys-msg-row {
  width: 100%;
  display: flex;
  justify-content: center;
}

/* Quote Reference */
.quote-reference-box {
  background-color: var(--bg-secondary);
  border-left: 2px solid var(--primary-color, #165dff);
  padding: 4px 8px;
  border-radius: 2px;
  font-size: 11px;
  max-width: 100%;
  display: flex;
  gap: 4px;
  margin-bottom: 2px;
}

.quote-reference-box.is-me {
  border-left: none;
  border-right: 2px solid var(--primary-color, #165dff);
}

.quote-author {
  font-weight: 500;
  color: var(--text-secondary);
}

.quote-text {
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Reactions Bar */
.reactions-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.reaction-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.1s, background-color 0.2s;
}

.reaction-badge:hover {
  background-color: var(--bg-hover);
  transform: scale(1.05);
}

.reaction-emoji {
  font-size: 12px;
}

.reaction-count {
  color: var(--text-secondary);
  font-weight: 500;
}

</style>
