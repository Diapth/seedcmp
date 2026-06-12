<template>
  <view
    v-if="visible"
    class="file-preview-shell flex-column"
    :class="{ embedded, overlay: !embedded }"
    @click.self="handleBackdropClose"
  >
    <view class="file-preview-card flex-column">
      <!-- 预览窗口头部 -->
      <view class="preview-header flex-row align-center justify-between">
        <view class="file-title-block flex-row align-center">
          <view class="file-icon-box" :style="{ backgroundColor: fileTypeTheme.bg }">
            <AppIcon :name="fileTypeTheme.icon" :size="22" :color="fileTypeTheme.color" />
          </view>
          <view class="file-meta flex-column">
            <text class="preview-filename">{{ normalizedFile.name }}</text>
            <text class="preview-filesize">{{ normalizedFile.size }} · {{ typeLabel }}</text>
          </view>
        </view>
        
        <view class="header-actions flex-row align-center">
          <!-- 源码/预览切换按钮 (Markdown, HTML 格式显示) -->
          <button
            v-if="['markdown', 'html'].includes(previewKind)"
            class="header-btn toggle-render-btn"
            :title="showRender ? '查看源码' : '渲染预览'"
            @click="showRender = !showRender"
          >
            <AppIcon :name="showRender ? 'code' : 'eye'" :size="16" color="var(--color-primary)" />
            <text class="btn-text" style="color: var(--color-primary)">{{ showRender ? '源码' : '预览' }}</text>
          </button>

          <button
            class="header-btn"
            :disabled="isDownloading"
            :title="isDownloaded ? '重新下载' : '下载文件'"
            @click="startDownload"
          >
            <AppIcon name="download" :size="16" color="var(--color-text-secondary)" />
            <text class="btn-text">{{ isDownloaded ? '重新下载' : '下载' }}</text>
          </button>
          
          <view class="close-icon-btn" title="关闭预览" @click="$emit('close')">
            <AppIcon name="close" :size="18" />
          </view>
        </view>
      </view>

      <!-- 下载进度条 -->
      <view class="download-progress-box" v-if="isDownloading">
        <view class="progress-bar-bg">
          <view class="progress-bar-fill" :style="{ width: progress + '%' }" />
        </view>
        <text class="progress-text">正在下载：{{ progress }}%</text>
      </view>

      <!-- 滚动视图区 -->
      <scroll-view scroll-y class="preview-scroll flex-1">
        <view
          ref="previewBodyRef"
          class="preview-body"
          :class="{ 'text-selection-enabled': canSelectPreviewText }"
        >
          
          <!-- 加载指示器 -->
          <view class="source-loading-box flex-column align-center justify-center" v-if="isLoadingSource">
            <view class="loading-spinner"></view>
            <text class="loading-tip">正在拉取真实源文件正文...</text>
          </view>
          
          <template v-else>
            <!-- 1. Markdown 渲染预览 -->
            <view class="markdown-body" v-if="previewKind === 'markdown' && showRender" v-html="renderedMarkdown" />

            <!-- 2. HTML 沙箱渲染预览 -->
            <view class="html-render-full" v-else-if="previewKind === 'html' && showRender">
              <iframe
                class="html-render-iframe"
                :srcdoc="sandboxedHtmlContent"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                referrerpolicy="no-referrer"
                frameborder="0"
              ></iframe>
            </view>

            <!-- 3. Word 仿真排版页面 -->
            <view class="word-preview-container flex-column" v-else-if="previewKind === 'word'">
              <view class="word-a4-page">
                <view
                  v-if="safeWordHtmlContent"
                  class="word-document-body"
                  v-html="safeWordHtmlContent"
                />
                <view class="word-content-area" v-else-if="documentParagraphs.length">
                  <p
                    v-for="(paragraph, index) in documentParagraphs"
                    :key="index"
                    class="word-paragraph-render"
                  >
                    {{ paragraph }}
                  </p>
                </view>
                <AppEmptyState
                  v-else
                  icon="files"
                  title="无法预览 Word 正文"
                  :description="wordPreviewEmptyDesc"
                />
              </view>
            </view>

            <!-- 4. PDF 真实渲染 (H5 Iframe 撑满高度) -->
            <view class="pdf-preview-box" v-else-if="previewKind === 'pdf'">
              <iframe
                :src="normalizedFile.url || '/manifest.pdf'"
                class="pdf-iframe"
                width="100%"
                height="100%"
                frameborder="0"
              ></iframe>
            </view>

            <!-- 5. PPT 幻灯片真实内容预览 -->
            <view class="ppt-preview-container flex-column" v-else-if="previewKind === 'presentation'">
              <template v-if="presentationPdfUrl">
                <view class="presentation-pdf-preview flex-column">
                  <view class="presentation-pdf-stage flex-column align-center justify-center flex-1">
                    <image
                      v-if="presentationPdfPageImage"
                      class="presentation-pdf-page-image"
                      :src="presentationPdfPageImage"
                      mode="aspectFit"
                    />
                    <view
                      v-else-if="isLoadingPresentationPdf"
                      class="presentation-pdf-loading flex-column align-center justify-center"
                    >
                      <view class="loading-spinner"></view>
                      <text class="loading-tip">正在渲染转换后的 PDF...</text>
                    </view>
                    <AppEmptyState
                      v-else
                      icon="files"
                      title="无法预览转换后的 PDF"
                      :description="presentationPdfPreviewError"
                    />
                  </view>
                  <view class="presentation-pdf-controls flex-row align-center justify-center">
                    <button
                      class="ppt-nav-btn"
                      :disabled="presentationPdfPage <= 1 || isLoadingPresentationPdf"
                      @click="prevPresentationPdfPage"
                    >
                      上一页
                    </button>
                    <text class="ppt-page-indicator presentation-pdf-page-indicator">{{ presentationPdfPageLabel }}</text>
                    <button
                      class="ppt-nav-btn"
                      :disabled="presentationPdfPage >= presentationPdfPageCount || isLoadingPresentationPdf"
                      @click="nextPresentationPdfPage"
                    >
                      下一页
                    </button>
                    <button
                      class="ppt-nav-btn ppt-fullscreen-btn"
                      :disabled="!presentationPdfPageImage"
                      title="全屏预览"
                      @click="openPresentationPdfFullscreen"
                    >
                      <AppIcon name="fullscreen" :size="13" color="#605e5c" />
                      <text>全屏</text>
                    </button>
                  </view>
                </view>
              </template>
              <template v-else-if="pptSlides.length">
                <view class="ppt-screen-area flex-column flex-1 justify-between">
                  <view class="ppt-slide-viewport flex-column align-center justify-center flex-1">
                    <view
                      class="ppt-slide-card"
                      :style="{ backgroundColor: activeSlide?.background || '#ffffff' }"
                    >
                      <template v-if="activeSlide?.elements?.length">
                        <template
                          v-for="(element, elementIdx) in activeSlide.elements"
                          :key="`${activeSlideIdx}-${elementIdx}`"
                        >
                          <image
                            v-if="element.type === 'image'"
                            class="ppt-image-element"
                            :src="element.src"
                            mode="aspectFill"
                            :style="element.style"
                          />
                          <view
                            v-else-if="element.type === 'shape'"
                            class="ppt-shape-element"
                            :style="element.style"
                          />
                          <view
                            v-else-if="element.type === 'table'"
                            class="ppt-table-element"
                            :style="element.style"
                          >
                            <view
                              v-for="(row, rowIdx) in element.rows"
                              :key="rowIdx"
                              class="ppt-table-row"
                            >
                              <text
                                v-for="(cell, cellIdx) in row"
                                :key="cellIdx"
                                class="ppt-table-cell"
                              >
                                {{ cell }}
                              </text>
                            </view>
                          </view>
                          <view
                            v-else
                            class="ppt-text-element"
                            :class="{ title: element.role === 'title' }"
                            :style="element.style"
                          >
                            <text
                              v-for="(line, lineIdx) in element.lines"
                              :key="lineIdx"
                              class="ppt-text-line"
                            >
                              {{ line }}
                            </text>
                          </view>
                        </template>
                      </template>
                      <view v-else class="ppt-empty-slide flex-column align-center justify-center">
                        <text class="ppt-slide-title-text">{{ activeSlide?.title || '空白幻灯片' }}</text>
                      </view>
                    </view>
                  </view>
                  <view class="ppt-controls flex-row align-center justify-center">
                    <view class="ppt-nav-btns flex-row">
                      <button class="ppt-nav-btn" :disabled="activeSlideIdx === 0" @click="prevSlide">上一页</button>
                      <text class="ppt-page-indicator">第 {{ activeSlideIdx + 1 }} / {{ pptSlides.length }} 页</text>
                      <button class="ppt-nav-btn" :disabled="activeSlideIdx === pptSlides.length - 1" @click="nextSlide">下一页</button>
                      <button class="ppt-nav-btn ppt-fullscreen-btn" title="全屏预览" @click="openPresentationFullscreen">
                        <AppIcon name="fullscreen" :size="13" color="#605e5c" />
                        <text>全屏</text>
                      </button>
                    </view>
                  </view>
                </view>
              </template>
              <AppEmptyState
                v-else
                icon="files"
                title="无法预览演示文稿"
                :description="officePreviewEmptyDesc"
              />
            </view>

            <!-- 6. Excel / CSV 真实工作表预览 -->
            <view class="excel-preview-container flex-column" v-else-if="previewKind === 'sheet'">
              <template v-if="sheetsData.length">
                <scroll-view scroll-y scroll-x class="excel-grid-scroll flex-1">
                  <view
                    class="excel-table-layout flex-column"
                    :style="{ minWidth: excelTableMinWidth }"
                  >
                    <view class="excel-grid-row flex-row">
                      <view class="excel-corner-cell"></view>
                      <view
                        v-for="label in activeSheetColumnLabels"
                        :key="label"
                        class="excel-col-header"
                      >
                        {{ label }}
                      </view>
                    </view>
                    <view
                      v-for="(row, rIdx) in activeSheetRows"
                      :key="rIdx"
                      class="excel-grid-row flex-row"
                    >
                      <view class="excel-row-header">{{ rIdx + 1 }}</view>
                      <view
                        v-for="cIdx in activeSheetColumnCount"
                        :key="cIdx"
                        class="excel-data-cell"
                        :class="{ header: rIdx === 0, editing: editingCell.row === rIdx && editingCell.col === cIdx - 1 }"
                        @dblclick="startEditCell(rIdx, cIdx - 1, row[cIdx - 1] || '')"
                      >
                        <input
                          v-if="editingCell.row === rIdx && editingCell.col === cIdx - 1"
                          class="cell-edit-input"
                          v-model="editingCell.val"
                          @blur="saveEditCell(rIdx, cIdx - 1)"
                          @confirm="saveEditCell(rIdx, cIdx - 1)"
                          focus
                        />
                        <text v-else>{{ row[cIdx - 1] || '' }}</text>
                      </view>
                    </view>
                  </view>
                </scroll-view>
                <view class="excel-sheet-tabs-bar flex-row align-center">
                  <view class="excel-nav-arrows">
                    <text class="nav-arrow" @click="activeSheetIdx = Math.max(0, activeSheetIdx - 1)">&lt;</text>
                    <text class="nav-arrow" @click="activeSheetIdx = Math.min(sheetsData.length - 1, activeSheetIdx + 1)">&gt;</text>
                  </view>
                  <scroll-view scroll-x class="sheet-tabs-scroll flex-1">
                    <view class="sheet-tabs-inner flex-row">
                      <view
                        v-for="(sheet, sIdx) in sheetsData"
                        :key="sheet.name || sIdx"
                        class="sheet-tab-item"
                        :class="{ active: activeSheetIdx === sIdx }"
                        @click="activeSheetIdx = sIdx"
                      >
                        <text>{{ sheet.name }}</text>
                      </view>
                    </view>
                  </scroll-view>
                  <view class="excel-status-info">
                    <text>{{ sheetStatusText }}</text>
                  </view>
                </view>
              </template>
              <AppEmptyState
                v-else
                icon="files"
                title="无法预览表格"
                :description="officePreviewEmptyDesc"
              />
            </view>

            <!-- 7. 代码编辑器 (代码预览 或 Markdown/HTML 源码状态) -->
            <view
              class="code-editor-wrapper flex-column"
              v-else-if="previewKind === 'code' || ((previewKind === 'markdown' || previewKind === 'html') && !showRender)"
            >
              <!-- 编辑器滚动主体 -->
              <scroll-view scroll-y scroll-x class="editor-scroll-view flex-1">
                <view class="editor-code-body flex-row">
                  <!-- 行号列 -->
                  <view class="line-numbers-col flex-column">
                    <text v-for="(line, idx) in codeLines" :key="idx" class="line-num-text">{{ idx + 1 }}</text>
                  </view>
                  <!-- 代码行内容 -->
                  <view class="code-content-col flex-column">
                    <pre v-for="(line, idx) in codeLines" :key="idx" class="code-line-text" v-html="highlightCode(line, extension)"></pre>
                  </view>
                </view>
              </scroll-view>
            </view>

            <!-- 8. 图片预览 -->
            <view class="image-preview flex-column align-center" v-else-if="previewKind === 'image'">
              <template v-if="imagePreviewUrl && !imageLoadError">
                <view
                  v-if="isImageLoading"
                  class="image-preview-loading flex-column align-center justify-center"
                >
                  <view class="loading-spinner"></view>
                  <text class="loading-tip">正在加载图片...</text>
                </view>
                <view class="image-preview-stage flex-column align-center justify-center">
                  <image
                    class="preview-image"
                    :src="imagePreviewUrl"
                    :alt="normalizedFile.name"
                    mode="aspectFit"
                    @load="handleImageLoad"
                    @error="handleImageError"
                  />
                </view>
              </template>
              <AppEmptyState
                v-else
                icon="image"
                title="无法预览图片"
                :description="imagePreviewEmptyDesc"
              />
            </view>

            <!-- 9. 降级渲染 -->
            <view class="fallback-preview flex-column align-center" v-else>
              <view class="fallback-icon">
                <AppIcon name="files" :size="42" color="var(--color-primary)" />
              </view>
              <text class="fallback-title">{{ fallbackTitle }}</text>
              <text class="fallback-desc">{{ fallbackDesc }}</text>
              <button class="btn-open" @click="startDownload">下载文件</button>
            </view>
          </template>
          
        </view>
      </scroll-view>
    </view>

    <view
      v-if="isPresentationPdfFullscreen && presentationPdfUrl"
      class="presentation-pdf-fullscreen-layer flex-column"
      @click.self="closePresentationPdfFullscreen"
    >
      <view class="ppt-fullscreen-topbar flex-row align-center justify-between">
        <text class="ppt-fullscreen-title"></text>
        <button class="ppt-fullscreen-close" title="关闭全屏" @click="closePresentationPdfFullscreen">
          <AppIcon name="close" :size="18" color="#ffffff" />
        </button>
      </view>
      <view class="presentation-pdf-fullscreen-stage flex-column align-center justify-center flex-1">
        <image
          v-if="presentationPdfPageImage"
          class="presentation-pdf-fullscreen-image"
          :src="presentationPdfPageImage"
          mode="aspectFit"
        />
        <view
          v-else-if="isLoadingPresentationPdf"
          class="presentation-pdf-loading flex-column align-center justify-center"
        >
          <view class="loading-spinner"></view>
          <text class="loading-tip">正在渲染转换后的 PDF...</text>
        </view>
        <AppEmptyState
          v-else
          icon="files"
          title="无法预览转换后的 PDF"
          :description="presentationPdfPreviewError"
        />
      </view>
      <view class="ppt-fullscreen-controls flex-row align-center justify-center">
        <button
          class="ppt-fullscreen-nav-btn"
          :disabled="presentationPdfPage <= 1 || isLoadingPresentationPdf"
          @click="prevPresentationPdfPage"
        >
          上一页
        </button>
        <text class="ppt-fullscreen-page">{{ presentationPdfPageLabel }}</text>
        <button
          class="ppt-fullscreen-nav-btn"
          :disabled="presentationPdfPage >= presentationPdfPageCount || isLoadingPresentationPdf"
          @click="nextPresentationPdfPage"
        >
          下一页
        </button>
      </view>
    </view>

    <view
      v-if="isPresentationFullscreen && previewKind === 'presentation' && activeSlide"
      class="ppt-fullscreen-layer flex-column"
      @click.self="closePresentationFullscreen"
    >
      <view class="ppt-fullscreen-topbar flex-row align-center justify-between">
        <text class="ppt-fullscreen-title">{{ normalizedFile.name }}</text>
        <button class="ppt-fullscreen-close" title="关闭全屏" @click="closePresentationFullscreen">
          <AppIcon name="close" :size="18" color="#ffffff" />
        </button>
      </view>

      <view class="ppt-fullscreen-stage flex-column align-center justify-center flex-1">
        <view
          class="ppt-slide-card fullscreen"
          :style="{ backgroundColor: activeSlide?.background || '#ffffff' }"
        >
          <template v-if="activeSlide?.elements?.length">
            <template
              v-for="(element, elementIdx) in activeSlide.elements"
              :key="`fullscreen-${activeSlideIdx}-${elementIdx}`"
            >
              <image
                v-if="element.type === 'image'"
                class="ppt-image-element"
                :src="element.src"
                mode="aspectFill"
                :style="element.style"
              />
              <view
                v-else-if="element.type === 'shape'"
                class="ppt-shape-element"
                :style="element.style"
              />
              <view
                v-else-if="element.type === 'table'"
                class="ppt-table-element"
                :style="element.style"
              >
                <view
                  v-for="(row, rowIdx) in element.rows"
                  :key="rowIdx"
                  class="ppt-table-row"
                >
                  <text
                    v-for="(cell, cellIdx) in row"
                    :key="cellIdx"
                    class="ppt-table-cell"
                  >
                    {{ cell }}
                  </text>
                </view>
              </view>
              <view
                v-else
                class="ppt-text-element"
                :class="{ title: element.role === 'title' }"
                :style="element.style"
              >
                <text
                  v-for="(line, lineIdx) in element.lines"
                  :key="lineIdx"
                  class="ppt-text-line"
                >
                  {{ line }}
                </text>
              </view>
            </template>
          </template>
          <view v-else class="ppt-empty-slide flex-column align-center justify-center">
            <text class="ppt-slide-title-text">{{ activeSlide?.title || '空白幻灯片' }}</text>
          </view>
        </view>
      </view>

      <view class="ppt-fullscreen-controls flex-row align-center justify-center">
        <button class="ppt-fullscreen-nav-btn" :disabled="activeSlideIdx === 0" @click="prevSlide">上一页</button>
        <text class="ppt-fullscreen-page">第 {{ activeSlideIdx + 1 }} / {{ pptSlides.length }} 页</text>
        <button class="ppt-fullscreen-nav-btn" :disabled="activeSlideIdx === pptSlides.length - 1" @click="nextSlide">下一页</button>
      </view>
    </view>

    <!-- 选中文本后的右键/浮动上下文菜单 -->
    <view
      v-if="showContextMenu && hasSelection"
      class="custom-selection-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
      @click.stop
    >
      <view class="menu-item flex-row align-center" @click="quoteSelectedPreviewText">
        <AppIcon name="quote" :size="14" color="var(--color-text-secondary)" />
        <text class="menu-item-text">引用选中文本</text>
      </view>
      <view class="menu-item flex-row align-center" @click="copySelectedPreviewText">
        <AppIcon name="copy" :size="14" color="var(--color-text-secondary)" />
        <text class="menu-item-text">复制选中文本</text>
      </view>
    </view>
    
    <view
      v-if="showContextMenu && hasSelection"
      class="context-menu-backdrop"
      @click="hidePreviewSelectionMenu"
      @contextmenu.prevent="hidePreviewSelectionMenu"
    />
  </view>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import mammoth from 'mammoth/mammoth.browser';
import JSZip from 'jszip';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import AppIcon from '../common/AppIcon.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import {
  normalizeWorkspaceArtifactPath,
  previewContentOrEmpty,
  resolvePreviewFileSource
} from '@/services/native-im/file-preview';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const HTML_SELECTION_MESSAGE_SOURCE = 'agenthub-file-preview-selection';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  file: {
    type: Object,
    default: () => ({})
  },
  embedded: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'quote-selection']);

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true
})
  .use(markdownMathPlugin)
  .use(markdownTaskListPlugin);

const defaultMarkdownImageRenderer = markdown.renderer.rules.image;
markdown.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet('src') || '';
  token.attrSet('src', resolveMarkdownImageUrl(src));
  token.attrSet('loading', 'lazy');
  token.attrSet('decoding', 'async');
  return defaultMarkdownImageRenderer
    ? defaultMarkdownImageRenderer(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

const bundledAssetUrls = import.meta.glob('/assets/*', {
  query: '?url',
  import: 'default',
  eager: true
});

const isDownloading = ref(false);
const isDownloaded = ref(false);
const progress = ref(0);

// HTML / Markdown 预览模式切换：true=渲染效果，false=查看源码
const showRender = ref(true);

// 异步拉取的源文件内容
const fetchedContent = ref('');
const docxHtmlContent = ref('');
const sourceLoadError = ref('');
const isLoadingSource = ref(false);
const isImageLoading = ref(false);
const imageLoadError = ref(false);
let sourceLoadId = 0;

// 代码右键菜单状态
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const previewBodyRef = ref(null);
const selectedPreviewText = ref('');
const selectedPreviewMode = ref('text');

// PPT 播放页索引
const activeSlideIdx = ref(0);
const pptSlides = ref([]);
const isPresentationFullscreen = ref(false);
const presentationPdfUrl = ref('');
const presentationPdfPageImage = ref('');
const presentationPdfPage = ref(1);
const presentationPdfPageCount = ref(0);
const presentationPdfRenderError = ref('');
const isLoadingPresentationPdf = ref(false);
const isPresentationPdfFullscreen = ref(false);
let presentationPdfDocument = null;
let presentationPdfRenderId = 0;

// Excel Sheet 标签索引与数据
const activeSheetIdx = ref(0);
const sheetsData = ref([]);

// Excel 单元格双击编辑
const editingCell = ref({ row: -1, col: -1, val: '' });

const normalizedFile = computed(() => {
  return resolvePreviewFileSource(props.file || {});
});

const extension = computed(() => {
  const name = normalizedFile.value.name;
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
});

const fileTypeTheme = computed(() => {
  const ext = extension.value;
  if (['doc', 'docx'].includes(ext)) {
    return {
      bg: 'rgba(37, 99, 235, 0.08)',
      color: '#2563eb',
      icon: 'files'
    };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      bg: 'rgba(22, 163, 74, 0.08)',
      color: '#16a34a',
      icon: 'files'
    };
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return {
      bg: 'rgba(234, 88, 12, 0.08)',
      color: '#ea580c',
      icon: 'files'
    };
  }
  if (['pdf'].includes(ext)) {
    return {
      bg: 'rgba(220, 38, 38, 0.08)',
      color: '#dc2626',
      icon: 'files'
    };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      bg: 'rgba(168, 85, 247, 0.08)',
      color: '#a855f7',
      icon: 'files'
    };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return {
      bg: 'rgba(6, 182, 212, 0.08)',
      color: '#06b6d4',
      icon: 'image'
    };
  }
  return {
    bg: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    icon: 'files'
  };
});

const previewKind = computed(() => {
  const type = normalizedFile.value.type;
  if (['md', 'markdown'].includes(type)) return 'markdown';
  if (['html', 'htm'].includes(type)) return 'html';
  if (type === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(type)) return 'word';
  if (['ppt', 'pptx'].includes(type)) return 'presentation';
  if (['xls', 'xlsx', 'csv'].includes(type)) return 'sheet';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(type)) return 'image';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(type)) return 'archive';
  if (['txt', 'text', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'less', 'scss', 'vue', 'py', 'java', 'cpp', 'c', 'go', 'sql', 'sh', 'xml', 'yaml', 'yml'].includes(type)) return 'code';
  return 'fallback';
});

// 监控 props.file 初始化 showRender 变量，HTML 默认源码（false），Markdown 默认渲染（true）
watch(() => props.file, (newFile) => {
  hidePreviewSelectionMenu();
  if (newFile) {
    const rawType = newFile.fileType || newFile.ext || newFile.type || getTypeFromName(newFile.name || newFile.fileName || '');
    const detectedType = String(rawType || 'file').toLowerCase();
    showRender.value = !['html', 'htm'].includes(detectedType);
    loadSourceFileContent();
  }
}, { immediate: true });

watch([previewKind, showRender], () => {
  hidePreviewSelectionMenu();
});

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleHtmlPreviewSelectionMessage);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('selectionchange', handlePreviewSelectionCacheChange);
    document.addEventListener('contextmenu', handlePreviewDocumentContextMenu, true);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleHtmlPreviewSelectionMessage);
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('selectionchange', handlePreviewSelectionCacheChange);
    document.removeEventListener('contextmenu', handlePreviewDocumentContextMenu, true);
  }
});

// 异步拉取本地 assets 下的文件正文
async function loadSourceFileContent() {
  const loadId = ++sourceLoadId;
  const name = normalizedFile.value.name;
  fetchedContent.value = '';
  docxHtmlContent.value = '';
  sheetsData.value = [];
  pptSlides.value = [];
  resetPresentationPdfState();
  isPresentationFullscreen.value = false;
  activeSheetIdx.value = 0;
  activeSlideIdx.value = 0;
  editingCell.value = { row: -1, col: -1, val: '' };
  sourceLoadError.value = '';
  imageLoadError.value = false;
  if (!name) return;

  // 图片、pdf、压缩包和未知类型不做正文加载
  if (['image', 'pdf', 'archive', 'fallback'].includes(previewKind.value)) {
    return;
  }

  if (normalizedFile.value.content && ['markdown', 'html', 'code'].includes(previewKind.value)) {
    fetchedContent.value = normalizedFile.value.content;
    return;
  }

  isLoadingSource.value = true;
  const fileUrl = resolveFileUrl(name);

  try {
    if (!fileUrl) {
      throw new Error(`No preview source for ${name}`);
    }

    if (previewKind.value === 'word') {
      await loadDocxContent(fileUrl, loadId);
      return;
    }

    if (previewKind.value === 'sheet') {
      await loadSpreadsheetContent(fileUrl, loadId);
      return;
    }

    if (previewKind.value === 'presentation') {
      await loadPresentationContent(fileUrl, loadId);
      return;
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Preview source returned ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') && previewKind.value !== 'html') {
      throw new Error('Preview source resolved to an HTML fallback');
    }

    const text = await response.text();
    if (loadId === sourceLoadId) {
      fetchedContent.value = text;
    }
  } catch (err) {
    console.error('Failed to fetch local assets file:', err);
    if (loadId === sourceLoadId) {
      sourceLoadError.value = err?.message || 'Failed to load preview source';
      fetchedContent.value = '';
      docxHtmlContent.value = '';
    }
  } finally {
    if (loadId === sourceLoadId) {
      isLoadingSource.value = false;
    }
  }
}

async function loadDocxContent(fileUrl, loadId) {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`DOCX source returned ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('DOCX source resolved to an HTML fallback');
  }

  const arrayBuffer = await response.arrayBuffer();
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }, getDocxConvertOptions()),
    mammoth.extractRawText({ arrayBuffer })
  ]);

  if (loadId !== sourceLoadId) return;

  docxHtmlContent.value = htmlResult.value || '';
  fetchedContent.value = textResult.value || stripHtml(htmlResult.value || '');
}

function getDocxConvertOptions() {
  return {
    includeDefaultStyleMap: true,
    includeEmbeddedStyleMap: false,
    externalFileAccess: false,
    ignoreEmptyParagraphs: true,
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name^='Heading 1'] => h1:fresh",
      "p[style-name^='Heading 2'] => h2:fresh",
      "p[style-name^='Heading 3'] => h3:fresh"
    ]
  };
}

async function loadSpreadsheetContent(fileUrl, loadId) {
  const type = extension.value || normalizedFile.value.type;

  if (type === 'xls') {
    throw new Error('旧版 .xls 二进制表格暂不支持在线解析，请下载后用本地办公软件查看');
  }

  if (type === 'csv') {
    const text = await fetchTextPreviewSource(fileUrl, 'CSV');
    if (loadId !== sourceLoadId) return;
    applySpreadsheetSheets([
      {
        name: 'CSV',
        rows: normalizeSheetRows(parseDelimitedText(text))
      }
    ], loadId);
    return;
  }

  const arrayBuffer = await fetchArrayBufferPreviewSource(fileUrl, 'XLSX');
  const sheets = await parseXlsxWorkbook(arrayBuffer);
  applySpreadsheetSheets(sheets, loadId);
}

async function loadPresentationContent(fileUrl, loadId) {
  const type = extension.value || normalizedFile.value.type;

  if (type === 'ppt') {
    throw new Error('旧版 .ppt 二进制演示文稿暂不支持在线解析，请下载后用本地办公软件查看');
  }

  if (type !== 'pptx') {
    if (normalizedFile.value.content) {
      applyPresentationSlides(parseTextSlides(normalizedFile.value.content), loadId);
      return;
    }
    throw new Error('当前演示文稿格式暂不支持在线解析');
  }

  const convertedPdfUrl = resolvePresentationPdfUrl(normalizedFile.value.name);
  if (convertedPdfUrl) {
    await loadPresentationPdfContent(convertedPdfUrl, loadId);
    return;
  }

  const arrayBuffer = await fetchArrayBufferPreviewSource(fileUrl, 'PPTX');
  const slides = await parsePptxDeck(arrayBuffer);
  applyPresentationSlides(slides, loadId);
}

async function loadPresentationPdfContent(pdfUrl, loadId) {
  if (loadId !== sourceLoadId) return;

  presentationPdfUrl.value = pdfUrl;
  presentationPdfPage.value = 1;
  presentationPdfPageCount.value = 0;
  presentationPdfPageImage.value = '';
  presentationPdfRenderError.value = '';
  isLoadingPresentationPdf.value = true;

  try {
    const loadTask = pdfjsLib.getDocument({
      url: pdfUrl
    });
    const pdfDocument = await loadTask.promise;

    if (loadId !== sourceLoadId || presentationPdfUrl.value !== pdfUrl) {
      await destroyPdfDocument(pdfDocument);
      return;
    }

    presentationPdfDocument = pdfDocument;
    presentationPdfPageCount.value = pdfDocument.numPages || 0;
    fetchedContent.value = `已加载转换后的 PDF 预览：${normalizedFile.value.name}.pdf`;

    await renderPresentationPdfPage(loadId);
  } catch (err) {
    if (loadId === sourceLoadId) {
      presentationPdfPageImage.value = '';
      presentationPdfRenderError.value = err?.message || '转换后的 PDF 暂时无法加载';
      isLoadingPresentationPdf.value = false;
    }
  }
}

async function renderPresentationPdfPage(loadId = sourceLoadId) {
  if (!presentationPdfDocument) return;

  const renderId = ++presentationPdfRenderId;
  const pageNumber = clampPresentationPdfPage(presentationPdfPage.value);
  presentationPdfPage.value = pageNumber;
  isLoadingPresentationPdf.value = true;
  presentationPdfRenderError.value = '';

  try {
    if (typeof document === 'undefined') {
      throw new Error('当前环境不支持 PDF 画布渲染');
    }

    const page = await presentationPdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = isPresentationPdfFullscreen.value ? 1920 : 1440;
    const renderScale = Math.max(1, Math.min(3, targetWidth / baseViewport.width));
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('当前浏览器无法创建 PDF 渲染画布');
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    if (renderId !== presentationPdfRenderId || loadId !== sourceLoadId) return;

    presentationPdfPageImage.value = canvas.toDataURL('image/png');
    page.cleanup?.();
  } catch (err) {
    if (renderId === presentationPdfRenderId && loadId === sourceLoadId) {
      presentationPdfPageImage.value = '';
      presentationPdfRenderError.value = err?.message || '转换后的 PDF 暂时无法渲染';
    }
  } finally {
    if (renderId === presentationPdfRenderId && loadId === sourceLoadId) {
      isLoadingPresentationPdf.value = false;
    }
  }
}

function resetPresentationPdfState() {
  presentationPdfRenderId += 1;
  presentationPdfUrl.value = '';
  presentationPdfPageImage.value = '';
  presentationPdfPage.value = 1;
  presentationPdfPageCount.value = 0;
  presentationPdfRenderError.value = '';
  isLoadingPresentationPdf.value = false;
  isPresentationPdfFullscreen.value = false;

  if (presentationPdfDocument) {
    const oldDocument = presentationPdfDocument;
    presentationPdfDocument = null;
    void destroyPdfDocument(oldDocument);
  }
}

async function destroyPdfDocument(pdfDocument) {
  try {
    await pdfDocument?.destroy?.();
  } catch (err) {
    console.warn('Failed to destroy PDF document:', err);
  }
}

function clampPresentationPdfPage(pageNumber) {
  const total = presentationPdfPageCount.value || 1;
  return Math.min(total, Math.max(1, Number(pageNumber) || 1));
}

async function fetchArrayBufferPreviewSource(fileUrl, label) {
  const response = await fetch(fileUrl);
  assertPreviewResponse(response, label);
  return response.arrayBuffer();
}

async function fetchTextPreviewSource(fileUrl, label) {
  const response = await fetch(fileUrl);
  assertPreviewResponse(response, label);
  return response.text();
}

function assertPreviewResponse(response, label) {
  if (!response.ok) {
    throw new Error(`${label} source returned ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(`${label} source resolved to an HTML fallback`);
  }
}

function applySpreadsheetSheets(sheets, loadId) {
  if (loadId !== sourceLoadId) return;

  const normalizedSheets = sheets
    .map((sheet, index) => ({
      name: sheet.name || `Sheet${index + 1}`,
      rows: normalizeSheetRows(sheet.rows || [])
    }))
    .filter(sheet => sheet.rows.length);

  sheetsData.value = normalizedSheets;
  fetchedContent.value = stringifyWorkbookForCopy(normalizedSheets);
}

function applyPresentationSlides(slides, loadId) {
  if (loadId !== sourceLoadId) return;

  pptSlides.value = slides.map((slide, index) => ({
    ...slide,
    id: slide.id || `slide-${index + 1}`,
    index: index + 1,
    title: slide.title || `幻灯片 ${index + 1}`,
    elements: slide.elements || []
  }));
  fetchedContent.value = stringifySlidesForCopy(pptSlides.value);
}

function resolveFileUrl(name) {
  if (normalizedFile.value.url) {
    return normalizedFile.value.url;
  }

  if (isWorkspaceBackedFile(props.file || {})) {
    return '';
  }

  const bundledUrl = getBundledAssetUrl(name);
  if (bundledUrl) {
    return bundledUrl;
  }

  return `/assets/${encodeURIComponent(name)}`;
}

function isWorkspaceBackedFile(file = {}) {
  return Boolean(
    file.generatedByAgent
    || file.source === 'clowder'
    || file.worktreeId
    || file.worktree_id
    || file.workspacePath
    || file.workspace_path
    || file.relativePath
    || file.relative_path
    || normalizeWorkspaceArtifactPath(file.path)
  );
}

function resolveImagePreviewUrl() {
  const source = props.file || {};
  const candidates = [
    normalizedFile.value.url,
    source.previewUrl,
    source.imageUrl,
    source.src,
    source.path,
    source.thumbUrl,
    source.thumbnail,
    source.previewImage,
    normalizedFile.value.content,
    source.previewContent,
    source.contentText,
    source.text,
    source.content,
    normalizedFile.value.name
  ];

  for (const candidate of candidates) {
    const resolved = normalizeImageSource(candidate);
    if (resolved) return resolved;
  }

  return '';
}

function normalizeImageSource(value) {
  const rawSrc = String(value || '').trim();
  if (!rawSrc || /^javascript:/i.test(rawSrc)) return '';
  if (/^data:image\//i.test(rawSrc) || /^(https?:|blob:|file:)/i.test(rawSrc)) return rawSrc;
  if (/^data:/i.test(rawSrc)) return '';
  if (rawSrc.startsWith('/static/')) return rawSrc;

  const suffixStart = rawSrc.search(/[?#]/);
  const pathPart = suffixStart >= 0 ? rawSrc.slice(0, suffixStart) : rawSrc;
  const suffix = suffixStart >= 0 ? rawSrc.slice(suffixStart) : '';
  const normalizedPath = pathPart.replace(/\\/g, '/').replace(/^\.?\//, '');
  const assetName = normalizedPath.split('/').pop();
  if (!isSupportedImageName(assetName)) return '';

  const bundledUrl = getBundledAssetUrl(assetName);
  if (bundledUrl) return `${bundledUrl}${suffix}`;

  if (rawSrc.startsWith('/')) {
    return rawSrc;
  }

  if (normalizedPath.startsWith('assets/')) {
    return `/${normalizedPath.split('/').map(encodeURIComponent).join('/')}${suffix}`;
  }

  return `/assets/${encodeURIComponent(assetName)}${suffix}`;
}

function isSupportedImageName(name) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(String(name || ''));
}

function resolvePresentationPdfUrl(name) {
  const normalizedName = String(name || '').replace(/\\/g, '/').split('/').pop();
  const withoutExtension = normalizedName.replace(/\.[^.]+$/, '');
  return getBundledAssetUrl(`${normalizedName}.pdf`)
    || getBundledAssetUrl(`${withoutExtension}.pdf`)
    || '';
}

function getBundledAssetUrl(name) {
  const targetName = normalizeAssetName(name);
  const entry = Object.entries(bundledAssetUrls).find(([path]) => {
    const assetName = normalizeAssetName(path.split('/').pop());
    return assetName === targetName;
  });
  return entry ? entry[1] : '';
}

function normalizeAssetName(name) {
  return decodeURIComponent(String(name || '').replace(/\\/g, '/').split('/').pop()).toLowerCase();
}

function resolveMarkdownImageUrl(src) {
  const rawSrc = String(src || '').trim();
  if (!rawSrc) return '';
  if (/^(https?:|data:|blob:|file:)/i.test(rawSrc)) return rawSrc;
  if (/^javascript:/i.test(rawSrc)) return '#';
  if (rawSrc.startsWith('/static/')) return rawSrc;

  const suffixStart = rawSrc.search(/[?#]/);
  const pathPart = suffixStart >= 0 ? rawSrc.slice(0, suffixStart) : rawSrc;
  const suffix = suffixStart >= 0 ? rawSrc.slice(suffixStart) : '';
  const normalizedPath = pathPart.replace(/\\/g, '/').replace(/^\.?\//, '');
  const assetName = normalizedPath.split('/').pop();
  const bundledUrl = getBundledAssetUrl(assetName);
  if (bundledUrl) return `${bundledUrl}${suffix}`;

  if (normalizedPath.startsWith('assets/')) {
    return `/${normalizedPath.split('/').map(encodeURIComponent).join('/')}${suffix}`;
  }

  if (rawSrc.startsWith('/assets/')) {
    return rawSrc;
  }

  return `/assets/${encodeURIComponent(assetName)}${suffix}`;
}

function markdownMathPlugin(md) {
  md.block.ruler.before('paragraph', 'math_block', markdownMathBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  });
  md.inline.ruler.before('escape', 'math_inline', markdownMathInlineRule);
  md.renderer.rules.math_block = (tokens, idx) => {
    return `<section class="markdown-math-block">${renderMath(tokens[idx].content, true)}</section>\n`;
  };
  md.renderer.rules.math_inline = (tokens, idx) => {
    return renderMath(tokens[idx].content, false);
  };
}

function markdownTaskListPlugin(md) {
  md.core.ruler.after('inline', 'task_list', (state) => {
    const tokens = state.tokens;

    for (let idx = 0; idx < tokens.length; idx += 1) {
      const inlineToken = tokens[idx];
      if (inlineToken.type !== 'inline' || !inlineToken.content) continue;

      const match = inlineToken.content.match(/^\s*\[([ xX])\]\s+/);
      if (!match) continue;

      const listItemToken = findPreviousToken(tokens, idx, 'list_item_open');
      if (!listItemToken) continue;

      const checked = match[1].toLowerCase() === 'x';
      listItemToken.attrJoin('class', 'task-list-item');
      removeInlinePrefix(inlineToken, match[0].length);
      inlineToken.children.unshift(createHtmlInlineToken(
        `<input class="task-list-checkbox" type="checkbox" disabled${checked ? ' checked' : ''} aria-label="${checked ? '已完成' : '未完成'}" />`,
        inlineToken.level
      ));
    }
  });
}

function findPreviousToken(tokens, startIndex, type) {
  for (let idx = startIndex - 1; idx >= 0; idx -= 1) {
    if (tokens[idx].type === type) return tokens[idx];
    if (tokens[idx].type.endsWith('_close')) break;
  }
  return null;
}

function removeInlinePrefix(inlineToken, length) {
  inlineToken.content = inlineToken.content.slice(length);
  if (!inlineToken.children?.length) return;

  let remaining = length;
  inlineToken.children = inlineToken.children.filter((child) => {
    if (remaining <= 0 || child.type !== 'text') return true;

    if (child.content.length <= remaining) {
      remaining -= child.content.length;
      return false;
    }

    child.content = child.content.slice(remaining);
    remaining = 0;
    return true;
  });
}

function createHtmlInlineToken(content, level) {
  return {
    type: 'html_inline',
    tag: '',
    attrs: null,
    map: null,
    nesting: 0,
    level,
    children: null,
    content,
    markup: '',
    info: '',
    meta: null,
    block: false,
    hidden: false
  };
}

function markdownMathBlockRule(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];

  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.src.slice(start, start + 2) !== '$$') return false;

  if (silent) return true;

  const firstLine = state.src.slice(start + 2, max);
  const firstLineTrimmed = firstLine.trim();
  let nextLine = startLine + 1;
  let content = '';

  if (firstLineTrimmed.endsWith('$$') && firstLineTrimmed.length > 2) {
    content = firstLineTrimmed.slice(0, -2).trim();
  } else {
    const lines = firstLineTrimmed ? [firstLine] : [];
    let foundClosing = false;

    for (; nextLine < endLine; nextLine += 1) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const lineMax = state.eMarks[nextLine];
      const line = state.src.slice(lineStart, lineMax);
      const closingIndex = line.lastIndexOf('$$');

      if (closingIndex >= 0 && line.slice(closingIndex + 2).trim() === '') {
        const beforeClosing = line.slice(0, closingIndex);
        if (beforeClosing.trim()) lines.push(beforeClosing);
        foundClosing = true;
        break;
      }

      lines.push(line);
    }

    if (!foundClosing) return false;
    content = lines.join('\n').trim();
    nextLine += 1;
  }

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = content;
  token.map = [startLine, nextLine];
  state.line = nextLine;
  return true;
}

function markdownMathInlineRule(state, silent) {
  const marker = state.src.startsWith('$$', state.pos) ? '$$' : '$';
  if (state.src[state.pos] !== '$') return false;

  const start = state.pos + marker.length;
  const end = findClosingMathDelimiter(state.src, start, marker);
  if (end < 0) return false;

  const content = state.src.slice(start, end).trim();
  if (!content || content.includes('\n')) return false;

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.content = content;
  }

  state.pos = end + marker.length;
  return true;
}

function findClosingMathDelimiter(src, start, marker) {
  let cursor = start;
  while (cursor < src.length) {
    const next = src.indexOf(marker, cursor);
    if (next < 0) return -1;
    if (src[next - 1] !== '\\') return next;
    cursor = next + marker.length;
  }
  return -1;
}

function renderMath(content, displayMode) {
  try {
    return katex.renderToString(content, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml'
    });
  } catch (err) {
    return `<code class="markdown-math-error">${escapeHtml(content)}</code>`;
  }
}

async function parseXlsxWorkbook(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const workbookFile = zip.file('xl/workbook.xml');
  if (!workbookFile) {
    throw new Error('XLSX workbook.xml not found');
  }

  const workbookXml = await workbookFile.async('string');
  const workbookDoc = parseXmlDocument(workbookXml, 'workbook.xml');
  const workbookRels = await parseZipRelationships(zip, 'xl/_rels/workbook.xml.rels', 'xl');
  const sharedStrings = await parseXlsxSharedStrings(zip);
  const styles = await parseXlsxStyles(zip);
  const sheetNodes = localElements(workbookDoc, 'sheet');
  const sheets = [];

  for (const [index, sheetNode] of sheetNodes.entries()) {
    const relId = getRelationshipId(sheetNode);
    const relTarget = relId ? workbookRels[relId]?.target : '';
    const fallbackTarget = `xl/worksheets/sheet${index + 1}.xml`;
    const sheetPath = relTarget || fallbackTarget;
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) continue;

    const sheetXml = await sheetFile.async('string');
    const sheetDoc = parseXmlDocument(sheetXml, sheetPath);
    sheets.push({
      name: sheetNode.getAttribute('name') || `Sheet${index + 1}`,
      rows: parseXlsxSheetRows(sheetDoc, sharedStrings, styles)
    });
  }

  return sheets;
}

async function parseXlsxSharedStrings(zip) {
  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  if (!sharedStringsFile) return [];

  const sharedStringsXml = await sharedStringsFile.async('string');
  const sharedStringsDoc = parseXmlDocument(sharedStringsXml, 'sharedStrings.xml');
  return localElements(sharedStringsDoc, 'si').map(item => collectXmlText(item));
}

async function parseXlsxStyles(zip) {
  const stylesFile = zip.file('xl/styles.xml');
  if (!stylesFile) return [];

  const stylesXml = await stylesFile.async('string');
  const stylesDoc = parseXmlDocument(stylesXml, 'styles.xml');
  const customFormats = new Map();
  localElements(stylesDoc, 'numFmt').forEach(numFmt => {
    customFormats.set(numFmt.getAttribute('numFmtId'), numFmt.getAttribute('formatCode') || '');
  });

  const cellXfs = localElements(stylesDoc, 'cellXfs')[0];
  if (!cellXfs) return [];

  return childElements(cellXfs, 'xf').map(xf => {
    const numFmtId = xf.getAttribute('numFmtId') || '';
    return {
      numFmtId,
      formatCode: customFormats.get(numFmtId) || getBuiltInNumberFormat(numFmtId)
    };
  });
}

function parseXlsxSheetRows(sheetDoc, sharedStrings, styles) {
  const rows = [];
  localElements(sheetDoc, 'row').forEach((rowNode, rowOrder) => {
    const rowIndex = Math.max(0, Number(rowNode.getAttribute('r') || rowOrder + 1) - 1);
    const row = rows[rowIndex] || [];

    childElements(rowNode, 'c').forEach(cellNode => {
      const cellRef = cellNode.getAttribute('r') || '';
      const colIndex = columnIndexFromCellRef(cellRef);
      row[colIndex] = getXlsxCellValue(cellNode, sharedStrings, styles);
    });

    rows[rowIndex] = row;
  });

  return normalizeSheetRows(rows);
}

function getXlsxCellValue(cellNode, sharedStrings, styles) {
  const type = cellNode.getAttribute('t') || '';
  const rawValue = getDirectText(cellNode, 'v');

  if (type === 's') {
    return sharedStrings[Number(rawValue)] || '';
  }

  if (type === 'inlineStr') {
    const inlineString = childElements(cellNode, 'is')[0];
    return inlineString ? collectXmlText(inlineString) : '';
  }

  if (type === 'b') {
    return rawValue === '1' ? 'TRUE' : 'FALSE';
  }

  if (type === 'str' || type === 'e') {
    return rawValue || '';
  }

  if (rawValue === '') {
    return '';
  }

  const styleIndex = Number(cellNode.getAttribute('s'));
  const style = Number.isFinite(styleIndex) ? styles[styleIndex] : null;
  if (style && isDateNumberFormat(style.numFmtId, style.formatCode)) {
    const dateText = formatExcelDate(Number(rawValue));
    if (dateText) return dateText;
  }

  return rawValue;
}

function parseDelimitedText(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return normalizeSheetRows(rows);
}

function detectDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/, 1)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  if (tabCount > commaCount && tabCount >= semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

async function parsePptxDeck(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const presentationFile = zip.file('ppt/presentation.xml');
  if (!presentationFile) {
    throw new Error('PPTX presentation.xml not found');
  }

  const presentationXml = await presentationFile.async('string');
  const presentationDoc = parseXmlDocument(presentationXml, 'presentation.xml');
  const slideSize = parsePptSlideSize(presentationDoc);
  const presentationRels = await parseZipRelationships(zip, 'ppt/_rels/presentation.xml.rels', 'ppt');
  const slidePaths = localElements(presentationDoc, 'sldId')
    .map(slideId => presentationRels[getRelationshipId(slideId)]?.target)
    .filter(Boolean);

  const orderedSlidePaths = slidePaths.length ? slidePaths : Object.keys(zip.files)
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((left, right) => Number(left.match(/slide(\d+)/)?.[1] || 0) - Number(right.match(/slide(\d+)/)?.[1] || 0));

  const slides = [];
  for (const [index, slidePath] of orderedSlidePaths.entries()) {
    const slideFile = zip.file(slidePath);
    if (!slideFile) continue;

    const slideXml = await slideFile.async('string');
    const slideDir = slidePath.split('/').slice(0, -1).join('/');
    const slideName = slidePath.split('/').pop();
    const slideRelsPath = `${slideDir}/_rels/${slideName}.rels`;
    const slideRels = await parseZipRelationships(zip, slideRelsPath, slideDir);
    slides.push(await parsePptxSlide(zip, slideXml, slideRels, slideSize, index, slidePath));
  }

  return slides;
}

async function parsePptxSlide(zip, slideXml, slideRels, slideSize, index, slidePath) {
  const slideDoc = parseXmlDocument(slideXml, slidePath);
  const elements = [];
  let background = extractPptBackground(slideDoc) || '#ffffff';
  const drawableRoot = localElements(slideDoc, 'spTree')[0] || slideDoc;
  const drawableNodes = Array.from(drawableRoot.getElementsByTagName('*'))
    .filter(node => ['sp', 'pic', 'graphicFrame'].includes(node.localName));

  for (const node of drawableNodes) {
    if (node.localName === 'pic') {
      const imageElement = await parsePptImageElement(zip, node, slideRels, slideSize);
      if (imageElement) elements.push(imageElement);
      continue;
    }

    if (node.localName === 'graphicFrame') {
      const tableElement = parsePptTableElement(node, slideSize);
      if (tableElement) elements.push(tableElement);
      continue;
    }

    const shapeElement = parsePptShapeElement(node, slideSize, elements.length);
    if (!shapeElement) continue;

    if (shapeElement.type === 'shape' && isFullSlideGeometry(shapeElement.geometry)) {
      background = shapeElement.fill || background;
      continue;
    }

    elements.push(shapeElement);
  }

  const textItems = elements
    .filter(element => element.type === 'text')
    .map(element => element.text)
    .filter(Boolean);

  return {
    id: slidePath,
    index: index + 1,
    title: textItems[0] || `幻灯片 ${index + 1}`,
    background,
    elements
  };
}

function parsePptShapeElement(shapeNode, slideSize, fallbackIndex) {
  const text = extractPptText(shapeNode);
  const geometry = parsePptGeometry(shapeNode, slideSize, fallbackIndex);
  const fill = extractPptSolidFill(firstElementByLocalName(shapeNode, 'spPr'));
  const textStyle = extractPptTextStyle(shapeNode);

  if (!text && fill) {
    return {
      type: 'shape',
      fill,
      geometry,
      style: {
        ...geometryToStyle(geometry),
        backgroundColor: fill
      }
    };
  }

  if (!text) return null;

  const role = getPptPlaceholderRole(shapeNode, geometry, textStyle);
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  return {
    type: 'text',
    role,
    text,
    lines: lines.length ? lines : [text],
    geometry,
    style: {
      ...geometryToStyle(geometry),
      color: textStyle.color || getReadableTextColor(fill),
      fontSize: textStyle.fontSize || pptFontSizeCss(role === 'title' ? 28 : 14),
      fontWeight: textStyle.bold || role === 'title' ? '700' : '500',
      textAlign: textStyle.align || (role === 'title' ? 'center' : 'left'),
      backgroundColor: fill && fill !== 'transparent' ? fill : 'transparent'
    }
  };
}

async function parsePptImageElement(zip, picNode, slideRels, slideSize) {
  const blip = firstElementByLocalName(picNode, 'blip');
  const relId = blip ? getRelationshipId(blip, 'embed') : '';
  const mediaPath = relId ? slideRels[relId]?.target : '';
  const mediaFile = mediaPath ? zip.file(mediaPath) : null;
  if (!mediaFile) return null;

  const geometry = parsePptGeometry(picNode, slideSize);
  const base64 = await mediaFile.async('base64');
  return {
    type: 'image',
    src: `data:${getMimeTypeFromPath(mediaPath)};base64,${base64}`,
    geometry,
    style: geometryToStyle(geometry)
  };
}

function parsePptTableElement(frameNode, slideSize) {
  const tableNode = firstElementByLocalName(frameNode, 'tbl');
  if (!tableNode) return null;

  const rows = childElements(tableNode, 'tr').map(rowNode => {
    return childElements(rowNode, 'tc').map(cellNode => collectXmlText(cellNode).trim());
  }).filter(row => row.some(Boolean));

  if (!rows.length) return null;

  const geometry = parsePptGeometry(frameNode, slideSize);
  return {
    type: 'table',
    rows,
    geometry,
    style: geometryToStyle(geometry)
  };
}

function parseTextSlides(content) {
  return String(content || '')
    .split(/\n{2,}/)
    .map((block, index) => {
      const lines = block.split(/\n+/).map(line => line.trim()).filter(Boolean);
      return {
        id: `text-slide-${index + 1}`,
        index: index + 1,
        title: lines[0] || `幻灯片 ${index + 1}`,
        background: '#ffffff',
        elements: lines.length ? [{
          type: 'text',
          role: 'title',
          text: lines.join('\n'),
          lines,
          style: {
            left: '8%',
            top: '12%',
            width: '84%',
            height: '76%',
            color: '#111827',
            fontSize: '18px',
            fontWeight: '700',
            textAlign: 'center',
            backgroundColor: 'transparent'
          }
        }] : []
      };
    })
    .filter(slide => slide.elements.length);
}

async function parseZipRelationships(zip, relPath, baseDir) {
  const relFile = zip.file(relPath);
  if (!relFile) return {};

  const relXml = await relFile.async('string');
  const relDoc = parseXmlDocument(relXml, relPath);
  return localElements(relDoc, 'Relationship').reduce((map, relNode) => {
    const id = relNode.getAttribute('Id');
    const target = relNode.getAttribute('Target') || '';
    if (id && target) {
      map[id] = {
        target: resolveZipPath(baseDir, target),
        type: relNode.getAttribute('Type') || ''
      };
    }
    return map;
  }, {});
}

function parsePptSlideSize(presentationDoc) {
  const slideSize = localElements(presentationDoc, 'sldSz')[0];
  return {
    width: Number(slideSize?.getAttribute('cx')) || 12192000,
    height: Number(slideSize?.getAttribute('cy')) || 6858000
  };
}

function parsePptGeometry(node, slideSize, fallbackIndex = 0) {
  const transform = firstElementByLocalName(node, 'xfrm');
  const offset = transform ? firstElementByLocalName(transform, 'off') : null;
  const ext = transform ? firstElementByLocalName(transform, 'ext') : null;

  if (!offset || !ext) {
    return {
      left: 10,
      top: 10 + fallbackIndex * 12,
      width: 80,
      height: 10
    };
  }

  return {
    left: emuToPercent(offset.getAttribute('x'), slideSize.width),
    top: emuToPercent(offset.getAttribute('y'), slideSize.height),
    width: emuToPercent(ext.getAttribute('cx'), slideSize.width),
    height: emuToPercent(ext.getAttribute('cy'), slideSize.height)
  };
}

function extractPptBackground(slideDoc) {
  const background = firstElementByLocalName(slideDoc, 'bgPr');
  return extractPptSolidFill(background);
}

function extractPptSolidFill(rootNode) {
  if (!rootNode || firstElementByLocalName(rootNode, 'noFill')) return '';
  const solidFill = firstElementByLocalName(rootNode, 'solidFill');
  if (!solidFill) return '';

  const srgb = firstElementByLocalName(solidFill, 'srgbClr');
  if (srgb?.getAttribute('val')) {
    return `#${srgb.getAttribute('val')}`;
  }

  const scheme = firstElementByLocalName(solidFill, 'schemeClr');
  if (scheme?.getAttribute('val')) {
    return pptSchemeColor(scheme.getAttribute('val'));
  }

  return '';
}

function extractPptText(shapeNode) {
  const textBody = firstElementByLocalName(shapeNode, 'txBody');
  if (!textBody) return '';

  return childElements(textBody, 'p')
    .map(paragraph => collectXmlText(paragraph).trim())
    .filter(Boolean)
    .join('\n');
}

function extractPptTextStyle(shapeNode) {
  const runProps = firstElementByLocalName(shapeNode, 'rPr') || firstElementByLocalName(shapeNode, 'endParaRPr');
  const paragraphProps = firstElementByLocalName(shapeNode, 'pPr');
  const solidFill = runProps ? firstElementByLocalName(runProps, 'solidFill') : null;
  const srgb = solidFill ? firstElementByLocalName(solidFill, 'srgbClr') : null;
  const fontPoint = Number(runProps?.getAttribute('sz') || 0) / 100;

  return {
    color: srgb?.getAttribute('val') ? `#${srgb.getAttribute('val')}` : '',
    fontPoint,
    fontSize: fontPoint ? pptFontSizeCss(fontPoint) : '',
    bold: runProps?.getAttribute('b') === '1',
    align: normalizePptAlign(paragraphProps?.getAttribute('algn') || '')
  };
}

function getPptPlaceholderRole(shapeNode, geometry, textStyle) {
  const placeholder = firstElementByLocalName(shapeNode, 'ph');
  const type = placeholder?.getAttribute('type') || '';
  if (['title', 'ctrTitle', 'subTitle'].includes(type)) return 'title';
  if (geometry.top < 22 && (textStyle.fontPoint >= 20 || geometry.height > 8)) return 'title';
  return 'body';
}

function pptFontSizeCss(pointSize) {
  const point = Math.max(8, Number(pointSize) || 12);
  const viewportSize = Math.max(0.5, point * 0.072);
  const maxPixelSize = Math.max(9, point * 0.8);
  return `clamp(7px, ${viewportSize.toFixed(3)}vw, ${maxPixelSize.toFixed(1)}px)`;
}

function normalizePptAlign(value) {
  if (value === 'ctr') return 'center';
  if (value === 'r') return 'right';
  return value ? 'left' : '';
}

function geometryToStyle(geometry) {
  return {
    left: `${clampPercent(geometry.left)}%`,
    top: `${clampPercent(geometry.top)}%`,
    width: `${clampPercent(geometry.width)}%`,
    height: `${clampPercent(geometry.height)}%`
  };
}

function isFullSlideGeometry(geometry) {
  return geometry.left <= 1 && geometry.top <= 1 && geometry.width >= 98 && geometry.height >= 98;
}

function emuToPercent(value, base) {
  const number = Number(value || 0);
  return base ? number / base * 100 : 0;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function getReadableTextColor(fill) {
  if (!fill || fill === 'transparent') return '#111827';
  const hex = fill.replace('#', '');
  if (hex.length !== 6) return '#111827';
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance < 0.45 ? '#ffffff' : '#111827';
}

function pptSchemeColor(value) {
  const scheme = {
    bg1: '#ffffff',
    tx1: '#111827',
    bg2: '#f8fafc',
    tx2: '#334155',
    accent1: '#2563eb',
    accent2: '#16a34a',
    accent3: '#ea580c',
    accent4: '#7c3aed',
    accent5: '#0891b2',
    accent6: '#db2777'
  };
  return scheme[value] || '#111827';
}

function getMimeTypeFromPath(path) {
  const ext = String(path || '').split('.').pop()?.toLowerCase();
  const map = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml'
  };
  return map[ext] || 'application/octet-stream';
}

function parseXmlDocument(xmlText, label) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error(`${label} XML parse failed`);
  }
  return doc;
}

function localElements(root, localName) {
  if (!root) return [];
  const namespaced = Array.from(root.getElementsByTagNameNS?.('*', localName) || []);
  if (namespaced.length) return namespaced;
  return Array.from(root.getElementsByTagName?.(localName) || [])
    .filter(node => node.localName === localName || node.nodeName === localName);
}

function childElements(root, localName) {
  if (!root) return [];
  return Array.from(root.childNodes || [])
    .filter(node => node.nodeType === 1 && (node.localName === localName || node.nodeName === localName));
}

function firstElementByLocalName(root, localName) {
  return localElements(root, localName)[0] || null;
}

function getDirectText(root, localName) {
  return childElements(root, localName)[0]?.textContent || '';
}

function collectXmlText(root) {
  return localElements(root, 't').map(node => node.textContent || '').join('');
}

function getRelationshipId(node, attrName = 'id') {
  if (!node) return '';
  return node.getAttribute(`r:${attrName}`)
    || node.getAttribute(attrName)
    || Array.from(node.attributes || []).find(attr => attr.localName === attrName)?.value
    || '';
}

function resolveZipPath(baseDir, target) {
  if (!target) return '';
  if (target.startsWith('/')) return target.slice(1);

  const stack = String(baseDir || '').split('/').filter(Boolean);
  target.split('/').forEach(part => {
    if (!part || part === '.') return;
    if (part === '..') {
      stack.pop();
      return;
    }
    stack.push(part);
  });
  return stack.join('/');
}

function columnIndexFromCellRef(cellRef) {
  const letters = String(cellRef || '').match(/[A-Z]+/i)?.[0] || 'A';
  return letters.toUpperCase().split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function excelColumnLabel(index) {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function normalizeSheetRows(rows) {
  const normalizedRows = rows.map(row => {
    return (row || []).map(cell => String(cell ?? '').trim());
  });

  while (normalizedRows.length && !normalizedRows[normalizedRows.length - 1].some(Boolean)) {
    normalizedRows.pop();
  }

  return normalizedRows;
}

function stringifyWorkbookForCopy(sheets) {
  return sheets.map(sheet => {
    const rows = sheet.rows.map(row => row.join('\t')).join('\n');
    return `# ${sheet.name}\n${rows}`;
  }).join('\n\n');
}

function stringifySlidesForCopy(slides) {
  return slides.map(slide => {
    const text = slide.elements
      .filter(element => element.type === 'text')
      .map(element => element.text)
      .filter(Boolean)
      .join('\n');
    return `# ${slide.title}\n${text}`;
  }).join('\n\n');
}

function getBuiltInNumberFormat(numFmtId) {
  const builtIns = {
    14: 'm/d/yy',
    15: 'd-mmm-yy',
    16: 'd-mmm',
    17: 'mmm-yy',
    18: 'h:mm AM/PM',
    19: 'h:mm:ss AM/PM',
    20: 'h:mm',
    21: 'h:mm:ss',
    22: 'm/d/yy h:mm',
    45: 'mm:ss',
    46: '[h]:mm:ss',
    47: 'mmss.0'
  };
  return builtIns[numFmtId] || '';
}

function isDateNumberFormat(numFmtId, formatCode) {
  const builtInDateIds = new Set(['14', '15', '16', '17', '18', '19', '20', '21', '22', '45', '46', '47']);
  const normalizedCode = String(formatCode || '').replace(/\[[^\]]+]/g, '').toLowerCase();
  return builtInDateIds.has(String(numFmtId)) || /[ymdhsa]/.test(normalizedCode);
}

function formatExcelDate(value) {
  if (!Number.isFinite(value)) return '';
  const utcDays = Math.floor(value - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  if (Number.isNaN(date.getTime())) return '';

  const pad = number => String(number).padStart(2, '0');
  const dateText = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const seconds = Math.round((value - Math.floor(value)) * 86400);
  if (!seconds) return dateText;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${dateText} ${pad(hours)}:${pad(minutes)}`;
}

const previewContent = computed(() => {
  return previewContentOrEmpty({
    previewKind: previewKind.value,
    fetchedContent: fetchedContent.value,
    fileContent: normalizedFile.value.content
  });
});

const renderedMarkdown = computed(() => markdown.render(previewContent.value));

const sandboxedHtmlContent = computed(() => buildSandboxedHtmlContent(previewContent.value));
const safeWordHtmlContent = computed(() => sanitizeHtmlFragment(docxHtmlContent.value));
const imagePreviewUrl = computed(() => resolveImagePreviewUrl());

const imagePreviewEmptyDesc = computed(() => {
  if (imageLoadError.value) {
    return '图片地址无法加载，请检查源文件是否存在或链接是否可访问。';
  }
  return '当前文件没有可用的图片地址，可下载后在本地查看。';
});

watch(imagePreviewUrl, (url) => {
  imageLoadError.value = false;
  isImageLoading.value = Boolean(url);
}, { immediate: true });

const documentParagraphs = computed(() => {
  return previewContent.value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
});

const activeSlide = computed(() => pptSlides.value[activeSlideIdx.value] || null);

const presentationPdfPageLabel = computed(() => {
  if (!presentationPdfPageCount.value) return '正在加载';
  return `第 ${presentationPdfPage.value} / ${presentationPdfPageCount.value} 页`;
});

const presentationPdfPreviewError = computed(() => {
  return presentationPdfRenderError.value || sourceLoadError.value || '转换后的 PDF 暂时无法预览';
});

const activeSheet = computed(() => {
  return sheetsData.value[activeSheetIdx.value] || { name: '', rows: [] };
});

const activeSheetRows = computed(() => activeSheet.value.rows || []);

const activeSheetColumnCount = computed(() => {
  return Math.max(1, ...activeSheetRows.value.map(row => row.length));
});

const activeSheetColumnLabels = computed(() => {
  return Array.from({ length: activeSheetColumnCount.value }, (_, index) => excelColumnLabel(index));
});

const excelTableMinWidth = computed(() => {
  return `${42 + activeSheetColumnCount.value * 132}px`;
});

const sheetStatusText = computed(() => {
  const rows = activeSheetRows.value.length;
  const cols = activeSheetColumnCount.value;
  return `${rows} 行 ${cols} 列`;
});

const officePreviewEmptyDesc = computed(() => {
  if (sourceLoadError.value) {
    return sourceLoadError.value;
  }
  if (previewKind.value === 'presentation') {
    return '当前演示文稿没有可读取的幻灯片内容，请下载后用本地办公软件查看';
  }
  return '当前表格没有可读取的工作表内容，请下载后用本地办公软件查看';
});

// 代码行分割
const codeLines = computed(() => {
  const content = previewContent.value || '';
  return content.split('\n');
});

const typeLabel = computed(() => {
  const type = normalizedFile.value.type;
  if (['md', 'markdown'].includes(type)) return 'Markdown';
  if (type === 'pdf') return 'PDF 文档';
  if (['docx', 'doc'].includes(type)) return 'Word 文档';
  if (['xlsx', 'xls', 'csv'].includes(type)) return '表格';
  if (['pptx', 'ppt'].includes(type)) return '演示文稿';
  if (['html', 'htm'].includes(type)) return 'HTML 页面';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(type)) return '压缩包';
  if (previewKind.value === 'image') return '图片';
  if (previewKind.value === 'code') return '代码文件';
  return type ? type.toUpperCase() : '文件';
});

const wordPreviewEmptyDesc = computed(() => {
  if (sourceLoadError.value) {
    return '当前文档读取失败，可下载后用本地办公软件查看';
  }
  return '当前文档缺少可读取的正文内容，可下载后用本地办公软件查看';
});

const fallbackTitle = computed(() => {
  if (previewKind.value === 'archive') return '压缩包仅支持下载';
  return '暂不支持该文件格式预览';
});

const fallbackDesc = computed(() => {
  if (previewKind.value === 'archive') {
    return 'zip、rar、7z 等压缩包无法在聊天内直接展开，请下载到本地后查看。';
  }
  return '可以先下载到本地，再使用系统应用打开查看。';
});

const canSelectPreviewText = computed(() => {
  if (['pdf', 'presentation', 'image', 'archive', 'fallback'].includes(previewKind.value)) {
    return false;
  }
  return ['markdown', 'html', 'word', 'sheet', 'code'].includes(previewKind.value);
});

// 检查是否有可操作的文件预览选区
const hasSelection = computed(() => {
  return selectedPreviewText.value.trim().length > 0;
});

// 双击编辑单元格
function startEditCell(rIdx, cIdx, val) {
  editingCell.value = { row: rIdx, col: cIdx, val };
}

function saveEditCell(rIdx, cIdx) {
  if (editingCell.value.row === rIdx && editingCell.value.col === cIdx) {
    if (!sheetsData.value[activeSheetIdx.value]) {
      editingCell.value = { row: -1, col: -1, val: '' };
      return;
    }
    if (!sheetsData.value[activeSheetIdx.value].rows[rIdx]) {
      sheetsData.value[activeSheetIdx.value].rows[rIdx] = [];
    }
    sheetsData.value[activeSheetIdx.value].rows[rIdx][cIdx] = editingCell.value.val;
    editingCell.value = { row: -1, col: -1, val: '' };
  }
}

// PPT 切页
function nextSlide() {
  if (activeSlideIdx.value < pptSlides.value.length - 1) {
    activeSlideIdx.value++;
  }
}

function prevSlide() {
  if (activeSlideIdx.value > 0) {
    activeSlideIdx.value--;
  }
}

function nextPresentationPdfPage() {
  void goToPresentationPdfPage(presentationPdfPage.value + 1);
}

function prevPresentationPdfPage() {
  void goToPresentationPdfPage(presentationPdfPage.value - 1);
}

async function goToPresentationPdfPage(pageNumber) {
  if (!presentationPdfDocument || isLoadingPresentationPdf.value) return;

  const nextPage = clampPresentationPdfPage(pageNumber);
  if (nextPage === presentationPdfPage.value && presentationPdfPageImage.value) return;

  presentationPdfPage.value = nextPage;
  presentationPdfPageImage.value = '';
  await renderPresentationPdfPage(sourceLoadId);
}

function openPresentationFullscreen() {
  if (!pptSlides.value.length) return;
  isPresentationFullscreen.value = true;
}

function closePresentationFullscreen() {
  isPresentationFullscreen.value = false;
}

function openPresentationPdfFullscreen() {
  if (!presentationPdfUrl.value) return;
  isPresentationPdfFullscreen.value = true;
  void renderPresentationPdfPage(sourceLoadId);
}

function closePresentationPdfFullscreen() {
  isPresentationPdfFullscreen.value = false;
}

function handlePreviewSelectionCacheChange() {
  if (!props.visible || !canSelectPreviewText.value || typeof window === 'undefined') return;

  const root = resolvePreviewBodyElement();
  const text = readBrowserSelectedPreviewText(root);
  if (text) {
    selectedPreviewText.value = text;
    selectedPreviewMode.value = currentPreviewSelectionMode();
  }
}

function handlePreviewDocumentContextMenu(event) {
  if (!props.visible || !canSelectPreviewText.value) return;
  if (!isRightClickContextMenuEvent(event)) return;

  const root = resolvePreviewBodyElement();
  if (!root || !isNodeInsideElement(event.target, root)) return;

  const text = readBrowserSelectedPreviewText(root) || selectedPreviewText.value.trim();
  if (!text) return;

  event.preventDefault();
  selectedPreviewText.value = text;
  selectedPreviewMode.value = currentPreviewSelectionMode();
  placeSelectionMenuFromEvent(event);
  showContextMenu.value = true;
}

function handleHtmlPreviewSelectionMessage(event) {
  const data = event?.data;
  if (!data || data.source !== HTML_SELECTION_MESSAGE_SOURCE) return;
  if (!props.visible || previewKind.value !== 'html' || !showRender.value) return;
  if (data.trigger !== 'contextmenu' || data.button !== 2) return;

  const text = normalizeSelectedPreviewText(data.text);
  if (!text) {
    hidePreviewSelectionMenu();
    return;
  }

  const point = resolveHtmlPreviewSelectionPoint(data);
  selectedPreviewText.value = text;
  selectedPreviewMode.value = 'text';
  placeSelectionMenuAt(point.x, point.y);
  showContextMenu.value = true;
}

function readBrowserSelectedPreviewText(root) {
  if (typeof window === 'undefined') return '';
  if (!root) return '';
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
  if (!isNodeInsideElement(selection.anchorNode, root) || !isNodeInsideElement(selection.focusNode, root)) {
    return '';
  }
  return normalizeSelectedPreviewText(selection.toString());
}

function resolvePreviewBodyElement() {
  const value = previewBodyRef.value;
  if (!value) return null;
  if (typeof Element !== 'undefined' && value instanceof Element) return value;
  if (typeof Element !== 'undefined' && value.$el instanceof Element) return value.$el;
  if (typeof Element !== 'undefined' && value.$?.vnode?.el instanceof Element) return value.$.vnode.el;
  return null;
}

function isNodeInsideElement(node, element) {
  if (!node || !element || typeof element.contains !== 'function') return false;
  const target = node.nodeType === 1 ? node : node.parentElement;
  return Boolean(target && element.contains(target));
}

function normalizeSelectedPreviewText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim();
}

function currentPreviewSelectionMode() {
  if (previewKind.value === 'code') return 'code';
  if ((previewKind.value === 'markdown' || previewKind.value === 'html') && !showRender.value) {
    return 'code';
  }
  return 'text';
}

function placeSelectionMenuFromEvent(event) {
  const point = readPointerPoint(event);
  placeSelectionMenuAt(point.x, point.y);
}

function readPointerPoint(event) {
  return {
    x: event?.clientX || 100,
    y: event?.clientY || 100
  };
}

function isRightClickContextMenuEvent(event) {
  return event?.button === 2 || event?.which === 3;
}

function resolveHtmlPreviewSelectionPoint(data) {
  const rawX = Number(data.x) || 100;
  const rawY = Number(data.y) || 100;
  if (typeof document === 'undefined') {
    return { x: rawX, y: rawY };
  }

  const iframe = document.querySelector('.html-render-iframe');
  if (!iframe) return { x: rawX, y: rawY };
  const rect = iframe.getBoundingClientRect();
  return {
    x: rect.left + rawX,
    y: rect.top + rawY
  };
}

function placeSelectionMenuAt(x, y) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 375;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
  contextMenuX.value = Math.min(Math.max(Math.round(x), 8), Math.max(8, viewportWidth - 196));
  contextMenuY.value = Math.min(Math.max(Math.round(y), 8), Math.max(8, viewportHeight - 112));
}

function hidePreviewSelectionMenu() {
  showContextMenu.value = false;
  selectedPreviewText.value = '';
  selectedPreviewMode.value = 'text';
}

function quoteSelectedPreviewText() {
  const selectedText = selectedPreviewText.value.trim();
  if (!selectedText) {
    uni.showToast({ title: '未选中任何文字', icon: 'none' });
    return;
  }

  emit('quote-selection', {
    id: `file-selection-${normalizedFile.value.id || normalizedFile.value.name || Date.now()}`,
    conversationId: normalizedFile.value.conversationId,
    senderName: normalizedFile.value.name || '文件片段',
    contentPreview: summarizeSelectedPreviewText(selectedText),
    fileName: normalizedFile.value.name || '',
    selectedText,
    selectionMode: selectedPreviewMode.value
  });

  uni.showToast({ title: '已添加引用', icon: 'success' });
  hidePreviewSelectionMenu();
}

function summarizeSelectedPreviewText(text, maxLength = 80) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

async function copySelectedPreviewText() {
  const selectedText = selectedPreviewText.value.trim();
  if (!selectedText) {
    uni.showToast({ title: '未选中任何文字', icon: 'none' });
    return;
  }

  try {
    await writeTextToClipboard(selectedText);
    uni.showToast({ title: '已复制选中文本', icon: 'success' });
    hidePreviewSelectionMenu();
  } catch (error) {
    uni.showToast({ title: '复制失败，请重试', icon: 'none' });
  }
}

async function writeTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Continue to uni/document fallbacks below.
    }
  }

  if (typeof uni !== 'undefined' && typeof uni.setClipboardData === 'function') {
    await new Promise((resolve, reject) => {
      uni.setClipboardData({
        data: text,
        success: resolve,
        fail: reject
      });
    });
    return;
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (copied) return;
  }

  throw new Error('Clipboard API unavailable');
}

// 轻量语法高亮转义
function highlightCode(line, ext) {
  if (!line) return '&nbsp;';

  const tokenComment = '#6a737d';
  const tokenString = '#032f62';
  const tokenKeyword = '#d73a49';
  const tokenNumber = '#005cc5';
  const normalizedExt = String(ext || '').toLowerCase();

  if (['html', 'htm', 'vue', 'xml'].includes(normalizedExt)) {
    return highlightMarkupLine(line);
  }

  let html = escapeHtml(line);

  // 1. 注释行
  if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
    return `<span style="color: ${tokenComment}; font-style: italic;">${html}</span>`;
  }
  if (line.trim().startsWith('#') && !['md', 'markdown'].includes(ext)) {
    return `<span style="color: ${tokenComment}; font-style: italic;">${html}</span>`;
  }
  if (line.trim().startsWith('&lt;!--')) {
    return `<span style="color: ${tokenComment}; font-style: italic;">${html}</span>`;
  }

  // 2. 普通源码按原始文本分词，避免二次替换污染生成的 HTML
  const keywords = [
    'const', 'let', 'var', 'function', 'def', 'class', 'import', 'export', 'return', 
    'if', 'else', 'for', 'while', 'from', 'in', 'as', 'public', 'private', 'protected', 
    'interface', 'extends', 'implements', 'new', 'try', 'catch', 'finally', 'throw', 
    'async', 'await', 'yield', 'true', 'false', 'null', 'undefined'
  ];
  const tokenPattern = new RegExp(`(["'\`][^"'\`]*["'\`])|\\b(${keywords.join('|')})\\b|\\b(\\d+)\\b`, 'g');
  let highlighted = '';
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(line)) !== null) {
    highlighted += escapeHtml(line.slice(lastIndex, match.index));
    if (match[1]) {
      highlighted += `<span style="color: ${tokenString};">${escapeHtml(match[1])}</span>`;
    } else if (match[2]) {
      highlighted += `<span style="color: ${tokenKeyword}; font-weight: 600;">${escapeHtml(match[2])}</span>`;
    } else {
      highlighted += `<span style="color: ${tokenNumber};">${escapeHtml(match[3])}</span>`;
    }
    lastIndex = match.index + match[0].length;
  }

  highlighted += escapeHtml(line.slice(lastIndex));
  return highlighted || html;
}

function highlightMarkupLine(line) {
  const tagPattern = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/?[A-Za-z][\w:-]*(?:\s+[^<>]*?)?\/?>/gi;
  let html = '';
  let lastIndex = 0;
  let match;

  while ((match = tagPattern.exec(line)) !== null) {
    html += escapeHtml(line.slice(lastIndex, match.index));
    html += highlightMarkupToken(match[0]);
    lastIndex = match.index + match[0].length;
  }

  html += escapeHtml(line.slice(lastIndex));
  return html || '&nbsp;';
}

function highlightMarkupToken(token) {
  const tokenComment = '#6a737d';
  const tokenString = '#032f62';
  const tokenTag = '#22863a';
  const tokenAttr = '#6f42c1';

  if (token.startsWith('<!--')) {
    return `<span style="color: ${tokenComment}; font-style: italic;">${escapeHtml(token)}</span>`;
  }

  if (/^<!doctype/i.test(token)) {
    return `<span style="color: ${tokenTag};">${escapeHtml(token)}</span>`;
  }

  const tagMatch = token.match(/^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>)$/);
  if (!tagMatch) {
    return escapeHtml(token);
  }

  const [, open, tagName, attrs, close] = tagMatch;
  return [
    `<span style="color: ${tokenTag};">${escapeHtml(open + tagName)}</span>`,
    highlightMarkupAttributes(attrs, tokenAttr, tokenString),
    `<span style="color: ${tokenTag};">${escapeHtml(close)}</span>`
  ].join('');
}

function highlightMarkupAttributes(attrs, tokenAttr, tokenString) {
  const attrPattern = /(\s+)([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  let html = '';
  let lastIndex = 0;
  let match;

  while ((match = attrPattern.exec(attrs)) !== null) {
    html += escapeHtml(attrs.slice(lastIndex, match.index));
    html += escapeHtml(match[1]);
    html += `<span style="color: ${tokenAttr};">${escapeHtml(match[2])}</span>`;
    if (match[3]) {
      html += `=<span style="color: ${tokenString};">${escapeHtml(match[3])}</span>`;
    }
    lastIndex = match.index + match[0].length;
  }

  html += escapeHtml(attrs.slice(lastIndex));
  return html;
}

function getTypeFromName(name) {
  const match = String(name).match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : 'file';
}

function startDownload() {
  if (isDownloading.value) return;
  isDownloading.value = true;
  progress.value = 0;

  const timer = setInterval(() => {
    progress.value = Math.min(100, progress.value + 12);
    if (progress.value < 100) return;

    clearInterval(timer);
    isDownloading.value = false;
    isDownloaded.value = true;
    uni.showToast({ title: '下载已完成', icon: 'success' });
  }, 120);
}

function handleImageLoad() {
  isImageLoading.value = false;
  imageLoadError.value = false;
}

function handleImageError() {
  isImageLoading.value = false;
  imageLoadError.value = true;
}

function handleBackdropClose() {
  if (!props.embedded) emit('close');
}

function sanitizeHtmlFragment(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'")
    .replace(/\s(href|src)\s*=\s*javascript:[^\s>]*/gi, ' $1="#"');
}

function buildSandboxedHtmlContent(value) {
  const html = String(value || '');
  const bridge = buildHtmlSelectionBridge();
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${bridge}</body>`);
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${bridge}</html>`);
  }
  return `${html}${bridge}`;
}

function buildHtmlSelectionBridge() {
  const channel = JSON.stringify(HTML_SELECTION_MESSAGE_SOURCE);
  return `<style>
html, body, body * {
  -webkit-user-select: text;
  user-select: text;
}
</style>
<script>
(function () {
  var channel = ${channel};

  function selectedText() {
    var selection = window.getSelection ? window.getSelection() : null;
    return selection ? String(selection.toString()).trim() : '';
  }

  function pointFromEvent(event) {
    var point = event && ((event.changedTouches && event.changedTouches[0]) || (event.touches && event.touches[0]) || event);
    return {
      x: point && point.clientX ? point.clientX : 100,
      y: point && point.clientY ? point.clientY : 100
    };
  }

  function postSelection(event, trigger) {
    var text = selectedText();
    if (!text) return false;
    var point = pointFromEvent(event);
    window.parent.postMessage({
      source: channel,
      trigger: trigger,
      button: event && event.button,
      text: text,
      x: point.x,
      y: point.y
    }, '*');
    return true;
  }

  document.addEventListener('contextmenu', function (event) {
    if (event.button === 2 && postSelection(event, 'contextmenu')) {
      event.preventDefault();
    }
  });
})();
<\/script>`;
}

function stripHtml(value) {
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.innerHTML = sanitizeHtmlFragment(value);
    return el.textContent || '';
  }
  return String(value || '').replace(/<[^>]+>/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
</script>

<style scoped>
.file-preview-shell {
  box-sizing: border-box;
}

.file-preview-shell.overlay {
  position: fixed;
  inset: 0;
  z-index: 1005;
  padding: 24px;
  background-color: rgba(15, 23, 42, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-preview-shell.embedded {
  width: 100%;
  height: 100%;
  min-height: 0;
  background-color: var(--color-bg-surface);
  display: flex;
  flex-direction: column;
}

.file-preview-card {
  width: min(920px, 92vw);
  height: min(760px, 88vh);
  overflow: hidden;
  border-radius: 12px;
  background-color: var(--color-bg-surface);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.18);
}

.embedded .file-preview-card {
  width: 100%;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
}

.preview-header {
  min-height: 72px;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  box-sizing: border-box;
}

.embedded .preview-header {
  min-height: 64px;
  padding: 0 16px;
}

.file-title-block {
  gap: 12px;
  min-width: 0;
}

.file-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background-color: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.embedded .file-icon-box {
  width: 40px;
  height: 40px;
}

.file-meta {
  min-width: 0;
}

.preview-filename {
  max-width: 100%;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.embedded .preview-filename {
  font-size: 14px;
}

.preview-filesize {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.header-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.header-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  background-color: #ffffff;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  margin: 0;
  transition: all 0.16s ease;
}

.header-btn::after {
  border: none;
}

.header-btn .btn-text {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  line-height: 1;
}

.header-btn:hover:not([disabled]) {
  background-color: #f8fafc;
  border-color: rgba(0, 0, 0, 0.12);
}

.header-btn:active:not([disabled]) {
  transform: scale(0.96);
}

.header-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-render-btn {
  background-color: var(--color-primary-light);
  border-color: rgba(0, 74, 198, 0.15);
}

.close-icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.close-icon-btn:hover,
.close-icon-btn:active {
  background-color: var(--color-bg-hover);
}

.download-progress-box {
  padding: 10px 20px;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-base);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-bar-bg {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background-color: var(--color-border);
}

.progress-bar-fill {
  height: 100%;
  border-radius: 999px;
  background-color: var(--color-primary);
  transition: width 0.15s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.preview-scroll {
  height: 100%;
  min-height: 0;
}

.preview-body {
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  background-color: #ffffff;
}
.preview-body.text-selection-enabled,
.preview-body.text-selection-enabled :deep(*) {
  -webkit-user-select: text;
  user-select: text;
}
.preview-body.text-selection-enabled .line-numbers-col,
.preview-body.text-selection-enabled .line-numbers-col :deep(*) {
  -webkit-user-select: none;
  user-select: none;
}

/* 异步加载等待样式 */
.source-loading-box {
  height: 100%;
  gap: 12px;
}
.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.loading-tip {
  font-size: 12.5px;
  color: var(--color-text-secondary);
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 1. Markdown 预览 */
.markdown-body {
  padding: 32px 28px;
  color: #334155;
  font-size: 14px;
  line-height: 1.8;
  background-color: #ffffff;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 0 0 16px;
  color: #0f172a;
  line-height: 1.35;
  font-weight: 700;
}
.markdown-body :deep(h1) {
  font-size: 22px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.markdown-body :deep(p) {
  margin: 0 0 14px;
}
.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #f1f5f9;
  font-family: Consolas, Monaco, monospace;
  font-size: 12.5px;
  color: #0f172a;
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
.markdown-body :deep(ol ol) {
  list-style: lower-alpha;
}
.markdown-body :deep(li) {
  margin: 4px 0;
  padding-left: 2px;
}
.markdown-body :deep(hr) {
  height: 1px;
  margin: 24px 0;
  border: 0;
  background-color: #e2e8f0;
}
.markdown-body :deep(blockquote) {
  margin: 16px 0;
  padding: 10px 14px;
  border-left: 4px solid rgba(37, 99, 235, 0.32);
  background-color: #f8fafc;
  color: #475569;
}
.markdown-body :deep(pre) {
  margin: 16px 0;
  padding: 14px 16px;
  overflow-x: auto;
  border-radius: 8px;
  background-color: #0f172a;
  color: #e2e8f0;
  line-height: 1.65;
}
.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
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
  line-height: 1.6;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  min-width: 92px;
  padding: 8px 12px;
  border: 1px solid #d8dee8;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}
.markdown-body :deep(th) {
  background-color: #f1f5f9;
  color: #0f172a;
  font-weight: 700;
}
.markdown-body :deep(td) {
  background-color: #ffffff;
}
.markdown-body :deep(tr:nth-child(even) td) {
  background-color: #f8fafc;
}
.markdown-body :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 18px auto;
  border-radius: 8px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background-color: #ffffff;
}
.markdown-body :deep(.markdown-math-block) {
  margin: 18px 0;
  padding: 10px 12px;
  overflow-x: auto;
  border-radius: 8px;
  background-color: #f8fafc;
  text-align: center;
}
.markdown-body :deep(.katex-display) {
  margin: 0;
}
.markdown-body :deep(.katex) {
  font-size: 1.04em;
}
.markdown-body :deep(.markdown-math-error) {
  color: #b91c1c;
  background-color: #fef2f2;
}
.markdown-body :deep(.task-list-item) {
  list-style: none;
  margin-left: -20px;
}
.markdown-body :deep(.task-list-checkbox) {
  width: 16px;
  height: 16px;
  margin: 0 8px 0 0;
  vertical-align: -2px;
  accent-color: var(--color-primary);
}

/* 2. HTML 预览 */
.html-render-full {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  background-color: #ffffff;
}
.html-render-iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background-color: #ffffff;
}

/* 3. Word 仿真预览 */
.word-preview-container {
  background-color: #f3f2f1;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
}
.word-a4-page {
  background-color: #ffffff;
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: 28px 24px 40px;
}
.word-document-body {
  color: #202124;
  font-size: 14px;
  line-height: 1.85;
}
.word-document-body :deep(h1),
.word-document-body :deep(h2),
.word-document-body :deep(h3) {
  color: #0f172a;
  line-height: 1.4;
  margin: 18px 0 12px;
  font-weight: 700;
}
.word-document-body :deep(h1) {
  margin-top: 0;
  font-size: 24px;
  text-align: center;
}
.word-document-body :deep(h2) {
  font-size: 19px;
}
.word-document-body :deep(h3) {
  font-size: 16px;
}
.word-document-body :deep(p) {
  margin: 0 0 12px;
}
.word-document-body :deep(ul),
.word-document-body :deep(ol) {
  margin: 0 0 14px 22px;
  padding: 0;
}
.word-document-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 13px;
}
.word-document-body :deep(td),
.word-document-body :deep(th) {
  border: 1px solid #d8dee8;
  padding: 8px 10px;
  vertical-align: top;
}
.word-document-body :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 14px auto;
}
.word-paragraph-render {
  font-size: 13.5px;
  line-height: 1.8;
  color: #323130;
  margin-bottom: 12px;
  text-align: justify;
}

/* 4. PDF 预览 */
.pdf-preview-box {
  width: 100%;
  height: 100%;
  background-color: #ffffff;
  overflow: hidden;
  box-sizing: border-box;
}
.pdf-iframe {
  display: block;
  width: 100%;
  height: 100%;
}

/* 5. PPT 预览 */
.ppt-preview-container {
  background-color: #f3f2f1;
  overflow: hidden;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
.presentation-pdf-preview {
  width: 100%;
  height: 100%;
  min-height: 0;
  background-color: #e5e7eb;
  box-sizing: border-box;
}
.presentation-pdf-stage {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 16px 14px;
  box-sizing: border-box;
  background-color: #e5e7eb;
}
.presentation-pdf-page-image {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 1120px;
  max-height: 100%;
  background-color: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
}
.presentation-pdf-loading {
  width: 100%;
  height: 100%;
  gap: 12px;
}
.presentation-pdf-controls {
  height: 52px;
  padding: 8px 12px;
  box-sizing: border-box;
  flex-shrink: 0;
  background-color: #ffffff;
  border-top: 1px solid #dadada;
  gap: 10px;
}
.presentation-pdf-page-indicator {
  min-width: 96px;
}
.presentation-pdf-fullscreen-layer {
  position: fixed;
  inset: 0;
  z-index: 1400;
  background-color: #080b13;
  color: #ffffff;
  box-sizing: border-box;
}
.presentation-pdf-fullscreen-stage {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 16px 24px;
  box-sizing: border-box;
  background-color: #111827;
}
.presentation-pdf-fullscreen-image {
  display: block;
  width: 100%;
  height: 100%;
  max-width: min(96vw, 1920px);
  max-height: 100%;
  background-color: #ffffff;
  box-shadow: 0 18px 56px rgba(0, 0, 0, 0.42);
}
.presentation-pdf-fullscreen-layer .loading-tip {
  color: #e5e7eb;
}
.ppt-screen-area {
  background-color: #eaeaea;
  height: 100%;
  width: 100%;
  min-width: 0;
}
.ppt-slide-viewport {
  width: 100%;
  min-height: 0;
  padding: 20px 12px;
  box-sizing: border-box;
}
.ppt-slide-card {
  position: relative;
  background-color: #ffffff;
  width: 100%;
  max-width: 1120px;
  aspect-ratio: 16/9;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  box-sizing: border-box;
  border-radius: 6px;
  overflow: hidden;
}
.ppt-slide-title-text {
  font-size: 18px;
  font-weight: 700;
  color: #111111;
  margin-bottom: 10px;
}
.ppt-slide-body-text {
  font-size: 12.5px;
  line-height: 1.6;
  color: #605e5c;
}
.ppt-text-element,
.ppt-shape-element,
.ppt-image-element,
.ppt-table-element {
  position: absolute;
  box-sizing: border-box;
}
.ppt-text-element {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 6px 8px;
  line-height: 1.25;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}
.ppt-text-element.title {
  line-height: 1.15;
}
.ppt-text-line {
  display: block;
}
.ppt-shape-element {
  pointer-events: none;
}
.ppt-image-element {
  display: block;
}
.ppt-table-element {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.8);
  background-color: rgba(255, 255, 255, 0.92);
}
.ppt-table-row {
  display: flex;
  flex: 1;
  min-height: 0;
}
.ppt-table-cell {
  flex: 1;
  min-width: 0;
  padding: 3px 5px;
  border-right: 1px solid rgba(148, 163, 184, 0.55);
  border-bottom: 1px solid rgba(148, 163, 184, 0.55);
  font-size: 9px;
  line-height: 1.3;
  color: #111827;
  overflow: hidden;
  word-break: break-word;
}
.ppt-empty-slide {
  width: 100%;
  height: 100%;
  text-align: center;
  padding: 24px;
  box-sizing: border-box;
}
.ppt-controls {
  background-color: #ffffff;
  border-top: 1px solid #dadada;
  padding: 8px 12px;
  height: 52px;
  box-sizing: border-box;
  gap: 12px;
  flex-shrink: 0;
}
.ppt-page-indicator {
  min-width: 72px;
  font-size: 12px;
  font-weight: 600;
  color: #605e5c;
  text-align: center;
  line-height: 34px;
}
.ppt-nav-btns {
  gap: 10px;
  align-items: center;
}
.ppt-nav-btn {
  height: 34px;
  min-width: 58px;
  padding: 0 12px;
  font-size: 12px;
  border: 1px solid #dadada;
  background-color: #ffffff;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 0;
}
.ppt-nav-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.ppt-fullscreen-btn {
  min-width: 72px;
}
.ppt-fullscreen-layer {
  position: fixed;
  inset: 0;
  z-index: 1400;
  background-color: #080b13;
  color: #ffffff;
  box-sizing: border-box;
}
.ppt-fullscreen-topbar {
  height: 56px;
  padding: 0 20px;
  box-sizing: border-box;
  flex-shrink: 0;
  background-color: rgba(8, 11, 19, 0.86);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.ppt-fullscreen-title {
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ppt-fullscreen-close {
  width: 44px;
  height: 44px;
  padding: 0;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.ppt-fullscreen-close::after {
  border: none;
}
.ppt-fullscreen-stage {
  min-height: 0;
  padding: 18px 24px;
  box-sizing: border-box;
}
.ppt-slide-card.fullscreen {
  width: min(96vw, 140vh, 1600px);
  max-width: none;
  box-shadow: 0 18px 56px rgba(0, 0, 0, 0.42);
  border-radius: 8px;
}
.ppt-fullscreen-controls {
  height: 64px;
  padding: 8px 16px;
  gap: 14px;
  box-sizing: border-box;
  flex-shrink: 0;
  background-color: rgba(8, 11, 19, 0.9);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.ppt-fullscreen-page {
  min-width: 88px;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: #f8fafc;
}
.ppt-fullscreen-nav-btn {
  min-width: 72px;
  height: 44px;
  padding: 0 14px;
  margin: 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ppt-fullscreen-nav-btn::after {
  border: none;
}
.ppt-fullscreen-nav-btn[disabled] {
  opacity: 0.38;
  cursor: not-allowed;
}

/* 6. Excel 预览 */
.excel-preview-container {
  background-color: #ffffff;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
.excel-grid-scroll {
  overflow: auto;
  width: 100%;
  height: 100%;
}
.excel-table-layout {
  min-width: 500px;
}
.excel-grid-row {
  display: flex;
}
.excel-corner-cell {
  width: 42px;
  height: 24px;
  background-color: #f3f2f1;
  border-right: 1px solid #d2d0ce;
  border-bottom: 1px solid #d2d0ce;
  flex-shrink: 0;
}
.excel-col-header {
  width: 132px;
  height: 24px;
  background-color: #f3f2f1;
  border-right: 1px solid #d2d0ce;
  border-bottom: 1px solid #d2d0ce;
  font-size: 10px;
  color: #323130;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.excel-row-header {
  width: 42px;
  height: 28px;
  background-color: #f3f2f1;
  border-right: 1px solid #d2d0ce;
  border-bottom: 1px solid #d2d0ce;
  font-size: 10px;
  color: #323130;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.excel-data-cell {
  width: 132px;
  height: 28px;
  border-right: 1px solid #e1dfdd;
  border-bottom: 1px solid #e1dfdd;
  padding: 2px 6px;
  font-size: 11.5px;
  color: #323130;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-user-select: text;
  user-select: text;
  cursor: text;
}
.excel-data-cell.header {
  font-weight: 700;
  background-color: #f9fbf9;
}
.excel-data-cell.editing {
  border: 2px solid #107c41;
  padding: 0;
}
.cell-edit-input {
  width: 100%;
  height: 100%;
  border: none;
  padding: 2px 6px;
  font-size: 11.5px;
  outline: none;
  box-sizing: border-box;
}
.excel-sheet-tabs-bar {
  background-color: #f3f2f1;
  border-top: 1px solid #dadada;
  height: 30px;
  padding: 0 10px;
  flex-shrink: 0;
}
.excel-nav-arrows {
  display: flex;
  gap: 10px;
  margin-right: 12px;
}
.nav-arrow {
  color: #605e5c;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
}
.sheet-tabs-scroll {
  white-space: nowrap;
}
.sheet-tabs-inner {
  display: flex;
  gap: 1px;
  min-width: max-content;
}
.sheet-tab-item {
  padding: 0 10px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e1dfdd;
  color: #323130;
  font-size: 10.5px;
  cursor: pointer;
  border-right: 1px solid #dadada;
}
.sheet-tab-item.active {
  background-color: #ffffff;
  color: #107c41;
  font-weight: 600;
  border-bottom: 2px solid #107c41;
}
.excel-status-info {
  font-size: 10px;
  color: #605e5c;
  flex-shrink: 0;
  margin-left: 10px;
}

/* 7. 代码编辑器 */
.code-editor-wrapper {
  background-color: #1e1e1e;
  color: #d4d4d4;
  overflow: hidden;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
.editor-scroll-view {
  height: 100%;
  width: 100%;
}
.editor-code-body {
  padding: 16px 0;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  min-width: fit-content;
}
.line-numbers-col {
  padding: 0 12px 0 16px;
  border-right: 1px solid #3c3c3c;
  user-select: none;
  text-align: right;
  color: #858585;
}
.line-num-text {
  display: block;
  min-height: 20.8px;
}
.code-content-col {
  padding: 0 16px;
  flex: 1;
}
.code-line-text {
  margin: 0;
  padding: 0;
  display: block;
  min-height: 20.8px;
  color: #d4d4d4;
  white-space: pre;
}

/* 8. 图片预览 */
.image-preview {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  justify-content: center;
  align-items: center;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
  background-color: #eef2f7;
}
.image-preview-stage {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}
.preview-image {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  border-radius: 6px;
  background-color: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
}
.image-preview-loading {
  position: absolute;
  inset: 0;
  z-index: 1;
  gap: 12px;
  background-color: rgba(248, 250, 252, 0.82);
}

/* 9. 降级渲染 */
.fallback-preview {
  text-align: center;
  background-color: #ffffff;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  box-sizing: border-box;
}
.fallback-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background-color: rgba(0, 74, 198, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.fallback-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}
.fallback-desc {
  max-width: 380px;
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.8;
  color: #475569;
}
.btn-open {
  margin-top: 16px;
  background-color: var(--color-primary);
  color: #ffffff;
  border: none;
  box-shadow: 0 4px 10px rgba(0, 74, 198, 0.12);
  transition: all 0.2s ease;
  height: 34px;
  padding: 0 14px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12.5px;
}
.btn-open::after {
  border: none;
}
.btn-open:hover {
  background-color: var(--color-primary-hover);
  box-shadow: 0 6px 14px rgba(0, 74, 198, 0.18);
}

/* 右键上下文菜单样式 */
.custom-selection-menu {
  position: fixed;
  background-color: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12), 0 1px 2px rgba(15, 23, 42, 0.04);
  padding: 6px;
  min-width: 178px;
  z-index: 1010;
  display: flex;
  flex-direction: column;
}
.menu-item {
  padding: 8px 12px;
  gap: 10px;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.16s ease;
}
.menu-item:hover {
  background-color: var(--color-bg-hover);
}
.menu-item-text {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.context-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1009;
  background: transparent;
}

@media (max-width: 768px) {
  .file-preview-shell.overlay {
    padding: 0;
    align-items: stretch;
    justify-content: flex-end;
  }
  .file-preview-card {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  }
  .preview-header {
    min-height: 64px;
    padding: 0 16px;
  }
  .header-actions {
    gap: 6px;
  }
  .header-btn {
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 10px;
  }
  .header-btn .btn-text {
    display: none;
  }
  .preview-body {
    padding: 0;
  }
  .markdown-body {
    padding: 16px;
    font-size: 13px;
  }
  .word-a4-page {
    padding: 16px 12px;
  }
  .presentation-pdf-stage {
    padding: 8px;
  }
  .presentation-pdf-controls {
    height: 52px;
    padding: 7px 6px;
    gap: 6px;
  }
  .presentation-pdf-page-indicator {
    min-width: 82px;
  }
  .presentation-pdf-fullscreen-stage {
    padding: 8px;
  }
  .ppt-slide-viewport {
    padding: 12px;
  }
  .ppt-controls {
    height: 50px;
    padding: 7px 8px;
  }
  .ppt-nav-btns {
    gap: 8px;
  }
  .ppt-nav-btn {
    min-width: 54px;
    padding: 0 10px;
  }
  .ppt-page-indicator {
    min-width: 68px;
  }
  .ppt-fullscreen-topbar {
    height: 52px;
    padding: 0 12px;
  }
  .ppt-fullscreen-stage {
    padding: 12px;
  }
  .ppt-slide-card.fullscreen {
    width: min(94vw, 138vh);
    border-radius: 6px;
  }
  .ppt-fullscreen-controls {
    height: 60px;
    padding: 8px;
    gap: 10px;
  }
  .ppt-fullscreen-nav-btn {
    min-width: 66px;
    padding: 0 12px;
  }
  .ppt-fullscreen-page {
    min-width: 78px;
  }
}
</style>
