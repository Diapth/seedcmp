<template>
  <AppSubpageShell>
    <view class="skills-page flex-column flex-1">
      <view class="skills-header flex-row align-center justify-between">
        <view class="header-left flex-row align-center">
          <view class="back-btn" title="返回" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
          <view class="title-stack flex-column">
            <text class="title">技能库</text>
            <text class="subtitle">查看本地 Skill、上传打包文件并预览渲染后的文档</text>
          </view>
        </view>
        <view class="header-actions flex-row align-center gap-2">
          <button class="header-action secondary flex-row align-center gap-2" @click="goAgents">
            <AppIcon name="agents" :size="16" color="var(--color-primary)" />
            <text>智能体库</text>
          </button>
          <button class="header-action primary flex-row align-center gap-2" @click="showUiToast('上传技能包')">
            <AppIcon name="upload" :size="16" color="#ffffff" />
            <text>上传技能包</text>
          </button>
        </view>
      </view>

      <scroll-view scroll-y class="skills-scroll flex-1">
        <view class="skills-content">
          <view class="top-layout">
            <view class="upload-panel flex-column">
              <view class="panel-heading flex-row align-center justify-between">
                <view class="panel-title-row flex-row align-center gap-2">
                  <view class="panel-icon">
                    <AppIcon name="package" :size="18" color="var(--color-primary)" />
                  </view>
                  <view class="flex-column">
                    <text class="panel-title">上传打包好的 Skill</text>
                    <text class="panel-subtitle">支持 .skill.zip / .zip 包，当前为 UI 占位</text>
                  </view>
                </view>
                <text class="ui-only-badge">UI only</text>
              </view>

              <view class="upload-dropzone flex-column align-center justify-center" @click="showUiToast('选择技能包')">
                <view class="upload-icon">
                  <AppIcon name="upload" :size="28" color="var(--color-primary)" />
                </view>
                <text class="upload-title">拖入或选择 skill 压缩包</text>
                <text class="upload-desc">示例：ui-review.skill.zip，上传后会在这里展示解析结果</text>
                <view class="upload-actions flex-row gap-2">
                  <button class="upload-btn primary" @click.stop="showUiToast('选择技能包')">选择包</button>
                  <button class="upload-btn secondary" @click.stop="showUiToast('导入技能')">导入到本地</button>
                </view>
              </view>
            </view>

            <view class="stats-panel">
              <view class="stat-block">
                <text class="stat-value">{{ skills.length }}</text>
                <text class="stat-label">本地技能</text>
              </view>
              <view class="stat-block">
                <text class="stat-value">{{ enabledCount }}</text>
                <text class="stat-label">已启用</text>
              </view>
              <view class="stat-block">
                <text class="stat-value">{{ documentCount }}</text>
                <text class="stat-label">文档</text>
              </view>
              <view class="stat-block">
                <text class="stat-value">{{ boundAgentCount }}</text>
                <text class="stat-label">可调用智能体</text>
              </view>
            </view>
          </view>

          <view class="main-layout">
            <view class="catalog-panel flex-column">
              <view class="catalog-toolbar flex-column gap-3">
                <view class="search-wrap flex-row align-center">
                  <AppIcon name="search" :size="18" color="var(--color-text-muted)" />
                  <input
                    class="skill-search"
                    v-model="searchQuery"
                    placeholder="搜索技能、分类、触发词"
                    placeholder-style="color: var(--color-text-muted)"
                  />
                </view>

                <scroll-view scroll-x class="filter-scroll">
                  <view class="filter-row">
                    <view
                      v-for="filter in filters"
                      :key="filter.id"
                      class="filter-chip"
                      :class="{ active: activeFilter === filter.id }"
                      @click="activeFilter = filter.id"
                    >
                      <AppIcon :name="filter.icon" :size="14" :color="activeFilter === filter.id ? 'var(--color-primary)' : 'var(--color-text-secondary)'" />
                      <text>{{ filter.label }}</text>
                    </view>
                  </view>
                </scroll-view>
              </view>

              <view class="skill-list flex-column" v-if="filteredSkills.length">
                <view
                  v-for="skill in filteredSkills"
                  :key="skill.id"
                  class="skill-row"
                  :class="{ active: activeSkill?.id === skill.id }"
                  @click="selectSkill(skill.id)"
                >
                  <view class="skill-row-icon" :class="skill.tone">
                    <AppIcon :name="skill.icon || 'bookmark'" :size="19" color="currentColor" />
                  </view>
                  <view class="skill-row-main flex-column">
                    <view class="skill-row-top flex-row align-center justify-between">
                      <text class="skill-row-name">{{ skill.name }}</text>
                      <text class="skill-version">v{{ skill.version }}</text>
                    </view>
                    <text class="skill-row-desc">{{ skill.desc }}</text>
                    <view class="skill-row-meta flex-row align-center">
                      <text>{{ skill.category }}</text>
                      <view class="dot"></view>
                      <text>{{ skill.status }}</text>
                      <view class="dot"></view>
                      <text>{{ skill.size }}</text>
                    </view>
                  </view>
                </view>
              </view>

              <AppEmptyState
                v-else
                icon="bookmark"
                title="没有匹配的技能"
                description="请调整搜索关键词或筛选条件"
              />
            </view>

            <view class="detail-panel flex-column" v-if="activeSkill">
              <view class="detail-hero flex-row align-center justify-between">
                <view class="detail-main flex-row align-center">
                  <view class="detail-icon" :class="activeSkill.tone">
                    <AppIcon :name="activeSkill.icon || 'bookmark'" :size="26" color="currentColor" />
                  </view>
                  <view class="detail-title-stack flex-column">
                    <view class="detail-name-row flex-row align-center">
                      <text class="detail-title">{{ activeSkill.name }}</text>
                      <text class="status-badge">{{ activeSkill.status }}</text>
                    </view>
                    <text class="detail-desc">{{ activeSkill.desc }}</text>
                  </view>
                </view>
                <view class="detail-actions flex-row gap-2">
                  <button class="detail-btn" @click="showUiToast('启用状态')">启用</button>
                  <button class="detail-btn primary" @click="showUiToast('绑定智能体')">绑定智能体</button>
                </view>
              </view>

              <view class="meta-grid">
                <view class="meta-item">
                  <text class="meta-label">包名</text>
                  <text class="meta-value">{{ activeSkill.packageName }}</text>
                </view>
                <view class="meta-item">
                  <text class="meta-label">本地路径</text>
                  <text class="meta-value mono">{{ activeSkill.location }}</text>
                </view>
                <view class="meta-item">
                  <text class="meta-label">更新时间</text>
                  <text class="meta-value">{{ activeSkill.updatedAt }}</text>
                </view>
                <view class="meta-item">
                  <text class="meta-label">作者</text>
                  <text class="meta-value">{{ activeSkill.author }}</text>
                </view>
              </view>

              <view class="detail-body">
                <view class="side-info flex-column">
                  <view class="info-section flex-column gap-2">
                    <view class="section-title flex-row align-center gap-2">
                      <AppIcon name="agents" :size="15" color="var(--color-primary)" />
                      <text>可调用智能体</text>
                    </view>
                    <view class="agent-chip-list">
                      <view
                        v-for="agent in boundAgents"
                        :key="agent.id"
                        class="agent-chip"
                      >
                        <text>{{ agent.name }}</text>
                      </view>
                      <text v-if="!boundAgents.length" class="muted-line">暂未绑定智能体</text>
                    </view>
                  </view>

                  <view class="info-section flex-column gap-2">
                    <view class="section-title flex-row align-center gap-2">
                      <AppIcon name="flag" :size="15" color="var(--color-primary)" />
                      <text>触发词</text>
                    </view>
                    <view class="tag-list">
                      <text v-for="tag in activeSkill.triggers" :key="tag" class="tag-pill">{{ tag }}</text>
                    </view>
                  </view>

                  <view class="info-section flex-column gap-2">
                    <view class="section-title flex-row align-center gap-2">
                      <AppIcon name="files" :size="15" color="var(--color-primary)" />
                      <text>文件清单</text>
                    </view>
                    <view class="file-lines flex-column">
                      <view v-for="file in activeSkill.files" :key="file" class="file-line flex-row align-center">
                        <AppIcon name="files" :size="13" color="var(--color-text-muted)" />
                        <text>{{ file }}</text>
                      </view>
                    </view>
                  </view>
                </view>

                <view class="doc-panel flex-column">
                  <view class="doc-toolbar flex-row align-center justify-between">
                    <scroll-view scroll-x class="doc-tabs-scroll">
                      <view class="doc-tabs flex-row">
                        <view
                          v-for="doc in activeDocuments"
                          :key="doc.id"
                          class="doc-tab"
                          :class="{ active: activeDocument?.id === doc.id }"
                          @click="selectDoc(doc.id)"
                        >
                          <AppIcon name="book-open" :size="14" color="currentColor" />
                          <text>{{ doc.title }}</text>
                        </view>
                      </view>
                    </scroll-view>
                    <button class="source-toggle flex-row align-center gap-1" @click="showSource = !showSource">
                      <AppIcon :name="showSource ? 'eye' : 'code'" :size="14" color="var(--color-primary)" />
                      <text>{{ showSource ? '渲染预览' : '查看源码' }}</text>
                    </button>
                  </view>

                  <view class="doc-summary flex-row align-center justify-between" v-if="activeDocument">
                    <view class="flex-column">
                      <text class="doc-title">{{ activeDocument.title }}</text>
                      <text class="doc-desc">{{ activeDocument.summary }}</text>
                    </view>
                    <text class="doc-updated">{{ activeDocument.updatedAt }}</text>
                  </view>

                  <scroll-view scroll-y class="doc-scroll flex-1">
                    <view v-if="showSource" class="source-body">
                      <text selectable>{{ activeDocument?.markdown || '' }}</text>
                    </view>
                    <view v-else class="markdown-body" v-html="renderedDocument" />
                  </scroll-view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import { useAgentStore } from '@/stores/agent';
import { useNavigationStore } from '@/stores/navigation';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';

const agentStore = useAgentStore();
const navStore = useNavigationStore();

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
});

const selectedSkillId = ref('');
const selectedDocId = ref('');
const searchQuery = ref('');
const activeFilter = ref('all');
const showSource = ref(false);

const filters = [
  { id: 'all', label: '全部', icon: 'grid' },
  { id: 'enabled', label: '已启用', icon: 'check' },
  { id: 'trial', label: '试用', icon: 'clock' },
  { id: 'local', label: '本地', icon: 'package' }
];

const skills = computed(() => agentStore.localSkills || []);

const filteredSkills = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return skills.value.filter((skill) => {
    const haystack = [
      skill.name,
      skill.desc,
      skill.category,
      skill.packageName,
      ...(skill.triggers || [])
    ].join(' ').toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesFilter =
      activeFilter.value === 'all' ||
      (activeFilter.value === 'enabled' && skill.status === '已启用') ||
      (activeFilter.value === 'trial' && skill.status === '试用') ||
      (activeFilter.value === 'local' && skill.source === '本地');
    return matchesQuery && matchesFilter;
  });
});

const activeSkill = computed(() => {
  return skills.value.find(item => item.id === selectedSkillId.value) || filteredSkills.value[0] || skills.value[0] || null;
});

const activeDocuments = computed(() => activeSkill.value?.documents || []);

const activeDocument = computed(() => {
  return activeDocuments.value.find(doc => doc.id === selectedDocId.value) || activeDocuments.value[0] || null;
});

const renderedDocument = computed(() => markdown.render(activeDocument.value?.markdown || ''));

const enabledCount = computed(() => skills.value.filter(skill => skill.status === '已启用').length);

const documentCount = computed(() => skills.value.reduce((total, skill) => total + (skill.documents?.length || 0), 0));

const boundAgentCount = computed(() => {
  const ids = new Set();
  skills.value.forEach((skill) => {
    (skill.agentIds || []).forEach(id => ids.add(id));
  });
  return ids.size;
});

const boundAgents = computed(() => {
  if (!activeSkill.value) return [];
  return (activeSkill.value.agentIds || [])
    .map(id => agentStore.agents.find(agent => agent.id === id))
    .filter(Boolean);
});

watch(activeSkill, (skill) => {
  selectedSkillId.value = skill?.id || '';
  selectedDocId.value = skill?.documents?.[0]?.id || '';
  showSource.value = false;
});

onMounted(() => {
  navStore.setActiveModule('agents');
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const initialSkillId = safeDecode(currentPage?.$page?.options?.skillId || '');
  selectedSkillId.value = skills.value.some(skill => skill.id === initialSkillId)
    ? initialSkillId
    : skills.value[0]?.id || '';
  selectedDocId.value = activeSkill.value?.documents?.[0]?.id || '';
});

function selectSkill(id) {
  selectedSkillId.value = id;
}

function selectDoc(id) {
  selectedDocId.value = id;
  showSource.value = false;
}

function showUiToast(action) {
  uni.showToast({
    title: `${action}为界面示意`,
    icon: 'none'
  });
}

function safeDecode(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
    return;
  }
  uni.redirectTo({ url: '/pages/agents/index' });
}

function goAgents() {
  uni.redirectTo({ url: '/pages/agents/index' });
}
</script>

<style scoped>
.skills-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.skills-header {
  min-height: 64px;
  padding: 0 24px;
  background-color: var(--color-glass-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
}

.header-left {
  min-width: 0;
  gap: 14px;
}

.back-btn {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.back-btn:hover,
.back-btn:active {
  background-color: var(--color-bg-hover);
}

.title-stack {
  min-width: 0;
}

.title {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1.25;
}

.subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  flex-shrink: 0;
}

.header-action,
.upload-btn,
.detail-btn,
.source-toggle {
  min-height: 40px;
  border-radius: 8px;
  border: none;
  margin: 0;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}

.header-action::after,
.upload-btn::after,
.detail-btn::after,
.source-toggle::after {
  border: none;
}

.header-action.secondary,
.upload-btn.secondary,
.detail-btn,
.source-toggle {
  background-color: var(--color-bg-surface);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
}

.header-action.primary,
.upload-btn.primary,
.detail-btn.primary {
  background-color: var(--color-primary);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 74, 198, 0.16);
}

.skills-scroll {
  height: 100%;
}

.skills-content {
  padding: 20px 32px 32px;
  box-sizing: border-box;
  min-height: 100%;
  background-color: rgba(243, 243, 254, 0.3);
}

.top-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 16px;
  margin-bottom: 16px;
}

.upload-panel,
.stats-panel,
.catalog-panel,
.detail-panel {
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: rgba(255, 255, 255, 0.94);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  box-sizing: border-box;
}

.upload-panel {
  padding: 18px;
  gap: 14px;
}

.panel-heading {
  display: flex;
  gap: 12px;
}

.panel-title-row {
  display: flex;
  min-width: 0;
}

.panel-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: var(--color-primary-light);
  border: 1px solid rgba(0, 74, 198, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.panel-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.panel-subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.ui-only-badge {
  align-self: flex-start;
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  background-color: rgba(249, 115, 22, 0.12);
  color: var(--color-warning);
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.upload-dropzone {
  min-height: 178px;
  border-radius: 8px;
  border: 1px dashed rgba(0, 74, 198, 0.32);
  background-color: rgba(0, 74, 198, 0.04);
  padding: 20px;
  box-sizing: border-box;
  text-align: center;
  cursor: pointer;
  gap: 8px;
}

.upload-icon {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.upload-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.upload-actions {
  display: flex;
  margin-top: 8px;
}

.stats-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  background-color: var(--color-border);
}

.stat-block {
  min-height: 108px;
  padding: 18px;
  background-color: var(--color-bg-surface);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 900;
  color: var(--color-text-primary);
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 8px;
}

.main-layout {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.catalog-panel {
  padding: 14px;
  gap: 14px;
  display: flex;
}

.catalog-toolbar {
  display: flex;
}

.search-wrap {
  min-height: 42px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-base);
  gap: 10px;
  padding: 0 10px;
  box-sizing: border-box;
  display: flex;
}

.skill-search {
  height: 40px;
  min-width: 0;
  flex: 1;
  font-size: 14px;
  color: var(--color-text-primary);
}

.filter-scroll,
.doc-tabs-scroll {
  width: 100%;
  white-space: nowrap;
}

.filter-row,
.doc-tabs {
  display: inline-flex;
  gap: 8px;
  min-width: 100%;
}

.filter-chip,
.doc-tab {
  min-height: 38px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.filter-chip.active,
.doc-tab.active {
  color: var(--color-primary);
  border-color: rgba(0, 74, 198, 0.18);
  background-color: var(--color-primary-light);
}

.skill-list {
  display: flex;
  gap: 10px;
}

.skill-row {
  min-height: 112px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  padding: 12px;
  display: flex;
  gap: 10px;
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.skill-row:hover,
.skill-row.active {
  border-color: rgba(0, 74, 198, 0.24);
  background-color: var(--color-primary-light);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
}

.skill-row-icon,
.detail-icon {
  border-radius: 8px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.skill-row-icon {
  width: 40px;
  height: 40px;
}

.detail-icon {
  width: 56px;
  height: 56px;
}

.skill-row-icon.primary,
.detail-icon.primary {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  border-color: rgba(0, 74, 198, 0.18);
}

.skill-row-icon.cyan,
.detail-icon.cyan {
  color: #0891b2;
  background-color: rgba(8, 145, 178, 0.1);
  border-color: rgba(8, 145, 178, 0.2);
}

.skill-row-icon.orange,
.detail-icon.orange {
  color: #f97316;
  background-color: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.22);
}

.skill-row-icon.green,
.detail-icon.green {
  color: #059669;
  background-color: rgba(5, 150, 105, 0.1);
  border-color: rgba(5, 150, 105, 0.2);
}

.skill-row-icon.purple,
.detail-icon.purple {
  color: #7c3aed;
  background-color: rgba(124, 58, 237, 0.1);
  border-color: rgba(124, 58, 237, 0.2);
}

.skill-row-main {
  min-width: 0;
  flex: 1;
}

.skill-row-top {
  display: flex;
  gap: 8px;
}

.skill-row-name {
  min-width: 0;
  flex: 1;
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-version {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-primary);
}

.skill-row-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.45;
  margin-top: 6px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.skill-row-meta {
  gap: 7px;
  margin-top: 10px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background-color: var(--color-text-muted);
  flex-shrink: 0;
}

.detail-panel {
  padding: 18px;
  gap: 16px;
  display: flex;
  min-width: 0;
}

.detail-hero {
  display: flex;
  gap: 16px;
}

.detail-main {
  min-width: 0;
  gap: 14px;
}

.detail-title-stack {
  min-width: 0;
}

.detail-name-row {
  display: flex;
  gap: 10px;
}

.detail-title {
  font-size: 22px;
  font-weight: 900;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  min-height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  background-color: rgba(16, 185, 129, 0.12);
  color: var(--color-success);
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.detail-desc {
  margin-top: 5px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.55;
}

.detail-actions {
  display: flex;
  flex-shrink: 0;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.meta-item {
  min-height: 68px;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
}

.meta-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.meta-value {
  margin-top: 5px;
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}

.detail-body {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

.side-info {
  gap: 12px;
}

.info-section {
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  padding: 14px;
  display: flex;
}

.section-title {
  display: flex;
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.agent-chip-list,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.agent-chip,
.tag-pill {
  min-height: 28px;
  padding: 0 9px;
  border-radius: 6px;
  background-color: var(--color-bg-muted);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}

.agent-chip {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.file-lines {
  display: flex;
  gap: 8px;
}

.file-line {
  display: flex;
  gap: 7px;
  min-width: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.file-line text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted-line {
  font-size: 12px;
  color: var(--color-text-muted);
}

.doc-panel {
  min-width: 0;
  min-height: 560px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  overflow: hidden;
  display: flex;
}

.doc-toolbar {
  min-height: 56px;
  padding: 0 14px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  gap: 12px;
  box-sizing: border-box;
}

.doc-tabs-scroll {
  flex: 1;
  min-width: 0;
}

.source-toggle {
  min-height: 36px;
  flex-shrink: 0;
}

.doc-summary {
  min-height: 70px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background-color: rgba(248, 250, 252, 0.7);
  display: flex;
  gap: 12px;
  box-sizing: border-box;
}

.doc-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.doc-desc {
  margin-top: 3px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.doc-updated {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.doc-scroll {
  min-height: 0;
  height: 100%;
}

.source-body,
.markdown-body {
  min-height: 100%;
  padding: 24px;
  box-sizing: border-box;
}

.source-body {
  background-color: #0f172a;
  color: #dbeafe;
  font-size: 12.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}

.markdown-body {
  background-color: #ffffff;
  color: #334155;
  font-size: 14px;
  line-height: 1.8;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 0 0 16px;
  color: #0f172a;
  line-height: 1.35;
  font-weight: 800;
}

.markdown-body :deep(h1) {
  font-size: 22px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.markdown-body :deep(h2) {
  font-size: 18px;
  margin-top: 22px;
}

.markdown-body :deep(p) {
  margin: 0 0 14px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 16px 22px;
  padding: 0;
}

.markdown-body :deep(ul) {
  list-style: disc;
}

.markdown-body :deep(ol) {
  list-style: decimal;
}

.markdown-body :deep(li) {
  margin: 4px 0;
  padding-left: 2px;
}

.markdown-body :deep(blockquote) {
  margin: 16px 0;
  padding: 10px 14px;
  border-left: 4px solid rgba(0, 74, 198, 0.32);
  background-color: #f8fafc;
  color: #475569;
}

.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #f1f5f9;
  color: #0f172a;
  font-family: Consolas, Monaco, monospace;
  font-size: 12.5px;
}

.markdown-body :deep(table) {
  display: block;
  width: max-content;
  max-width: 100%;
  margin: 18px 0;
  overflow-x: auto;
  border-collapse: collapse;
  border-spacing: 0;
  font-size: 13px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  min-width: 92px;
  padding: 8px 12px;
  border: 1px solid #d8dee8;
  text-align: left;
  white-space: nowrap;
}

.markdown-body :deep(th) {
  background-color: #f1f5f9;
  color: #0f172a;
  font-weight: 800;
}

.markdown-body :deep(td) {
  background-color: #ffffff;
}

.gap-1 {
  gap: 4px;
}

.gap-2 {
  gap: 8px;
}

.gap-3 {
  gap: 12px;
}

@media (max-width: 1180px) {
  .top-layout {
    grid-template-columns: 1fr;
  }

  .stats-panel {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .main-layout {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .meta-grid,
  .detail-body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .doc-panel {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .skills-header {
    min-height: 64px;
    padding: 0 16px;
  }

  .subtitle {
    display: none;
  }

  .header-actions {
    gap: 6px;
  }

  .header-action {
    width: 44px;
    min-width: 44px;
    padding: 0;
  }

  .header-action text {
    display: none;
  }

  .skills-content {
    padding: 14px;
  }

  .stats-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .main-layout {
    grid-template-columns: 1fr;
  }

  .catalog-panel,
  .detail-panel,
  .upload-panel {
    padding: 14px;
  }

  .detail-hero,
  .doc-summary {
    flex-direction: column;
    align-items: stretch;
  }

  .detail-actions {
    width: 100%;
  }

  .detail-btn {
    flex: 1;
    min-height: 44px;
  }

  .meta-grid,
  .detail-body {
    grid-template-columns: 1fr;
  }

  .doc-panel {
    min-height: 620px;
  }

  .doc-toolbar {
    min-height: 104px;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    padding: 10px 12px;
  }

  .source-toggle {
    min-height: 40px;
  }

  .source-body,
  .markdown-body {
    padding: 16px;
  }
}

@media (max-width: 420px) {
  .panel-heading,
  .upload-actions,
  .detail-main {
    flex-direction: column;
    align-items: stretch;
  }

  .ui-only-badge {
    align-self: flex-start;
  }

  .upload-btn {
    min-height: 44px;
  }

  .detail-icon {
    width: 48px;
    height: 48px;
  }

  .detail-name-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-title {
    white-space: normal;
  }
}
</style>
