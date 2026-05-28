import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { StorageService } from '@tsdaodao/base-vue';

export interface RobotConfig {
  id: string;
  name: string;
  provider: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'custom-robot-configs';

function now() {
  return Date.now();
}

function createRobotId() {
  return `robot-${now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function readConfigs(): RobotConfig[] {
  const raw = StorageService.get(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistConfigs(configs: RobotConfig[]) {
  StorageService.set(STORAGE_KEY, JSON.stringify(configs));
}

export const useRobotConfigStore = defineStore('robotConfig', () => {
  const configs = ref<RobotConfig[]>(readConfigs());
  const enabledConfigs = computed(() => configs.value.filter(item => item.enabled));

  function upsertConfig(input: Partial<RobotConfig>) {
    const timestamp = now();
    const id = input.id || createRobotId();
    const existingIndex = configs.value.findIndex(item => item.id === id);
    const nextConfig: RobotConfig = {
      id,
      name: String(input.name || 'AI 机器人').trim(),
      provider: String(input.provider || 'openai-compatible').trim(),
      apiUrl: String(input.apiUrl || '').trim(),
      apiKey: String(input.apiKey || '').trim(),
      model: String(input.model || '').trim(),
      prompt: String(input.prompt || '').trim(),
      enabled: input.enabled !== false,
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp
    };

    if (existingIndex >= 0) {
      configs.value[existingIndex] = {
        ...configs.value[existingIndex],
        ...nextConfig,
        createdAt: configs.value[existingIndex].createdAt
      };
    } else {
      configs.value.unshift(nextConfig);
    }
    persistConfigs(configs.value);
    return nextConfig;
  }

  function removeConfig(id: string) {
    configs.value = configs.value.filter(item => item.id !== id);
    persistConfigs(configs.value);
  }

  function setEnabled(id: string, enabled: boolean) {
    const target = configs.value.find(item => item.id === id);
    if (!target) return;
    target.enabled = enabled;
    target.updatedAt = now();
    persistConfigs(configs.value);
  }

  function hydrate() {
    configs.value = readConfigs();
  }

  hydrate();

  return {
    configs,
    enabledConfigs,
    hydrate,
    upsertConfig,
    removeConfig,
    setEnabled
  };
});
