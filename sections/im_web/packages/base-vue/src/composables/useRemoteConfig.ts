import { ref } from 'vue';
import { apiClient } from '../service/APIClient';
import { Const } from '../service/Const';

interface RemoteConfig {
  revoke_second: number;
  feature_visibility: Record<string, boolean>;
  chat_background: string;
  update_prompt: {
    enabled: boolean;
    version: string;
    message: string;
    url: string;
  };
  workplace_apps: Array<{
    id: string;
    name: string;
    category: string;
    route?: string;
    url?: string;
    icon?: string;
    order: number;
    enabled: boolean;
  }>;
  [key: string]: any;
}

const remoteConfig = ref<RemoteConfig>({
  revoke_second: Const.defaultRevokeSecond,
  feature_visibility: {
    workplace: true,
    robot: false,
    report: true
  },
  chat_background: '',
  update_prompt: {
    enabled: false,
    version: '',
    message: '',
    url: ''
  },
  workplace_apps: []
});

let isFetched = false;

export function normalizeRemoteConfig(input: any): RemoteConfig {
  const config = input || {};
  return {
    ...config,
    revoke_second: Number(config.revoke_second || Const.defaultRevokeSecond),
    feature_visibility: {
      workplace: config.feature_visibility?.workplace !== false,
      robot: config.feature_visibility?.robot === true,
      report: config.feature_visibility?.report !== false,
      ...(config.feature_visibility || {})
    },
    chat_background: String(config.chat_background || ''),
    update_prompt: {
      enabled: Boolean(config.update_prompt?.enabled),
      version: String(config.update_prompt?.version || ''),
      message: String(config.update_prompt?.message || ''),
      url: String(config.update_prompt?.url || '')
    },
    workplace_apps: Array.isArray(config.workplace_apps)
      ? config.workplace_apps.map((app: any, index: number) => ({
        id: String(app.id || app.app_id || `app-${index}`),
        name: String(app.name || app.title || '未命名应用'),
        category: String(app.category || '常用'),
        route: app.route,
        url: app.url,
        icon: app.icon,
        order: Number(app.order ?? index),
        enabled: app.enabled !== false
      }))
      : []
  };
}

export function useRemoteConfig() {
  const fetchRemoteConfig = async () => {
    if (isFetched) return remoteConfig.value;
    try {
      const res: any = await apiClient.get('/common/appconfig');
      remoteConfig.value = normalizeRemoteConfig(res);
      isFetched = true;
    } catch (e) {
      console.warn('Failed to fetch remote config, using default', e);
    }
    return remoteConfig.value;
  };

  return {
    remoteConfig,
    fetchRemoteConfig
  };
}
