import { defineStore } from 'pinia';

export const useFileStore = defineStore('file', {
  state: () => ({
    files: [
      {
        id: 'f0',
        name: 'AgentHub交互验收清单.md',
        size: '18 KB',
        time: 1780492000000,
        type: 'md',
        previewContent: `# AgentHub 交互验收清单

> 用于确认通讯录、聊天、文件预览等 IM 核心页面是否保持同页交互。

## 本轮重点

- 通讯录快捷入口在右侧详情区切换，不产生页面跳转感。
- 文件空间支持 Markdown、文本、图片预览。
- PDF / Office 文件显示明确的降级说明和下载动作。

## 预览能力

| 格式 | 当前策略 | 说明 |
| --- | --- | --- |
| Markdown | markdown-it 渲染 | 禁用原始 HTML，保留链接识别 |
| 文本 / HTML | 源码文本预览 | 避免不受控 HTML 注入 |
| 图片 | 内嵌预览 | 需要可访问的图片地址 |
| PDF / Office | 降级说明 | 可后续接入转码服务 |

\`\`\`js
const preview = {
  renderer: 'markdown-it',
  html: false,
  linkify: true
};
\`\`\`
`
      },
      { id: 'f1', name: 'IM重构设计方案.pdf', size: '1.2 MB', time: 1780480000000, type: 'pdf', url: '' },
      { id: 'f2', name: 'UI设计图稿_最终版.fig', size: '24.5 MB', time: 1780470000000, type: 'fig', url: '' },
      {
        id: 'f3',
        name: '会议纪要2026-06-03.docx',
        size: '345 KB',
        time: 1780460000000,
        type: 'docx',
        url: ''
      },
      {
        id: 'f4',
        name: '接口联调记录.txt',
        size: '9 KB',
        time: 1780450000000,
        type: 'txt',
        previewContent: '10:00 登录态检查通过\n10:30 通讯录右侧面板切换通过\n11:20 文件预览 Markdown 渲染通过\n14:00 移动端同页返回路径待复测'
      },
      {
        id: 'f5',
        name: '聊天文件预览示例.jpg',
        size: '420 KB',
        time: 1780440000000,
        type: 'jpg',
        url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'
      }
    ]
  }),
  actions: {
    uploadFile(file) {
      this.files.unshift({
        ...file,
        id: Date.now().toString(),
        time: Date.now()
      });
    }
  }
});
