<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { Message as ArcoMessage } from '@arco-design/web-vue';
import {
  buildClowderCatContactId,
  commonApi,
  getClowderCatIdFromContactId,
  isClowderAiContactId,
  isClowderCatContactId,
  useMessageStore,
  useConversationStore,
  useGroupStore,
  useUserStore,
  useClowderStore
} from '@tsdaodao/datasource-vue';
import { useRobotConfigStore } from '@tsdaodao/contacts-vue';
import WKSDK, { CMDContent } from 'wukongimjssdk';
import { getClowderCatDisplayNameFromPayload } from '@tsdaodao/base-vue/utils/clowderMessageIdentity';
import { resolveGroupCatAutoReplyTrigger, type GroupCatAutoReplyReason } from '../utils/clowderGroupAutoReplyPolicy';
import { detectDeploymentIntent, type DeploymentIntent } from '../utils/deploymentIntent';

const props = defineProps<{
  channelId: string;
  channelType: number;
  mentionRequest?: {
    uid: string;
    name: string;
    requestId: number;
  } | null;
}>();

const messageStore = useMessageStore();
const conversationStore = useConversationStore();
const groupStore = useGroupStore();
const userStore = useUserStore();
const clowderStore = useClowderStore();
const robotConfigStore = useRobotConfigStore();

const inputText = ref('');
const lastAppliedDraft = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadHint = ref('');
const robotMenuState = ref<'idle' | 'loading' | 'ready' | 'unavailable' | 'failed'>('idle');
const robotMenus = ref<Array<{ id: string; title: string; command: string; robotId: string }>>([]);
const robotAck = ref('');
const aiState = ref<'idle' | 'loading' | 'failed'>('idle');
const sendingState = ref<'idle' | 'sending'>('idle');
const voiceState = ref<'idle' | 'recording' | 'sending' | 'unsupported'>('idle');
const voiceDuration = ref(0);
let typingTimeout: any = null;
let voiceRecorder: MediaRecorder | null = null;
let voiceStream: MediaStream | null = null;
let voiceChunks: Blob[] = [];
let voiceTimer: number | undefined;
let aiAbortController: AbortController | null = null;
let clowderSyncTimers: number[] = [];
const SYSTEM_ROBOT_ID = 'u_10000';
const DEEPSEEK_AI_ROBOT_ID = 'deepseek_ai_robot';
const CLOWDER_AI_ROBOT_ID = 'clowder_ai';
const CLOWDER_COORDINATOR_CAT_ID = 'coordinator';

// Mention state
const showMentionPopup = ref(false);
const mentionQuery = ref('');
const mentionedUids = ref<string[]>([]);
let suppressMentionPopupOnce = false;

// Reply targetcomputed fields
const replyUser = computed(() => {
  const target = messageStore.replyTarget;
  if (!target) return '';
  return getMessageSenderName(target);
});

const replyDigest = computed(() => {
  const target = messageStore.replyTarget;
  if (!target) return '';
  return target.content?.text || '[消息]';
});

const activeRobotConfig = computed(() => robotConfigStore.enabledConfigs[0]);
const isAiRobotConversation = computed(() => {
  return props.channelType === 1 &&
    props.channelId === DEEPSEEK_AI_ROBOT_ID;
});

const isClowderAiConversation = computed(() => {
  return props.channelType === 1 &&
    isClowderAiContactId(props.channelId);
});

const isClowderCatConversation = computed(() => {
  return props.channelType === 1 && isClowderCatContactId(props.channelId);
});

const activeConversationDraft = computed(() => {
  const conv = conversationStore.conversations.find(
    c => c.channel_id === props.channelId && c.channel_type === props.channelType
  );
  return conv?.draft || '';
});

// Group members list
const currentGroupMembers = computed(() => {
  return groupStore.groupMembers[props.channelId] || [];
});

const catMentionMembers = computed(() => {
  const cats = clowderStore.groupCatMemberships[props.channelId] || [];
  const sourceCats = cats.length ? cats : inferCatMentionMembersFromRecentMessages();
  return sourceCats.map(cat => ({
    uid: cat.id,
    member_uid: cat.id,
    name: cat.displayName,
    display_name: cat.displayName,
    role_label: '猫猫',
    catContact: cat
  }));
});

const clowderPromptContext = computed(() => {
  return props.channelType === 2 ? clowderStore.groupPrompts[props.channelId] : undefined;
});

const clowderConversationKey = computed(() => `${props.channelId}-${Number(props.channelType)}`);

const groupAutoReplyMode = computed(() => {
  if (props.channelType !== 2) return 'mentions_only';
  return clowderStore.groupAutoReplyModes[props.channelId] || 'soft_mentions';
});

function getMemberUid(member: any): string {
  return String(member?.catContact?.id || member?.member_uid || member?.uid || '');
}

function getMemberDisplayName(member: any): string {
  return String(member?.catContact?.displayName || member?.display_name || member?.member_name || member?.name || getMemberUid(member));
}

function normalizeCatLookupToken(value: string) {
  return String(value || '').replace(/^@/, '').replace(/[🐱🐈🐾\s]+$/g, '').trim().toLowerCase();
}

function findCatContactByDisplayName(displayName: string) {
  const lookup = normalizeCatLookupToken(displayName);
  if (!lookup) return undefined;
  const directory = [
    ...(clowderStore.groupCatMemberships[props.channelId] || []),
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

function inferCatMentionMembersFromRecentMessages() {
  if (props.channelType !== 2) return [];
  const seen = new Set<string>();
  return messageStore.getChannelMessages(props.channelId, props.channelType)
    .slice(-30)
    .reverse()
    .map(message => {
      const content = message?.content || (message as any)?.payload || {};
      const displayName = getClowderCatDisplayNameFromPayload(content);
      const matched = findCatContactByDisplayName(displayName);
      const catId = String(content.catId || content.cat_id || matched?.catId || normalizeCatLookupToken(displayName)).trim();
      if (!catId || !displayName || seen.has(catId)) return undefined;
      seen.add(catId);
      if (matched) return matched;
      return {
        id: buildClowderCatContactId(catId),
        uid: buildClowderCatContactId(catId),
        catId,
        displayName,
        name: displayName,
        avatar: String(content.avatar || content.catAvatar || content.cat_avatar || ''),
        aliases: [displayName],
        mentionNames: [`@${displayName}`, displayName],
        personalitySummary: '',
        capabilitySummary: '',
        available: true,
        availabilityState: 'available' as const,
        source: 'existing' as const,
        connected: true
      };
    })
    .filter(Boolean) as any[];
}

const filteredMentionTargets = computed(() => {
  const query = mentionQuery.value.toLowerCase();
  const targets = [
    ...currentGroupMembers.value,
    ...catMentionMembers.value
  ];
  if (!query) return targets;
  return targets.filter(m => 
    getMemberDisplayName(m).toLowerCase().includes(query) ||
    getMemberUid(m).toLowerCase().includes(query)
  );
});

async function ensureGroupMentionMembersLoaded() {
  if (props.channelType !== 2 || !props.channelId) return;
  const tasks: Promise<unknown>[] = [];
  if (currentGroupMembers.value.length === 0) {
    tasks.push(groupStore.fetchGroupMembers(props.channelId));
  }
  tasks.push(clowderStore.loadGroupCats(props.channelId).catch(() => undefined));
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

watch(() => props.channelId, (newId) => {
  lastAppliedDraft.value = activeConversationDraft.value;
  inputText.value = lastAppliedDraft.value;
  messageStore.setReplyTarget(null);
  showMentionPopup.value = false;
  if (props.channelType === 2 && newId) {
    void ensureGroupMentionMembersLoaded();
  }
}, { immediate: true });

watch(activeConversationDraft, (draft) => {
  if (inputText.value === '' || inputText.value === lastAppliedDraft.value) {
    inputText.value = draft;
    lastAppliedDraft.value = draft;
  }
});

watch(inputText, (newVal) => {
  conversationStore.updateDraft(props.channelId, props.channelType, newVal);
  triggerTyping();

  if (props.channelType !== 2) return;
  if (suppressMentionPopupOnce) {
    suppressMentionPopupOnce = false;
    showMentionPopup.value = false;
    mentionQuery.value = '';
    return;
  }

  const selectionStart = textareaRef.value?.selectionStart;
  const caretPos = typeof selectionStart === 'number'
    ? (selectionStart > 0 ? selectionStart : newVal.length)
    : newVal.length;
  const mentionToken = findActiveMentionToken(newVal, caretPos);

  if (mentionToken) {
    showMentionPopup.value = true;
    mentionQuery.value = mentionToken.query;
    void ensureGroupMentionMembersLoaded();
    return;
  }
  showMentionPopup.value = false;
});

function findActiveMentionToken(text: string, caretPos: number) {
  const safeCaret = Math.max(0, Math.min(caretPos, text.length));
  const textBeforeCaret = text.substring(0, safeCaret);
  const lastAtIdx = textBeforeCaret.lastIndexOf('@');
  if (lastAtIdx === -1) return null;
  const query = textBeforeCaret.substring(lastAtIdx + 1);
  if (/[\s@]/.test(query)) return null;
  return {
    start: lastAtIdx,
    query
  };
}

function triggerTyping() {
  if (typingTimeout) return;
  
  typingTimeout = setTimeout(() => {
    typingTimeout = null;
  }, 2000);

  const channel = WKSDK.shared().newChannel(props.channelId, props.channelType);
  const cmdContent = new CMDContent();
  cmdContent.cmd = 'typing';
  cmdContent.param = {};
  WKSDK.shared().chatManager.send(cmdContent, channel);
}

function selectMember(member: any) {
  const caretPos = textareaRef.value?.selectionStart || 0;
  const mentionToken = findActiveMentionToken(inputText.value, caretPos);
  if (!mentionToken) {
    showMentionPopup.value = false;
    mentionQuery.value = '';
    textareaRef.value?.focus();
    return;
  }
  const textBeforeMention = inputText.value.substring(0, mentionToken.start);
  const textAfterCaret = inputText.value.substring(caretPos);
  const uid = getMemberUid(member);
  const name = getMemberDisplayName(member);
  const insertedMention = `@${name} `;
  const newText = textBeforeMention + insertedMention + textAfterCaret;
  const nextCaretPos = textBeforeMention.length + insertedMention.length;
  suppressMentionPopupOnce = true;
  inputText.value = newText;
  if (uid && !mentionedUids.value.includes(uid)) {
    mentionedUids.value.push(uid);
  }
  showMentionPopup.value = false;
  mentionQuery.value = '';
  void nextTick(() => {
    textareaRef.value?.setSelectionRange(nextCaretPos, nextCaretPos);
    showMentionPopup.value = false;
    mentionQuery.value = '';
  });
  textareaRef.value?.focus();
}

async function appendExternalMention(request?: { uid: string; name: string } | null) {
  if (!request?.uid || props.channelType !== 2) return;
  const name = request.name || request.uid;
  const mention = `@${name} `;
  const current = inputText.value;
  const start = textareaRef.value?.selectionStart ?? current.length;
  const end = textareaRef.value?.selectionEnd ?? start;
  const needsLeadingSpace = start > 0 && !/\s$/.test(current.slice(0, start));
  const nextMention = `${needsLeadingSpace ? ' ' : ''}${mention}`;
  inputText.value = `${current.slice(0, start)}${nextMention}${current.slice(end)}`;
  if (!mentionedUids.value.includes(request.uid)) {
    mentionedUids.value.push(request.uid);
  }
  await nextTick();
  const nextCaret = start + nextMention.length;
  textareaRef.value?.setSelectionRange(nextCaret, nextCaret);
  textareaRef.value?.focus();
}

watch(
  () => props.mentionRequest?.requestId,
  () => {
    if (props.mentionRequest) {
      void appendExternalMention(props.mentionRequest);
    }
  }
);

function getMentionedTargetCatIds(text: string) {
  return catMentionMembers.value
    .filter(member => {
      const cat = member.catContact;
      if (!cat) return false;
      const names = [cat.displayName, ...cat.aliases, ...cat.mentionNames]
        .filter(Boolean)
        .map(name => String(name).startsWith('@') ? String(name) : `@${name}`);
      return names.some(name => text.includes(name));
    })
    .map(member => member.catContact.catId);
}

function normalizeCatTargetToken(value: string) {
  return String(value || '').replace(/^@/, '').trim().toLowerCase();
}

function matchesCatTargetToken(candidate: string, lookup: string) {
  const token = normalizeCatTargetToken(candidate);
  if (!token || !lookup) return false;
  return token === lookup || token.startsWith(`${lookup}-`) || lookup.startsWith(`${token}-`);
}

function getCommandTargetCatIds(text: string) {
  const match = text.match(/^\/(ask|focus)\s+([^\s]+)/i);
  const lookup = normalizeCatTargetToken(match?.[2] || '');
  if (!lookup) return [];
  return catMentionMembers.value
    .filter(member => {
      const cat = member.catContact;
      if (!cat) return false;
      const tokens = [cat.catId, cat.displayName, ...cat.aliases, ...cat.mentionNames];
      return tokens.some(token => matchesCatTargetToken(token, lookup));
    })
    .map(member => member.catContact.catId);
}

function getMessageVisibleText(message: any) {
  const content = message?.content || message?.payload || {};
  const text = content.text || content.content || content.name || content.fileName || content.url || '';
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getMessageSenderName(message: any) {
  const content = message?.content || message?.payload || {};
  const clowderName = getClowderCatDisplayNameFromPayload(content);
  if (clowderName) return clowderName;
  const fromUID = String(message?.fromUID || '');
  if (fromUID === userStore.currentUser?.uid) {
    return userStore.currentUser?.name || fromUID;
  }
  return userStore.userCache[fromUID]?.name || fromUID || 'unknown';
}

function getReplyTargetCatId(message: any) {
  const content = message?.content || message?.payload || {};
  const metadata = content.metadata || {};
  const explicit = String(
    content.catId ||
    content.cat_id ||
    content.agentId ||
    content.agent_id ||
    metadata.catId ||
    metadata.cat_id ||
    metadata.agentId ||
    metadata.agent_id ||
    ''
  ).trim();
  if (explicit) return explicit;

  const fromUID = String(message?.fromUID || message?.from_uid || message?.from || '').trim();
  if (fromUID.startsWith('clowder_cat:')) return fromUID.slice('clowder_cat:'.length);
  if (fromUID.startsWith('clowder_cat_')) return fromUID.slice('clowder_cat_'.length);
  if (fromUID.startsWith('clowder:')) return fromUID.slice('clowder:'.length);

  const displayName = getClowderCatDisplayNameFromPayload(content);
  return findCatContactByDisplayName(displayName)?.catId || '';
}

function getReplyTargetType(message: any, targetCatId: string) {
  const content = message?.content || message?.payload || {};
  const displayName = getClowderCatDisplayNameFromPayload(content);
  const normalizedCatId = targetCatId.trim().toLowerCase();
  const normalizedName = displayName.trim().toLowerCase();
  if (normalizedCatId === CLOWDER_COORDINATOR_CAT_ID || normalizedName === '协调者' || normalizedName === 'pm') {
    return 'coordinator';
  }
  return targetCatId || isGroupCatMessage(message) ? 'cat' : '';
}

function buildReplyPayload(target: any) {
  const targetCatId = getReplyTargetCatId(target);
  const targetType = getReplyTargetType(target, targetCatId);
  return {
    messageID: target.messageID,
    messageSeq: target.messageSeq,
    conversationId: props.channelId,
    conversationType: props.channelType,
    fromUID: target.fromUID,
    fromName: getMessageSenderName(target),
    content: target.content,
    text: getMessageVisibleText(target),
    targetCatId: targetCatId || undefined,
    targetAgentId: targetCatId || undefined,
    targetType: targetType || undefined
  };
}

function buildReplyPromptLines(replyTarget?: any) {
  if (!replyTarget) return [];
  const reply = buildReplyPayload(replyTarget);
  return [
    'Reply reference:',
    `- quotedMessageId: ${reply.messageID || 'unknown'}`,
    `- quotedMessageSeq: ${reply.messageSeq || 0}`,
    `- quotedAuthor: ${reply.fromName || reply.fromUID || 'unknown'} (${reply.fromUID || 'unknown'})`,
    `- quotedText: ${reply.text || '[消息]'}`,
    `- quotedTargetType: ${reply.targetType || 'human'}`,
    `- quotedTargetCatId: ${reply.targetCatId || 'none'}`
  ];
}

function isSameReplyTarget(a: any, b: any) {
  if (!a || !b) return false;
  const aKey = String(a.clientMsgNo || a.messageID || `${a.messageSeq || ''}:${a.fromUID || ''}`);
  const bKey = String(b.clientMsgNo || b.messageID || `${b.messageSeq || ''}:${b.fromUID || ''}`);
  return aKey === bKey;
}

function isGroupCatMessage(message: any) {
  const content = message?.content || message?.payload || {};
  return String(content.connectorId || content.connector_id || '') === 'im-web' ||
    Boolean(content.catId || content.cat_id || content.catDisplayName || content.cat_display_name);
}

function buildRecentAutoReplyMessages() {
  if (props.channelType !== 2) return [];
  return messageStore.getChannelMessages(props.channelId, props.channelType)
    .filter(message => getMessageVisibleText(message))
    .slice(-12)
    .map(message => {
      const content = message?.content || (message as any)?.payload || {};
      return {
        text: getMessageVisibleText(message),
        content,
        fromCat: isGroupCatMessage(message),
        catId: String(content.catId || content.cat_id || '')
      };
    });
}

function buildClowderPromptContext(text: string, targetCatIds: string[], triggerReason?: GroupCatAutoReplyReason, replyTarget?: any) {
  if (props.channelType !== 2) return clowderPromptContext.value;
  const recentMessages = messageStore.getChannelMessages(props.channelId, props.channelType)
    .filter(message => getMessageVisibleText(message))
    .slice(-12)
    .map(message => `- ${getMessageSenderName(message)}: ${getMessageVisibleText(message)}`);
  const replyLines = buildReplyPromptLines(replyTarget);
  const base = clowderPromptContext.value || `Group: ${props.channelId} (id: ${props.channelId})`;
  return [
    base,
    `Mention target cat ids: ${targetCatIds.length ? targetCatIds.join(', ') : 'none'}`,
    `Trigger reason: ${triggerReason || 'manual'}`,
    `Current message: ${text}`,
    ...(replyLines.length ? replyLines : []),
    'Recent messages:',
    ...(recentMessages.length ? recentMessages : ['- No recent messages available.'])
  ].join('\n');
}

function getCatDisplayName(catId: string) {
  if (!catId) return '';
  const groupCat = (clowderStore.groupCatMemberships[props.channelId] || [])
    .find(cat => cat.catId === catId || cat.id === catId);
  if (groupCat?.displayName) return groupCat.displayName;
  const direct = clowderStore.getCatContactById(props.channelId);
  return direct?.displayName || catId;
}

function addDeploymentConfirmationCard(
  intent: DeploymentIntent,
  text: string,
  targetCatIds: string[],
  triggerReason?: GroupCatAutoReplyReason,
  replyTarget?: any
) {
  const directCatId = getClowderCatIdFromContactId(props.channelId);
  const effectiveTargetCatIds = targetCatIds.length ? targetCatIds : (directCatId ? [directCatId] : []);
  const firstCatId = effectiveTargetCatIds[0] || '';
  const catDisplayName = getCatDisplayName(firstCatId) || 'Clowder';
  const clientMsgNo = `deployment-card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  messageStore.addMessage(props.channelId, props.channelType, {
    messageID: clientMsgNo,
    messageSeq: 0,
    clientMsgNo,
    fromUID: props.channelType === 2 ? (userStore.currentUser?.uid || CLOWDER_AI_ROBOT_ID) : CLOWDER_AI_ROBOT_ID,
    timestamp: Math.floor(Date.now() / 1000),
    content: {
      type: 7,
      cardType: 'deployment',
      title: '确认部署',
      target: intent.target,
      environment: intent.environment,
      status: 'pending_confirmation',
      connectorId: 'im-web',
      catId: firstCatId,
      catDisplayName,
      deploymentRequest: {
        text,
        targetCatIds: effectiveTargetCatIds,
        triggerReason,
        promptContext: buildClowderPromptContext(text, effectiveTargetCatIds, triggerReason, replyTarget)
      }
    },
    isRevoked: false,
    status: 'success'
  }, { countUnread: false });
}

function openImagePicker() {
  imageInputRef.value?.click();
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function createVoiceFile(blob: Blob) {
  const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  return new File([blob], `voice-${Date.now()}.${extension}`, {
    type: blob.type || 'audio/webm'
  });
}

function cleanupVoiceRecording() {
  if (voiceTimer) {
    window.clearInterval(voiceTimer);
    voiceTimer = undefined;
  }
  voiceStream?.getTracks().forEach(track => track.stop());
  voiceStream = null;
  voiceRecorder = null;
  voiceChunks = [];
}

function clearClowderConversationSyncTimers() {
  for (const timer of clowderSyncTimers) window.clearTimeout(timer);
  clowderSyncTimers = [];
}

function scheduleClowderConversationSync(channelId: string, channelType: number) {
  clearClowderConversationSyncTimers();
  const delays = [750, 2500, 10000, 30000, 90000, 180000, 300000];
  clowderSyncTimers = delays.map((delay) =>
    window.setTimeout(() => {
      void messageStore.syncMessages(channelId, channelType, { hydrateVisibleHistory: true });
    }, delay),
  );
}

async function sendClowderRouteMessage(text: string, targetCatIds: string[], triggerReason?: GroupCatAutoReplyReason, replyTarget?: any) {
  await clowderStore.sendConversationMessage({
    channelId: props.channelId,
    channelType: props.channelType as 1 | 2,
    directCatId: getClowderCatIdFromContactId(props.channelId),
    targetCatIds,
    promptContext: buildClowderPromptContext(text, targetCatIds, triggerReason, replyTarget)
  }, text);
  scheduleClowderConversationSync(props.channelId, props.channelType);
}

async function startVoiceRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    voiceState.value = 'unsupported';
    ArcoMessage.warning('当前浏览器不支持语音录制');
    return;
  }
  if (voiceState.value === 'recording') return;
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    voiceDuration.value = 0;
    voiceRecorder = new MediaRecorder(voiceStream);
    voiceRecorder.addEventListener('dataavailable', event => {
      if (event.data.size > 0) voiceChunks.push(event.data);
    });
    voiceRecorder.start();
    voiceState.value = 'recording';
    voiceTimer = window.setInterval(() => {
      voiceDuration.value += 1;
    }, 1000);
  } catch (err) {
    cleanupVoiceRecording();
    voiceState.value = 'idle';
    ArcoMessage.error('无法开始录音，请检查麦克风权限');
  }
}

async function stopVoiceRecording() {
  if (!voiceRecorder || voiceState.value !== 'recording') return;
  const recorder = voiceRecorder;
  const finalDuration = Math.max(1, voiceDuration.value);
  voiceState.value = 'sending';
  await new Promise<void>((resolve) => {
    recorder.addEventListener('stop', () => resolve(), { once: true });
    recorder.stop();
  });
  const blob = new Blob(voiceChunks, { type: recorder.mimeType || 'audio/webm' });
  cleanupVoiceRecording();
  try {
    await messageStore.sendVoiceMessage(props.channelId, props.channelType, createVoiceFile(blob), finalDuration);
    ArcoMessage.success('语音已发送');
  } catch (err) {
    console.error('Failed to send voice message', err);
    ArcoMessage.error('语音发送失败，请稍后重试');
  } finally {
    voiceState.value = 'idle';
    voiceDuration.value = 0;
  }
}

function cancelVoiceRecording() {
  if (voiceRecorder && voiceState.value === 'recording') {
    voiceRecorder.stop();
  }
  cleanupVoiceRecording();
  voiceState.value = 'idle';
  voiceDuration.value = 0;
}

function buildAiHistory() {
  return messageStore.getChannelMessages(props.channelId, props.channelType)
    .filter(item => item.content?.type === 1 && (item.content?.text || item.content?.content))
    .slice(-8)
    .map(item => ({
      role: item.fromUID === DEEPSEEK_AI_ROBOT_ID ? 'assistant' as const : 'user' as const,
      content: String(item.content?.text || item.content?.content || '')
    }));
}

function createAiReplyMessage(text = '') {
  const clientMsgNo = `ai-stream-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  messageStore.addMessage(props.channelId, props.channelType, {
    messageID: clientMsgNo,
    messageSeq: 0,
    clientMsgNo,
    fromUID: DEEPSEEK_AI_ROBOT_ID,
    timestamp: Math.floor(Date.now() / 1000),
    content: {
      type: 1,
      text,
      content: text,
      format: 'markdown',
      markdown: true,
      ai: true,
      streaming: true
    },
    isRevoked: false,
    status: 'sending'
  });
  return clientMsgNo;
}

function appendAiReplyStreamChunk(clientMsgNo: string, delta: string) {
  const existing = messageStore.getChannelMessages(props.channelId, props.channelType)
    .find(item => item.clientMsgNo === clientMsgNo);
  const current = String(existing?.content?.text || existing?.content?.content || '');
  const nextText = `${current}${delta}`;
  messageStore.updateMessageStatus(clientMsgNo, {
    content: {
      ...(existing?.content || {}),
      type: 1,
      text: nextText,
      content: nextText,
      format: 'markdown',
      markdown: true,
      ai: true,
      streaming: true
    },
    status: 'sending'
  });
}

async function sendAiAssistant(promptText?: string) {
  const prompt = (promptText ?? inputText.value).trim();
  if (!prompt || aiState.value === 'loading') return;

  aiState.value = 'loading';
  inputText.value = '';
  lastAppliedDraft.value = '';
  conversationStore.updateDraft(props.channelId, props.channelType, '');
  let aiMessageClientMsgNo = '';
  try {
    const history = buildAiHistory();
    await messageStore.sendMessage(props.channelId, props.channelType, prompt);
    const config = activeRobotConfig.value;
    aiMessageClientMsgNo = createAiReplyMessage('');
    aiAbortController = new AbortController();
    const finalEvent = await commonApi.requestAiReplyStream({
      channel_id: props.channelId,
      channel_type: props.channelType,
      prompt,
      system_prompt: config?.prompt || '',
      model: config?.model || 'deepseek-chat',
      history
    }, {
      signal: aiAbortController.signal,
      onDelta: delta => appendAiReplyStreamChunk(aiMessageClientMsgNo, delta)
    });
    const existing = messageStore.getChannelMessages(props.channelId, props.channelType)
      .find(item => item.clientMsgNo === aiMessageClientMsgNo);
    const finalText = String(existing?.content?.text || existing?.content?.content || 'AI 暂时没有返回内容。');
    if (Number(finalEvent?.message_id || 0) > 0) {
      messageStore.updateMessageStatus(aiMessageClientMsgNo, {
        messageID: String(finalEvent.message_id),
        messageSeq: Number(finalEvent?.message_seq || existing?.messageSeq || 0),
        timestamp: Number(finalEvent?.timestamp || existing?.timestamp || Math.floor(Date.now() / 1000)),
        content: {
          ...(existing?.content || {}),
          type: 1,
          text: finalText,
          content: finalText,
          format: 'markdown',
          markdown: true,
          ai: true,
          streaming: false
        },
        status: 'success'
      });
    } else {
      const persistedAiReply = messageStore.getChannelMessages(props.channelId, props.channelType)
        .find(item =>
          item.clientMsgNo !== aiMessageClientMsgNo &&
          item.fromUID === DEEPSEEK_AI_ROBOT_ID &&
          Number(item.messageSeq || 0) > 0 &&
          String(item.content?.text || item.content?.content || '') === finalText
        );
      if (persistedAiReply) {
        messageStore.removeMessageByClientMsgNo(aiMessageClientMsgNo);
      } else {
        messageStore.updateMessageStatus(aiMessageClientMsgNo, {
          messageID: existing?.messageID || aiMessageClientMsgNo,
          messageSeq: Number(existing?.messageSeq || 0),
          timestamp: Number(finalEvent?.timestamp || existing?.timestamp || Math.floor(Date.now() / 1000)),
          content: {
            ...(existing?.content || {}),
            type: 1,
            text: finalText,
            content: finalText,
            format: 'markdown',
            markdown: true,
            ai: true,
            streaming: false
          },
          status: 'success'
        });
      }
    }
    ArcoMessage.success('AI 已回复');
    aiState.value = 'idle';
  } catch (err) {
    console.error('Failed to request AI assistant', err);
    if (aiMessageClientMsgNo) {
      messageStore.updateMessageStatus(aiMessageClientMsgNo, {
        content: {
          type: 1,
          text: 'AI 助手暂不可用，请稍后重试。',
          content: 'AI 助手暂不可用，请稍后重试。',
          format: 'markdown',
          markdown: true,
          ai: true,
          streaming: false
        },
        status: 'fail',
        retryable: false
      });
    }
    aiState.value = 'failed';
    inputText.value = prompt;
    ArcoMessage.error('AI 助手暂不可用，请稍后重试');
  } finally {
    aiAbortController = null;
  }
}

async function insertMentionTrigger() {
  inputText.value = `${inputText.value}${inputText.value && !inputText.value.endsWith(' ') ? ' ' : ''}@`;
  await nextTick();
  const caretPos = inputText.value.length;
  textareaRef.value?.setSelectionRange(caretPos, caretPos);
  if (props.channelType === 2) {
    mentionQuery.value = '';
    showMentionPopup.value = true;
    void ensureGroupMentionMembersLoaded();
  }
  textareaRef.value?.focus();
}

async function openRobotMenu() {
  if (robotMenuState.value === 'ready') {
    robotMenuState.value = 'idle';
    return;
  }
  robotMenuState.value = 'loading';
  robotAck.value = '';
  try {
    const res: any = await commonApi.getRobotMenus(props.channelId, props.channelType);
    let robotId = props.channelId;
    let list = Array.isArray(res) ? (res[0]?.menus || res) : (res?.menus || res?.items || []);
    if (!list.length && props.channelId !== SYSTEM_ROBOT_ID) {
      const fallbackRes: any = await commonApi.getRobotMenus(SYSTEM_ROBOT_ID, 1);
      robotId = SYSTEM_ROBOT_ID;
      list = Array.isArray(fallbackRes) ? (fallbackRes[0]?.menus || fallbackRes) : (fallbackRes?.menus || fallbackRes?.items || []);
    }
    robotMenus.value = list.map((item: any, index: number) => ({
      id: String(item.id || item.cmd || item.command || index),
      title: String(item.title || item.remark || item.name || item.cmd || item.command || '机器人指令'),
      command: String(item.cmd || item.command || item.payload || item.name || ''),
      robotId: String(item.robot_id || item.robotId || robotId)
    })).filter((item: any) => item.command);
    robotMenuState.value = robotMenus.value.length ? 'ready' : 'unavailable';
  } catch {
    robotMenuState.value = 'unavailable';
  }
}

async function sendRobotCommand(command: string) {
  robotMenuState.value = 'loading';
  robotAck.value = '';
  const menu = robotMenus.value.find(item => item.command === command);
  const robotId = menu?.robotId || SYSTEM_ROBOT_ID;
  try {
    await messageStore.sendMessage(props.channelId, props.channelType, command, {
      robot: {
        robotId,
        command
      }
    });
    robotAck.value = 'robot ack';
    robotMenuState.value = 'idle';
    ArcoMessage.success('机器人指令已发送');
  } catch {
    robotMenuState.value = 'failed';
    robotAck.value = '机器人暂不可用';
  }
}

async function sendSelectedFile(file: File) {
  if (!file) return;
  try {
    uploadHint.value = file.type.startsWith('image/') ? `正在发送图片: ${file.name}` : `正在发送文件: ${file.name}`;
    await messageStore.sendMediaMessage(props.channelId, props.channelType, file);
    ArcoMessage.success(file.type.startsWith('image/') ? '图片已发送' : '文件已发送');
  } catch (err) {
    console.error('Failed to send selected file', err);
    ArcoMessage.error(file.type.startsWith('image/') ? '图片发送失败，请稍后重试' : '文件发送失败，请稍后重试');
  } finally {
    uploadHint.value = '';
  }
}

async function handleImageChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    await sendSelectedFile(file);
  }
  target.value = '';
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    await sendSelectedFile(file);
  }
  target.value = '';
}

async function handlePaste(event: ClipboardEvent) {
  const file = Array.from(event.clipboardData?.files || [])[0];
  if (!file) return;
  event.preventDefault();
  await sendSelectedFile(file);
}

async function handleDrop(event: DragEvent) {
  const file = Array.from(event.dataTransfer?.files || [])[0];
  if (!file) return;
  event.preventDefault();
  await sendSelectedFile(file);
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text) return;
  if (sendingState.value === 'sending') return;

  if (isAiRobotConversation.value) {
    await sendAiAssistant(text);
    return;
  }

  sendingState.value = 'sending';
  inputText.value = '';
  conversationStore.updateDraft(props.channelId, props.channelType, '');

  const options: any = {};
  const replyTargetSnapshot = messageStore.replyTarget;
  
  // Build Mention
  if (props.channelType === 2) {
    await ensureGroupMentionMembersLoaded();
  }
  const explicitTargetCatIds = Array.from(new Set(props.channelType === 2
    ? [...getMentionedTargetCatIds(text), ...getCommandTargetCatIds(text)]
    : []));
  const autoReplyDecision = resolveGroupCatAutoReplyTrigger({
    text,
    mode: groupAutoReplyMode.value,
    cats: props.channelType === 2 ? (clowderStore.groupCatMemberships[props.channelId] || []) : [],
    explicitTargetCatIds,
    defaultTargetCatId: props.channelType === 2 ? CLOWDER_COORDINATOR_CAT_ID : undefined,
    focusedCatId: clowderStore.conversations[clowderConversationKey.value]?.focusCatId,
    lastActiveCatId: clowderStore.agentDirectories[clowderConversationKey.value]?.lastActive?.catId,
    replyTarget: replyTargetSnapshot,
    recentMessages: buildRecentAutoReplyMessages()
  });
  const targetCatIds = autoReplyDecision.targetCatIds;
  const deploymentIntent = detectDeploymentIntent(text);
  const needsDeploymentConfirmation = deploymentIntent.shouldConfirm &&
    (isClowderAiConversation.value || isClowderCatConversation.value || autoReplyDecision.shouldRoute);

  if (props.channelType === 2) {
    if (text.includes('@所有人') || text.includes('@all')) {
      options.mention = { all: true, uids: [] };
    } else if (mentionedUids.value.length > 0) {
      const activeMentions = mentionedUids.value.filter(uid => !isClowderCatContactId(uid)).filter(uid => {
        const member = currentGroupMembers.value.find(m => getMemberUid(m) === uid);
        const name = member ? getMemberDisplayName(member) : uid;
        return text.includes(`@${name}`) || text.includes(`@${uid}`);
      });
      if (activeMentions.length > 0) {
        options.mention = { all: false, uids: activeMentions };
      }
    }
  }

  // Build Reply / Quote
  if (replyTargetSnapshot) {
    options.reply = buildReplyPayload(replyTargetSnapshot);
  }

  try {
    await messageStore.sendMessage(props.channelId, props.channelType, text, options);
    if (replyTargetSnapshot && isSameReplyTarget(messageStore.replyTarget, replyTargetSnapshot)) {
      messageStore.setReplyTarget(null);
    }
    mentionedUids.value = [];
    if (needsDeploymentConfirmation) {
      addDeploymentConfirmationCard(deploymentIntent, text, targetCatIds, autoReplyDecision.reason, replyTargetSnapshot);
    } else if (isClowderAiConversation.value || isClowderCatConversation.value || autoReplyDecision.shouldRoute) {
      await sendClowderRouteMessage(text, targetCatIds, autoReplyDecision.reason, replyTargetSnapshot);
    }
  } catch (err) {
    console.error('Failed to send message', err);
  } finally {
    sendingState.value = 'idle';
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.isComposing) return;
  if (e.key === 'Enter') {
    if (!e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
}

onBeforeUnmount(() => {
  if (typingTimeout) clearTimeout(typingTimeout);
  clearClowderConversationSyncTimers();
  aiAbortController?.abort();
  cleanupVoiceRecording();
});
</script>

<template>
  <div class="message-input-container">
    <!-- Mention Selector popup -->
    <div v-if="showMentionPopup && filteredMentionTargets.length > 0" class="mention-popup">
      <div 
        v-for="member in filteredMentionTargets" 
        :key="getMemberUid(member)" 
        class="mention-item"
        :class="{ 'is-clowder-cat': !!member.catContact }"
        @click="selectMember(member)"
      >
        <span class="mention-name">{{ getMemberDisplayName(member) }}</span>
        <span v-if="member.role_label !== '成员'" class="mention-role">{{ member.role_label }}</span>
      </div>
    </div>

    <!-- Reply target indicator bar -->
    <div v-if="messageStore.replyTarget" class="reply-preview-bar">
      <span class="reply-text">
        回复 {{ replyUser }}: {{ replyDigest }}
      </span>
      <button class="reply-close-btn" @click="messageStore.setReplyTarget(null)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="close-svg">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="input-actions">
      <button class="action-btn" title="机器人菜单" @click="openRobotMenu">
        Bot
      </button>
      <button
        v-if="!isAiRobotConversation"
        class="action-btn"
        :class="{ active: aiState === 'loading' }"
        :disabled="!inputText.trim() || aiState === 'loading'"
        title="AI 助手回复"
        @click="() => sendAiAssistant()"
      >
        AI
      </button>
      <button
        v-if="voiceState !== 'recording'"
        class="action-btn"
        :disabled="voiceState === 'sending'"
        title="开始录音"
        @click="startVoiceRecording"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-svg">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8" />
        </svg>
      </button>
      <div v-else class="voice-recording-bar">
        <span>录音中 {{ voiceDuration }}s</span>
        <button class="voice-mini-btn" @click="stopVoiceRecording">发送</button>
        <button class="voice-mini-btn" @click="cancelVoiceRecording">取消</button>
      </div>
      <button class="action-btn" title="选择图片" @click="openImagePicker">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-svg">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </button>
      <button class="action-btn" title="选择文件" @click="openFilePicker">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-svg">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </button>
      <button v-if="channelType === 2" class="action-btn" title="插入@成员" @click="insertMentionTrigger">
        @
      </button>
    </div>

    <div v-if="robotMenuState !== 'idle'" class="robot-panel">
      <div class="robot-panel-header">
        <span class="robot-panel-title">机器人菜单</span>
        <span v-if="robotMenuState === 'ready'" class="robot-panel-hint">点击菜单即可发送指令</span>
      </div>
      <div v-if="robotMenuState === 'loading'" class="robot-state">机器人响应中...</div>
      <div v-else-if="robotMenuState === 'unavailable' || robotMenuState === 'failed'" class="robot-state">
        <span class="robot-state-title">机器人未配置</span>
        <span>请在服务端机器人管理中配置后使用</span>
      </div>
      <template v-else>
        <div class="robot-menu">
          <button
            v-for="item in robotMenus"
            :key="item.id"
            class="robot-command"
            @click="sendRobotCommand(item.command)"
          >
            {{ item.title }}
          </button>
        </div>
      </template>
      <div v-if="robotAck" class="robot-ack">{{ robotAck }}</div>
    </div>

    <div v-if="isAiRobotConversation" class="robot-panel ai-contact-panel">
      <div class="robot-panel-header">
        <span class="robot-panel-title">DeepSeek AI</span>
        <span class="robot-panel-hint">发送消息后自动由 AI 回复</span>
      </div>
      <div class="robot-state">
        <span class="robot-state-title">AI 联系人已启用</span>
        <span>使用系统环境变量中的 DeepSeek Key，回复会按 Markdown 显示。</span>
      </div>
    </div>

    <div v-if="isClowderAiConversation" class="robot-panel clowder-contact-panel">
      <div class="robot-panel-header">
        <span class="robot-panel-title">Clowder AI</span>
        <span class="robot-panel-hint">消息会进入 Clowder 多智能体连接器</span>
      </div>
      <div class="robot-state">
        <span class="robot-state-title">Clowder 联系人已启用</span>
        <span>普通消息、@猫猫、/cats、/focus、/ask 等会由 TangSeng 桥接到 Clowder。</span>
      </div>
    </div>

    <div v-if="isClowderCatConversation" class="robot-panel clowder-contact-panel">
      <div class="robot-panel-header">
        <span class="robot-panel-title">Clowder 猫猫</span>
        <span class="robot-panel-hint">消息会发送给这个猫猫联系人</span>
      </div>
      <div class="robot-state">
        <span class="robot-state-title">猫猫直聊已启用</span>
        <span>回复会使用稳定猫猫身份，刷新历史后仍保留该联系人。</span>
      </div>
    </div>

    <div class="input-area-wrapper">
      <input
        ref="imageInputRef"
        type="file"
        accept="image/*"
        class="hidden-input"
        @change="handleImageChange"
      />
      <input
        ref="fileInputRef"
        type="file"
        class="hidden-input"
        @change="handleFileChange"
      />
      <textarea
        ref="textareaRef"
        v-model="inputText"
        placeholder="输入消息，Enter 发送，Ctrl+Enter 换行"
        class="input-textarea"
        rows="3"
        @keydown="handleKeyDown"
        @paste="handlePaste"
        @drop="handleDrop"
        @dragover.prevent
      ></textarea>
    </div>

    <div class="input-footer">
      <div class="input-hint">
        {{ uploadHint || (aiState === 'loading' ? 'AI 正在生成回复...' : voiceState === 'sending' ? '正在发送语音...' : '输入自动同步草稿，Enter 发送，Ctrl+Enter 换行') }}
      </div>
      <button 
        class="send-btn" 
        :disabled="!inputText.trim()"
        aria-label="发送消息"
        title="发送消息"
        @click="handleSend"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="send-btn-icon">
          <path d="M22 2 11 13" />
          <path d="m22 2-7 20-4-9-9-4 20-7Z" />
        </svg>
        <span class="send-btn-text">发送</span>
        <span class="send-btn-shortcut">Enter</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.message-input-container {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: var(--bg-primary);
  border-top: var(--border-hairline);
  padding: 12px 16px;
  position: relative;
  z-index: 30;
  /* In the grid layout this cell is 'auto' sized — content determines height.
     max-height caps it so robot-panel or reply-bar cannot push it too tall. */
  max-height: 40vh;
  overflow: visible;
}

/* Mention Popup */
.mention-popup {
  position: absolute;
  bottom: 100%;
  left: 16px;
  width: 200px;
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
  z-index: 3200;
  margin-bottom: 8px;
}

.mention-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mention-item:hover {
  background-color: var(--bg-hover);
}

.mention-item.is-clowder-cat .mention-role {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.1);
}

.mention-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-role {
  color: var(--text-secondary);
  font-size: 11px;
  flex-shrink: 0;
}

/* Reply Preview Bar */
.reply-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  margin-bottom: 10px;
  border-left: 3px solid var(--primary-color, #165dff);
}

.reply-text {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.reply-close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.reply-close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.close-svg {
  width: 14px;
  height: 14px;
}

.input-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.action-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-btn.active {
  background-color: rgba(22, 93, 255, 0.1);
  color: var(--primary-color, #165dff);
}

.action-svg {
  width: 20px;
  height: 20px;
}

.voice-recording-bar {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
}

.voice-mini-btn {
  height: 22px;
  padding: 0 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}

.robot-panel {
  margin-bottom: 8px;
  padding: 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.robot-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.robot-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.robot-panel-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.robot-state,
.robot-ack {
  font-size: 12px;
  color: var(--text-secondary);
}

.robot-state {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.robot-state-title {
  color: var(--text-primary);
  font-weight: 600;
}

.robot-menu {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.robot-command {
  height: 28px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.hidden-input {
  display: none;
}

.input-area-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.input-textarea {
  width: 100%;
  border: none;
  background: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  font-family: inherit;
  padding: 0;
}

.input-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
}

.input-hint {
  min-width: 0;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.send-btn {
  min-width: 116px;
  height: 36px;
  padding: 0 14px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.2s, transform 0.2s, background-color 0.2s;
}

.send-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.send-btn-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.send-btn-text {
  line-height: 1;
}

.send-btn-shortcut {
  font-size: 10px;
  line-height: 1;
  opacity: 0.78;
  padding-left: 2px;
}
</style>
