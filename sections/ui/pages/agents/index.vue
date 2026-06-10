<template>
  <AppShell>
    <!-- Mobile Page Header (PR-14) -->
    <MobilePageHeader
      v-if="!isDesktop"
      title="智能体"
      subtitle="管理并与 AI 协作"
    >
      <template #actions>
        <view class="header-icon-btn" @click="goBoard">
          <AppIcon name="briefcase" :size="20" color="var(--color-text-secondary)" />
        </view>
        <view class="header-icon-btn" @click="goSkills">
          <AppIcon name="bookmark" :size="20" color="var(--color-text-secondary)" />
        </view>
        <view class="header-icon-btn" @click="goCreate">
          <AppIcon name="plus" :size="20" color="var(--color-text-secondary)" />
        </view>
      </template>
    </MobilePageHeader>

    <view class="agents-page flex-column flex-1">
      <view class="agent-hero flex-row align-center justify-between" v-if="isDesktop">
        <view class="title-stack">
          <text class="title">智能体</text>
          <text class="subtitle">管理并与您的专属 AI 智能体协作</text>
        </view>
        <view class="hero-actions flex-row align-center gap-2">
          <button class="btn-board flex-row align-center gap-2" @click="goBoard">
            <AppIcon name="briefcase" :size="16" color="var(--color-primary)" />
            <text class="btn-board-text">协作看板</text>
          </button>
          <button class="btn-board flex-row align-center gap-2" @click="goSkills">
            <AppIcon name="bookmark" :size="16" color="var(--color-primary)" />
            <text class="btn-board-text">技能库</text>
          </button>
          <button class="btn-create flex-row align-center gap-2" @click="goCreate">
            <AppIcon name="plus" :size="16" color="#ffffff" />
            <text class="btn-text">创建智能体</text>
          </button>
        </view>
      </view>

      <scroll-view scroll-y class="agents-scroll flex-1">
        <view class="content-container flex-column">
          <view class="skills-section" v-if="userSkills.length > 0">
            <view class="skills-header flex-row align-center justify-between">
              <view class="skills-title-row flex-row align-center">
                <view class="skills-title-icon">
                  <AppIcon name="bookmark" :size="16" color="var(--color-primary)" />
                </view>
                <view class="skills-title-stack flex-column">
                  <text class="skills-title">我的技能</text>
                  <text class="skills-subtitle">已拥有 {{ userSkills.length }} 项技能</text>
                </view>
              </view>
              <view class="skills-link flex-row align-center gap-1" @click="goSkills">
                <text>{{ ownedAgentCount }} 个智能体可调用</text>
                <AppIcon name="chevron-right" :size="14" color="var(--color-primary)" />
              </view>
            </view>

            <view class="skills-scroll">
              <view class="skills-grid">
                <view
                  v-for="skill in userSkills"
                  :key="skill.id"
                  class="skill-card"
                  :class="skill.tone"
                  @click="goSkills(skill.id)"
                >
                  <view class="skill-icon">
                    <AppIcon :name="skill.icon || 'bookmark'" :size="18" color="currentColor" />
                  </view>
                  <view class="skill-body flex-column">
                    <view class="skill-name-row flex-row align-center justify-between">
                      <text class="skill-name">{{ skill.name }}</text>
                      <text class="skill-level">{{ skill.level }}</text>
                    </view>
                    <text class="skill-desc">{{ skill.desc }}</text>
                    <view class="skill-meta flex-row align-center justify-between">
                      <text class="skill-category">{{ skill.category }}</text>
                      <text class="skill-agents">{{ skillAgentSummary(skill) }}</text>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <view class="agent-toolbar">
            <view class="search-wrap">
              <AppIcon name="search" :size="18" color="var(--color-text-muted)" />
              <input
                class="agent-search"
                v-model="searchQuery"
                placeholder="搜索智能体名称或描述"
                placeholder-style="color: var(--color-text-muted)"
              />
              <view class="shortcut-key">/</view>
            </view>

            <view class="filter-scroll">
              <view class="filter-row">
                <view
                  v-for="filter in filters"
                  :key="filter.id"
                  class="filter-chip"
                  :class="{ active: activeFilter === filter.id }"
                  :aria-label="filter.label"
                  @click="activeFilter = filter.id"
                >
                  <AppIcon :name="filter.icon" :size="15" :color="activeFilter === filter.id ? 'var(--color-primary)' : 'var(--color-text-secondary)'" />
                  <text class="filter-label">{{ filter.label }}</text>
                </view>
              </view>
            </view>

            <view class="toolbar-spacer" />

            <text class="agent-count">共 {{ filteredAgents.length }} 个智能体</text>
            <view class="view-switch">
              <view
                class="view-btn"
                :class="{ active: viewMode === 'grid' }"
                @click="viewMode = 'grid'"
              >
                <AppIcon name="grid" :size="18" :color="viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-text-secondary)'" />
              </view>
              <view
                class="view-btn"
                :class="{ active: viewMode === 'list' }"
                @click="viewMode = 'list'"
              >
                <AppIcon name="list" :size="18" :color="viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-secondary)'" />
              </view>
            </view>
          </view>

          <view :class="['agents-grid', viewMode]" v-if="filteredAgents.length > 0">
            <view 
              v-for="item in filteredAgents" 
              :key="item.id"
              class="grid-item"
            >
              <AgentCard :agent="item" :variant="viewMode" />
            </view>
          </view>
          
          <!-- Empty State -->
          <view class="empty-container" v-else>
            <AppEmptyState 
              icon="agents" 
              title="暂无匹配智能体" 
              description="请调整筛选条件，或点击右上角新建专属 AI 助手" 
            />
          </view>
          
        </view>
      </scroll-view>
      
    </view>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useNavigationStore } from '@/stores/navigation';
import { useAgentStore } from '@/stores/agent';
import { useResponsiveLayout } from '@/composables/useResponsiveLayout';
import AppShell from '@/components/layout/AppShell.vue';
import MobilePageHeader from '@/components/layout/MobilePageHeader.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';
import AgentCard from '@/components/agents/AgentCard.vue';

const navStore = useNavigationStore();
const agentStore = useAgentStore();
const { isDesktop } = useResponsiveLayout();
const searchQuery = ref('');
const activeFilter = ref('all');
const viewMode = ref('grid');

const filters = [
  { id: 'all', label: '全部', icon: 'grid' },
  { id: 'official', label: '官方', icon: 'shield' },
  { id: 'custom', label: '自定义', icon: 'user' },
  { id: 'recent', label: '最近使用', icon: 'clock' }
];

const filteredAgents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return agentStore.agents.filter((agent, index) => {
    const tags = agent.capabilityTags || [];
    const matchesQuery = !query ||
      agent.name.toLowerCase().includes(query) ||
      agent.desc.toLowerCase().includes(query) ||
      tags.some(tag => String(tag).toLowerCase().includes(query));
    const matchesFilter =
      activeFilter.value === 'all' ||
      (activeFilter.value === 'official' && agent.creator === 'System') ||
      (activeFilter.value === 'custom' && agent.creator !== 'System') ||
      (activeFilter.value === 'recent' && index < 4);
    return matchesQuery && matchesFilter;
  });
});

const userSkills = computed(() => agentStore.userSkills || []);

const ownedAgentCount = computed(() => {
  const ids = new Set();
  userSkills.value.forEach((skill) => {
    (skill.agentIds || []).forEach((id) => ids.add(id));
  });
  return ids.size;
});

onMounted(() => {
  navStore.setActiveModule('agents');
  agentStore.fetchNativeAgents({ silent: true });
});

function goCreate() {
  uni.navigateTo({
    url: '/pages/agents/new'
  });
}

function goBoard() {
  uni.navigateTo({
    url: '/pages/agents/board'
  });
}

function goSkills(skillId = '') {
  const suffix = skillId ? `?skillId=${encodeURIComponent(skillId)}` : '';
  uni.navigateTo({
    url: `/pages/agents/skills${suffix}`
  });
}

function skillAgentSummary(skill) {
  const count = (skill.agentIds || []).filter((id) => agentStore.agents.some((agent) => agent.id === id)).length;
  return count > 0 ? `${count} 个智能体` : '未绑定';
}
</script>

<style scoped>
.agents-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.agent-hero {
  min-height: 64px;
  padding: 0 32px;
  background-color: var(--color-glass-bg);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  box-sizing: border-box;
  flex-shrink: 0;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.25;
}

.title-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.hero-actions {
  display: flex;
}

.header-icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.header-icon-btn:hover,
.header-icon-btn:active {
  background-color: var(--color-bg-hover);
}

.btn-board,
.btn-create {
  min-height: 40px;
  border-radius: 8px;
  padding: 0 16px;
  margin: 0;
  border: none;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.btn-board {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.btn-create {
  background-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 74, 198, 0.16);
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}
.btn-board::after,
.btn-create::after { border: none; }
.btn-board:hover {
  background-color: var(--color-primary-light);
  border-color: rgba(0, 74, 198, 0.16);
}
.btn-create:hover {
  background-color: var(--color-primary-hover);
  box-shadow: 0 4px 12px rgba(0, 74, 198, 0.18);
}

.btn-board-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
}

.btn-text {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.gap-2 {
  gap: 6px;
}

.gap-1 {
  gap: 4px;
}

.agents-scroll {
  height: 100%;
}

.content-container {
  padding: 20px 32px 32px;
  background-color: rgba(243, 243, 254, 0.3);
  min-height: 100%;
  box-sizing: border-box;
}

.skills-section {
  margin-bottom: 18px;
  min-width: 0;
}

.skills-header {
  display: flex;
  margin-bottom: 10px;
  gap: 12px;
}

.skills-title-row {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.skills-title-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background-color: var(--color-primary-light);
  border: 1px solid rgba(0, 74, 198, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.skills-title-stack {
  min-width: 0;
}

.skills-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.25;
}

.skills-subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.35;
}

.skills-link {
  min-height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.skills-link:hover,
.skills-link:active {
  background-color: var(--color-primary-light);
  border-color: rgba(0, 74, 198, 0.16);
}

.skills-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.skill-card {
  min-height: 124px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: rgba(255, 255, 255, 0.94);
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  gap: 10px;
  min-width: 0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.skill-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.skill-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.skill-card.primary .skill-icon {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  border-color: rgba(0, 74, 198, 0.18);
}

.skill-card.cyan .skill-icon {
  color: #0891b2;
  background-color: rgba(8, 145, 178, 0.1);
  border-color: rgba(8, 145, 178, 0.2);
}

.skill-card.orange .skill-icon {
  color: #f97316;
  background-color: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.22);
}

.skill-card.green .skill-icon {
  color: #059669;
  background-color: rgba(5, 150, 105, 0.1);
  border-color: rgba(5, 150, 105, 0.2);
}

.skill-card.purple .skill-icon {
  color: #7c3aed;
  background-color: rgba(124, 58, 237, 0.1);
  border-color: rgba(124, 58, 237, 0.2);
}

.skill-body {
  min-width: 0;
  flex: 1;
  gap: 6px;
}

.skill-name-row {
  display: flex;
  min-width: 0;
  gap: 8px;
}

.skill-name {
  min-width: 0;
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-level {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  border-radius: 6px;
  padding: 2px 6px;
}

.skill-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.skill-meta {
  display: flex;
  margin-top: auto;
  gap: 8px;
  min-width: 0;
}

.skill-category,
.skill-agents {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-category {
  min-width: 0;
}

.skill-agents {
  flex-shrink: 0;
}

.agent-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.search-wrap {
  width: 320px;
  min-height: 42px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.agent-search {
  height: 40px;
  min-width: 0;
  flex: 1;
  color: var(--color-text-primary);
  font-size: 14px;
}

.shortcut-key {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  background-color: var(--color-bg-muted);
}

.filter-scroll {
  width: auto;
  max-width: 420px;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.filter-row {
  display: flex;
  gap: 8px;
}

.filter-chip {
  min-height: 42px;
  padding: 0 13px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: rgba(255, 255, 255, 0.92);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.filter-chip.active {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  border-color: rgba(0, 74, 198, 0.12);
}

.toolbar-spacer {
  flex: 1;
  min-width: 12px;
}

.agent-count {
  color: var(--color-text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.view-switch {
  height: 42px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: rgba(255, 255, 255, 0.92);
  display: flex;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.view-btn {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.view-btn + .view-btn {
  border-left: 1px solid var(--color-border);
}

.view-btn.active {
  background-color: var(--color-primary-light);
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
}

.agents-grid.list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.agents-grid.list .grid-item {
  width: 100%;
}

@media (max-width: 1280px) {
  .skills-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .agents-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .skills-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .agent-toolbar {
    flex-wrap: wrap;
  }

  .search-wrap {
    width: 100%;
  }

  .filter-scroll {
    max-width: calc(100vw - 48px);
  }

  .toolbar-spacer {
    display: none;
  }

  .agents-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 576px) {
  .skills-header {
    align-items: flex-start;
  }

  .skills-link {
    display: none;
  }

  .skills-scroll {
    white-space: nowrap;
  }

  .skills-grid {
    display: inline-flex;
    width: max-content;
    min-width: 100%;
    gap: 10px;
  }

  .skill-card {
    width: 244px;
    min-height: 132px;
  }

  .agents-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .agent-hero {
    min-height: 56px;
    padding: 0 16px;
    align-items: center;
  }

  .title {
    font-size: 18px;
  }

  .subtitle {
    display: none;
  }

  .btn-create {
    min-height: 38px;
    padding: 0 12px;
  }

  .content-container {
    padding: 14px;
  }

  .filter-scroll {
    max-width: calc(100vw - 28px);
  }

  .filter-row {
    gap: 10px;
  }

  .filter-chip {
    width: 44px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    justify-content: center;
  }

  .filter-label {
    display: none;
  }

  .agent-count {
    display: none;
  }
}

.empty-container {
  padding-top: 60px;
}
</style>
