import { defineStore } from 'pinia';
import { ref } from 'vue';
import WKSDK, { ConnectStatus } from 'wukongimjssdk';
import { apiClient } from '@tsdaodao/base-vue';
import { registerCMDListeners, registerMessageListeners } from '../cmd';
import { registerMessageContentTypes } from '../contentTypes';

export const useSdkStore = defineStore('sdk', () => {
  const isConnected = ref(false);
  const isKickedOut = ref(false);
  const connectionStatus = ref<ConnectStatus>(ConnectStatus.Disconnect);

  let reconnectAttempts = 0;
  let reconnectTimer: any = null;
  let initializedUid = '';
  let initializedToken = '';

  function handleDisconnectAndReconnect() {
    if (connectionStatus.value === ConnectStatus.Connected) {
      return;
    }
    isConnected.value = false;

    if (isKickedOut.value) return;

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    console.log(`[SDK] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})...`);

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectAttempts++;
      WKSDK.shared().connect();
    }, delay);
  }

  // Flag to avoid double registration
  let isRegistered = false;

  function initializeSDK(uid: string, token: string) {
    if (initializedUid === uid && initializedToken === token && connectionStatus.value !== ConnectStatus.Disconnect) {
      return;
    }

    // Reset kickout state
    isKickedOut.value = false;
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
        cb(res.ws_addr || 'ws://100.79.157.76:5200');
      } catch (err) {
        console.error('[SDK] Failed to get connect address, falling back', err);
        cb('ws://100.79.157.76:5200');
      }
    };

    // Connection status listener
    WKSDK.shared().connectManager.addConnectStatusListener((status, reasonCode) => {
      connectionStatus.value = status;
      if (status === ConnectStatus.Connected) {
        isConnected.value = true;
        reconnectAttempts = 0;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        console.log('[SDK] Connected successfully.');
      } else {
        isConnected.value = false;

        if (status === ConnectStatus.ConnectKick || reasonCode === 2) {
          isKickedOut.value = true;
          console.warn('[SDK] Kicked out by server.');
        } else if (status === ConnectStatus.ConnectFail || status === ConnectStatus.Disconnect) {
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
    initializedUid = '';
    initializedToken = '';
  }

  return {
    isConnected,
    isKickedOut,
    connectionStatus,
    initializeSDK,
    disconnect
  };
});
