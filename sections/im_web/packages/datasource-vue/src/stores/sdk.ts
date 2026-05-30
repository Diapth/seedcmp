import { defineStore } from 'pinia';
import { ref } from 'vue';
import WKSDK, { ConnectStatus } from 'wukongimjssdk';
import { apiClient } from '@tsdaodao/base-vue';
import { registerCMDListeners, registerMessageListeners } from '../cmd';
import { registerMessageContentTypes } from '../contentTypes/index';
import { resolveWebsocketConnectAddr } from './sdkAddress';
import { useConversationStore } from './conversationStore';
import { useMessageStore } from './messageStore';

export const useSdkStore = defineStore('sdk', () => {
  const isConnected = ref(false);
  const isKickedOut = ref(false);
  const connectionStatus = ref<ConnectStatus>(ConnectStatus.Disconnect);
  const connectionState = ref<'connected' | 'connecting' | 'reconnecting' | 'offline' | 'kicked'>('offline');
  const recoveryState = ref<'idle' | 'syncing' | 'recovered' | 'failed'>('idle');
  const lastError = ref('');
  const lastRecoveredAt = ref(0);
  const reconnectAttemptCount = ref(0);

  let reconnectAttempts = 0;
  let reconnectTimer: any = null;
  let initializedUid = '';
  let initializedToken = '';

  function formatSdkError(err: any, fallback: string) {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    if (err instanceof Error && err.message) return err.message;
    const nested = err.error;
    const message = err.msg || err.message || nested?.msg || nested?.message;
    if (message && typeof message === 'string') return message;
    if (err.status) return `${fallback} (${err.status})`;
    return fallback;
  }

  function setConnectionState(state: typeof connectionState.value, error = '') {
    connectionState.value = state;
    lastError.value = error;
  }

  function markRecovered() {
    recoveryState.value = 'recovered';
    lastRecoveredAt.value = Date.now();
  }

  async function runRecoverySync() {
    recoveryState.value = 'syncing';
    try {
      const conversationStore = useConversationStore();
      const messageStore = useMessageStore();
      await conversationStore.recoverAfterReconnect();
      await messageStore.retryPendingQueue();
      markRecovered();
    } catch (err: any) {
      recoveryState.value = 'failed';
      lastError.value = formatSdkError(err, 'Recovery failed');
    }
  }

  function scheduleReconnect() {
    if (isKickedOut.value) return;
    setConnectionState(reconnectAttempts > 0 ? 'reconnecting' : 'offline');
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttemptCount.value = reconnectAttempts + 1;
    console.log(`[SDK] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})...`);

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectAttempts++;
      reconnectAttemptCount.value = reconnectAttempts;
      WKSDK.shared().connect();
    }, delay);
  }

  function handleDisconnectAndReconnect() {
    if (connectionStatus.value === ConnectStatus.Connected) {
      return;
    }
    isConnected.value = false;

    if (isKickedOut.value) return;
    scheduleReconnect();
  }

  // Flag to avoid double registration
  let isRegistered = false;

  function initializeSDK(uid: string, token: string) {
    if (initializedUid === uid && initializedToken === token && connectionStatus.value !== ConnectStatus.Disconnect) {
      return;
    }

    // Reset kickout state
    isKickedOut.value = false;
    setConnectionState('connecting');
    recoveryState.value = 'idle';
    initializedUid = uid;
    initializedToken = token;

    // Register listeners and content types once
    if (!isRegistered) {
      registerCMDListeners();
      registerMessageListeners();
      registerMessageContentTypes();
      isRegistered = true;
    }

    WKSDK.shared().config.uid = uid;
    WKSDK.shared().config.token = token;

    // Connection address callback
    WKSDK.shared().config.provider.connectAddrCallback = async (cb) => {
      try {
        const res: any = await apiClient.get(`users/${uid}/im`);
        cb(resolveWebsocketConnectAddr(res?.ws_addr));
      } catch (err) {
        console.error('[SDK] Failed to get connect address, falling back', err);
        lastError.value = formatSdkError(err, 'connect address failed');
        cb(resolveWebsocketConnectAddr(''));
      }
    };

    // Connection status listener
    WKSDK.shared().connectManager.addConnectStatusListener((status, reasonCode) => {
      connectionStatus.value = status;
      if (status === ConnectStatus.Connected) {
        isConnected.value = true;
        setConnectionState('connected');
        reconnectAttempts = 0;
        reconnectAttemptCount.value = 0;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        console.log('[SDK] Connected successfully.');
        void runRecoverySync();
      } else {
        isConnected.value = false;

        if (status === ConnectStatus.ConnectKick || reasonCode === 2) {
          isKickedOut.value = true;
          setConnectionState('kicked', 'Account was logged in elsewhere.');
          console.warn('[SDK] Kicked out by server.');
        } else if (status === ConnectStatus.ConnectFail || status === ConnectStatus.Disconnect) {
          setConnectionState('offline');
          if (!isKickedOut.value) {
            handleDisconnectAndReconnect();
          }
        }
      }
    });

    // Initial connect
    WKSDK.shared().connect();
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    WKSDK.shared().disconnect();
    isConnected.value = false;
    setConnectionState('offline');
    recoveryState.value = 'idle';
    initializedUid = '';
    initializedToken = '';
  }

  return {
    isConnected,
    isKickedOut,
    connectionStatus,
    connectionState,
    recoveryState,
    lastError,
    lastRecoveredAt,
    reconnectAttemptCount,
    initializeSDK,
    setConnectionState,
    scheduleReconnect,
    markRecovered,
    runRecoverySync,
    disconnect
  };
});
