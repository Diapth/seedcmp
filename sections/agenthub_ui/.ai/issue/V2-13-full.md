# [V2-13] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P1

---

## 问题描述

完整 V2 run `v2-full-20260607-041127` 执行到 V2-13 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-13-06/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-13-07/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-13-08/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-13-09/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-13
Evidence root: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127
```

---

## 根因分析

待修复 owner 结合运行态源码与后端接口进一步定位。本轮只做 E2E 验收，不修改业务代码。

---

## 问题列表（Q&A 迭代）

### Q1: 是否因为前一个失败而停止后续测试？
**A1**: 否。本轮 runner 对全部 141 个 case 都执行了尝试并保存截图。

---

## 测试发现记录

| Case | Status | Finding |
|---|---|---|
| V2-13-06 视频（mp4/webm） | FAIL | previewVisible=true; file=missing-test.mp4; url=http://172.18.58.156:5173/#/pages/files/preview?file=%7B%22id%22%3A%22v2-mp4%22%2C%22name%22%3A%22missing-test.mp4%22%2C%22fileName%22%3A%22missing-test.mp4%22%2C%22ext%22%3A%22mp4%22%2C%22url%22%3A%22%2Fassets%2Fmissing-test.mp4%22%2C%22content%22%3A%22test.md%22%7D; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-13-07 音频（mp3/wav/ogg） | FAIL | previewVisible=true; file=missing-test.mp3; url=http://172.18.58.156:5173/#/pages/files/preview?file=%7B%22id%22%3A%22v2-mp3%22%2C%22name%22%3A%22missing-test.mp3%22%2C%22fileName%22%3A%22missing-test.mp3%22%2C%22ext%22%3A%22mp3%22%2C%22url%22%3A%22%2Fassets%2Fmissing-test.mp3%22%2C%22content%22%3A%22test.md%22%7D; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-13-08 大文件 | FAIL | previewVisible=true; file=missing-large.zip; url=http://172.18.58.156:5173/#/pages/files/preview?file=%7B%22id%22%3A%22v2-zip%22%2C%22name%22%3A%22missing-large.zip%22%2C%22fileName%22%3A%22missing-large.zip%22%2C%22ext%22%3A%22zip%22%2C%22url%22%3A%22%2Fassets%2Fmissing-large.zip%22%2C%22content%22%3A%22test.md%22%7D; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-13-09 非法文件 | FAIL | previewVisible=true; file=blocked.exe; url=http://172.18.58.156:5173/#/pages/files/preview?file=%7B%22id%22%3A%22v2-exe%22%2C%22name%22%3A%22blocked.exe%22%2C%22fileName%22%3A%22blocked.exe%22%2C%22ext%22%3A%22exe%22%2C%22url%22%3A%22%2Fassets%2Fblocked.exe%22%2C%22content%22%3A%22test.md%22%7D; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |

---

## 修复记录

### 2026-06-07

尚未修复。

---

## 测试结果

```bash
H5_BASE_URL=http://172.18.58.156:5173 node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs
# evidence: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127
```

---

## 关闭备注

待对应 case 修复后重跑完整 V2 或至少重跑本簇，并更新该 issue。
