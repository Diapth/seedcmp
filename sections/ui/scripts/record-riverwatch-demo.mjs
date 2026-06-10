import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import playwright from 'playwright';
import JSZip from 'jszip';

const { chromium } = playwright;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(__dirname, '..');
const seedcmpRoot = path.resolve(uiRoot, '../..');
const finalDocsDir = path.join(seedcmpRoot, 'final_docs');
const videoDir = path.join(finalDocsDir, 'riverwatch-demo-video-work');
const baseUrl = process.env.AGENTHUB_UI_URL || 'http://localhost:5173';
const apiBase = process.env.AGENTHUB_API_BASE || 'http://127.0.0.1:8090/v1';
const fast = process.env.RIVERWATCH_DEMO_FAST === '1';
const waitShort = fast ? 350 : 1400;
const waitStep = fast ? 700 : 15000;
const waitKey = fast ? 1000 : 18000;
const waitDeploy = fast ? 700 : 8000;
const viewport = { width: 1440, height: 900 };

const projectPrompt = `我想做一个 RiverWatch 河流水质数据看板项目，请你作为 PM 创建项目群并组织多智能体分工执行。

交付物需要包括：
- 项目汇报 PPT
- 产品需求文档 PRD
- 预算与排期表
- Vue 前端技术 README
- 一个可直接预览的 Vue CDN 单页面 HTML
- preview 部署链接

约束：
- 前端使用模拟静态数据，不接后端
- 总预算不超过 5 万
- 优先保证移动端可读
- 水质指标包括 pH、溶解氧、浊度、氨氮和站点状态`;

const htmlPreview = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RiverWatch 河流水质数据看板</title>
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <style>
    body { margin: 0; font-family: system-ui, "PingFang SC", sans-serif; background: #f4f8fb; color: #172033; }
    #app { max-width: 1120px; margin: 0 auto; padding: 24px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: end; }
    h1 { margin: 0 0 6px; font-size: clamp(28px, 6vw, 48px); }
    .hint { color: #5f6f84; }
    .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 20px 0; }
    .card { background: white; border: 1px solid #dce7f2; border-radius: 8px; padding: 16px; box-shadow: 0 10px 24px rgba(30, 64, 105, .08); }
    .value { display: block; margin-top: 10px; font-size: 28px; font-weight: 800; }
    .ok { color: #047857; } .warn { color: #b45309; } .bad { color: #b91c1c; }
    .sites { display: grid; gap: 10px; }
    .site { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5edf5; padding: 12px 0; }
    .pill { padding: 5px 10px; border-radius: 999px; background: #ecfdf5; color: #047857; font-weight: 700; font-size: 12px; }
    .pill.warn { background: #fff7ed; color: #c2410c; }
    @media (max-width: 720px) { header { display: block; } .grid { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <div id="app">
    <header>
      <div><h1>RiverWatch</h1><div class="hint">静态 mock 数据 · 移动端两列指标卡 · 每 10 秒刷新一次</div></div>
      <strong class="ok">4 正常 / 1 异常</strong>
    </header>
    <section class="grid">
      <article class="card"><span>pH</span><span class="value ok">7.4</span></article>
      <article class="card"><span>溶解氧</span><span class="value ok">8.1</span></article>
      <article class="card"><span>浊度</span><span class="value warn">18</span></article>
      <article class="card"><span>氨氮</span><span class="value ok">0.32</span></article>
      <article class="card"><span>异常点</span><span class="value bad">1</span></article>
    </section>
    <section class="card sites">
      <div class="site"><b>上游入境口</b><span class="pill">正常</span></div>
      <div class="site"><b>中心桥断面</b><span class="pill">正常</span></div>
      <div class="site"><b>东湾闸口</b><span class="pill warn">浊度偏高</span></div>
      <div class="site"><b>湿地缓冲区</b><span class="pill">正常</span></div>
      <div class="site"><b>下游出境口</b><span class="pill">正常</span></div>
    </section>
  </div>
  <script>Vue.createApp({}).mount('#app')</script>
</body>
</html>`;

function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dataUrl(mime, base64) {
  return `data:${mime};base64,${base64}`;
}

async function zipBase64(files) {
  const zip = new JSZip();
  Object.entries(files).forEach(([name, content]) => zip.file(name, content));
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
}

async function buildDocxDataUrl() {
  const paragraphs = [
    'RiverWatch 产品需求文档 PRD',
    '用户场景：环保值班人员在移动端快速查看关键水质指标与异常站点。',
    '功能范围：pH、溶解氧、浊度、氨氮、站点状态、趋势摘要、异常提示。',
    '验收标准：预算不超过 5 万；前端使用静态 mock 数据；优先保证移动端可读。',
    '水质数据每 10 秒刷新一次。'
  ];
  const body = paragraphs.map((text) => `<w:p><w:r><w:t>${xmlEscape(text)}</w:t></w:r></w:p>`).join('');
  const base64 = await zipBase64({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`
  });
  return dataUrl('application/vnd.openxmlformats-officedocument.wordprocessingml.document', base64);
}

function xlsxCell(ref, value) {
  return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}

async function buildXlsxDataUrl() {
  const rows = [
    ['A1', '阶段'], ['B1', '交付物'], ['C1', '负责人'], ['D1', '预算'], ['E1', '周期'],
    ['A2', '第 1 周'], ['B2', 'PRD / PPT / README'], ['C2', 'PM + 文档智能体'], ['D2', '18000'], ['E2', '5 天'],
    ['A3', '第 2 周'], ['B3', 'Vue 页面 / 预览部署'], ['C3', 'Frontend + DevOps'], ['D3', '27000'], ['E3', '5 天'],
    ['A4', '合计'], ['B4', '预算控制在 4.5 万'], ['C4', '多智能体协作'], ['D4', '45000'], ['E4', '2 周']
  ];
  const rowXml = [1, 2, 3, 4].map((row) => {
    const cells = rows.filter(([ref]) => ref.endsWith(String(row))).map(([ref, value]) => xlsxCell(ref, value)).join('');
    return `<row r="${row}">${cells}</row>`;
  }).join('');
  const base64 = await zipBase64({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="预算排期" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`
  });
  return dataUrl('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64);
}

function pptShape(id, title, x, y, cx, cy, fontSize = 2800, bold = false) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="${fontSize}"${bold ? ' b="1"' : ''}/><a:t>${xmlEscape(title)}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

function pptSlideXml(title, lines) {
  const body = [
    pptShape(2, title, 900000, 640000, 10300000, 720000, 3400, true),
    ...lines.map((line, index) => pptShape(3 + index, line, 1240000, 1700000 + index * 760000, 9600000, 520000, 2100, false))
  ].join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${body}</p:spTree></p:cSld></p:sld>`;
}

async function buildPptxDataUrl() {
  const base64 = await zipBase64({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldMasterIdLst/><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`,
    'ppt/slides/slide1.xml': pptSlideXml('RiverWatch 项目汇报', ['目标：用移动端优先的水质看板帮助值班人员快速发现异常。', '范围：pH、溶解氧、浊度、氨氮、站点状态与趋势。', '交付：PRD、预算排期、Vue CDN 单页和 preview 链接。']),
    'ppt/slides/slide2.xml': pptSlideXml('两周交付计划', ['第 1 周：需求收敛、PPT、PRD、README。', '第 2 周：前端实现、异常点突出、preview 部署。', '预算：控制在 4.5 万以内，保留 5 千风险余量。'])
  });
  return dataUrl('application/vnd.openxmlformats-officedocument.presentationml.presentation', base64);
}

async function buildDemoAssets() {
  return {
    docxUrl: await buildDocxDataUrl(),
    xlsxUrl: await buildXlsxDataUrl(),
    pptxUrl: await buildPptxDataUrl(),
    htmlPreview,
    previewUrl: `${baseUrl}/assets/riverwatch-preview.html`
  };
}

async function ensureDemoAccount() {
  if (process.env.AGENTHUB_DEMO_PHONE && process.env.AGENTHUB_DEMO_PASSWORD) {
    return {
      phone: process.env.AGENTHUB_DEMO_PHONE,
      password: process.env.AGENTHUB_DEMO_PASSWORD
    };
  }
  const phone = `196${String(Date.now()).slice(-8)}`;
  const password = 'Demo12345';
  await fetch(`${apiBase}/user/sms/registercode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zone: '0086', phone })
  }).catch(() => null);
  const resp = await fetch(`${apiBase}/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      zone: '0086',
      phone,
      code: '123456',
      name: 'RiverWatch 演示用户',
      password,
      flag: 1,
      device: {
        device_id: `riverwatch-demo-${Date.now()}`,
        device_name: 'Playwright',
        device_model: 'Chromium'
      }
    })
  });
  if (!resp.ok) throw new Error(`register failed: ${resp.status}`);
  return { phone, password };
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function demoStateScript({ assets, stage }) {
  const now = Date.now();
  const fileBase = {
    type: 'file',
    time: now - 1000 * 60 * 16,
    status: 'success',
    reactions: [],
    replyRef: null,
    mentions: [],
    senderAvatar: ''
  };
  const agents = [
    { id: 'river-pm', name: 'RiverWatch PM', alias: '@riverpm', desc: '负责 RiverWatch 项目需求拆解、任务分发和交付聚合。', avatar: '', status: 'active', creator: 'User', platform: 'claude-code', accessMode: 'oauth', model: 'Claude Code', accountRef: 'claude', roleTemplate: 'coordinator', templateId: 'coordinator', capabilityTags: ['需求澄清', '任务拆分', '并行调度', '交付闭环'], source: 'user', directCatId: 'river-pm' },
    { id: 'source-curator', name: 'Source Curator', alias: '@source', desc: '整理资料与水质数据样例。', avatar: '', status: 'busy', creator: 'RiverWatch PM', roleTemplate: 'researcher', capabilityTags: ['资料整理', '数据样例'], source: 'user', directCatId: 'source-curator' },
    { id: 'deck-strategist', name: 'Deck Strategist', alias: '@deck', desc: '规划项目汇报结构。', avatar: '', status: 'busy', creator: 'RiverWatch PM', roleTemplate: 'deck', capabilityTags: ['PPT', '叙事结构'], source: 'user', directCatId: 'deck-strategist' },
    { id: 'storyboard', name: 'Storyboard Designer', alias: '@story', desc: '整理 PRD 与页面叙事。', avatar: '', status: 'busy', creator: 'RiverWatch PM', roleTemplate: 'writer', capabilityTags: ['PRD', '页面叙事'], source: 'user', directCatId: 'storyboard' },
    { id: 'frontend', name: 'Frontend', alias: '@Frontend', desc: '实现 Vue 页面与交互。', avatar: '', status: 'busy', creator: 'RiverWatch PM', roleTemplate: 'frontend', capabilityTags: ['Vue', '移动端'], source: 'user', directCatId: 'frontend' },
    { id: 'devops', name: 'DevOps', alias: '@DevOps', desc: '处理 preview 部署。', avatar: '', status: 'active', creator: 'RiverWatch PM', roleTemplate: 'devops', capabilityTags: ['preview', '部署'], source: 'user', directCatId: 'devops' }
  ];
  const conversations = [
    { id: 'river-pm', channelId: 'river-pm', channelType: 1, name: 'RiverWatch PM', avatar: '', type: 'robot', isAgent: true, source: 'mock', directCatId: 'river-pm', roleTemplate: 'coordinator', unread: 0, lastMessage: '我已准备好创建 RiverWatch 项目群。', lastTime: now - 1000 * 60 * 7, isPinned: true, isMuted: false, draft: '', projectThreadId: 'thread-riverwatch' },
    { id: 'riverwatch-group', channelId: 'riverwatch-group', channelType: 2, name: 'RiverWatch 项目群', avatar: '', type: 'group', source: 'mock', unread: 0, lastMessage: 'DevOps: preview 部署已完成。', lastTime: now - 1000 * 60 * 2, isPinned: true, isMuted: false, draft: '', memberCount: 7, isProjectGroup: true, projectThreadId: 'thread-riverwatch' },
    { id: 'river-devops', channelId: 'river-devops', channelType: 1, name: 'DevOps', avatar: '', type: 'robot', isAgent: true, source: 'mock', directCatId: 'devops', roleTemplate: 'devops', unread: 0, lastMessage: '可部署最新 HTML 到 preview 环境。', lastTime: now - 1000 * 60 * 3, isPinned: false, isMuted: false, draft: '' }
  ];
  const requestMsg = { id: 'rw-user-request', senderId: 'me', senderName: '我', content: projectPrompt, type: 'text', time: now - 1000 * 60 * 8, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' };
  const templateCard = {
    cardId: 'coordinator-template-cats-card:riverwatch',
    id: 'coordinator-template-cats-card:riverwatch',
    status: stage.templateStatus || 'pending_confirmation',
    sourceMessageId: 'rw-user-request',
    sourceText: projectPrompt,
    pmDirectChannelId: 'river-pm',
    pmDirectChannelType: 1,
    coordinator: { id: 'river-pm', name: 'RiverWatch PM', avatar: '' },
    requiredProfile: { id: 'riverwatch-delivery', label: 'RiverWatch 多交付项目', roleTemplateIds: ['source-curator', 'deck-strategist', 'storyboard', 'frontend', 'devops'] },
    reusableCats: [{ id: 'river-pm', name: 'RiverWatch PM', roleTemplate: 'coordinator', matchedRole: 'coordinator' }],
    coordinatorProfile: { platform: 'claude-code', provider: 'claude', providerLabel: 'Claude Code', accessMode: 'oauth', authType: 'oauth', accountRef: 'claude', coordinatorId: 'river-pm', coordinatorName: 'RiverWatch PM' },
    items: ['Source Curator', 'Deck Strategist', 'Storyboard Designer', 'Frontend', 'DevOps'].map((name) => ({
      templateId: name.toLowerCase().replaceAll(' ', '-'),
      roleTemplateId: name.toLowerCase().replaceAll(' ', '-'),
      name,
      reason: `${name} 负责 RiverWatch 对应交付链路。`,
      status: stage.templateStatus === 'created' ? 'created' : (stage.templateStatus === 'creating' ? 'creating' : 'pending'),
      agentId: stage.templateStatus === 'created' ? name.toLowerCase().replaceAll(' ', '-') : '',
      error: ''
    })),
    updatedAt: now
  };
  const projectCard = {
    cardId: 'project-group-card:riverwatch',
    id: 'project-group-card:riverwatch',
    status: stage.projectStatus || 'pending_confirmation',
    projectName: 'RiverWatch 项目群',
    sourceText: projectPrompt,
    pmDirectChannelId: 'river-pm',
    pmDirectChannelType: 1,
    coordinator: { id: 'river-pm', name: 'RiverWatch PM', avatar: '' },
    targetCatIds: ['source-curator', 'deck-strategist', 'storyboard', 'frontend', 'devops'],
    workerCatIds: ['source-curator', 'deck-strategist', 'storyboard', 'frontend', 'devops'],
    projectGroupNo: stage.projectStatus === 'created' ? 'riverwatch-group' : '',
    projectGroupName: stage.projectStatus === 'created' ? 'RiverWatch 项目群' : '',
    projectThreadId: 'thread-riverwatch',
    projectBindingId: 'binding-riverwatch',
    updatedAt: now
  };
  const pmMessages = [
    { id: 'rw-pm-hello', senderId: 'river-pm', senderName: 'RiverWatch PM', content: '你好，我是 RiverWatch PM。可以把目标、约束和交付物发给我，我会补齐智能体并创建项目群。', type: 'text', time: now - 1000 * 60 * 9, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
    ...(stage.requested ? [requestMsg] : []),
    ...(stage.requested ? [{ id: 'rw-pm-plan', senderId: 'river-pm', senderName: 'RiverWatch PM', content: '已识别到 RiverWatch 是一个多交付项目：需要资料、PPT、PRD、预算排期、Vue 前端和 preview 部署。我会先盘点缺失模板智能体，再建议创建项目群。', type: 'text', time: now - 1000 * 60 * 7, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }] : []),
    ...(stage.requested ? [{ id: 'rw-template-card', clientMsgNo: 'rw-template-card', type: 'coordinator_template_cats_request', contentType: 'coordinator_template_cats_request', senderId: 'river-pm', senderName: 'RiverWatch PM', content: '协调者盘点：建议创建 5 个缺失模板猫猫（RiverWatch 多交付项目）', time: now - 1000 * 60 * 6, status: 'success', reactions: [], replyRef: null, mentions: [], coordinatorTemplateCatsCard: templateCard, metadata: { coordinator_template_cats_request: true, coordinatorTemplateCatsCard: templateCard } }] : []),
    ...(stage.requested ? [{ id: 'rw-project-card', clientMsgNo: 'rw-project-card', type: 'project_group_confirmation', contentType: 'project_group_confirmation', senderId: 'river-pm', senderName: 'RiverWatch PM', content: 'PM / 协调者建议创建项目群：RiverWatch 项目群', time: now - 1000 * 60 * 5, status: 'success', reactions: [], replyRef: null, mentions: [], projectGroupCard: projectCard, metadata: { project_group_confirmation: true, projectGroupCard: projectCard } }] : [])
  ];
  const groupMessages = [
    { id: 'rw-group-hello', senderId: 'river-pm', senderName: 'RiverWatch PM', content: '项目群已创建。我会按交付物并行分工：资料、PPT、PRD、预算排期、Vue 页面和 preview 部署。', type: 'text', time: now - 1000 * 60 * 14, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
    { id: 'rw-constraint', senderId: 'river-pm', senderName: 'RiverWatch PM', content: '项目约束：预算不超过 5 万，前端使用静态 mock 数据，优先保证移动端可读，水质刷新频率暂定 5 秒。', type: 'text', time: now - 1000 * 60 * 13, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '', manualContextPinned: stage.contextPinned || false, manualContextPinId: stage.contextPinned ? 'pin-riverwatch-constraint' : '' },
    { id: 'rw-file-ppt', senderId: 'deck-strategist', senderName: 'Deck Strategist', name: 'RiverWatch_项目汇报.pptx', fileName: 'RiverWatch_项目汇报.pptx', size: '2.1 MB', fileSize: '2.1 MB', fileType: 'pptx', url: assets.pptxUrl, ...fileBase },
    { id: 'rw-file-prd', senderId: 'storyboard', senderName: 'Storyboard Designer', name: 'RiverWatch_PRD.docx', fileName: 'RiverWatch_PRD.docx', size: '286 KB', fileSize: '286 KB', fileType: 'docx', url: assets.docxUrl, ...fileBase },
    { id: 'rw-file-budget', senderId: 'source-curator', senderName: 'Source Curator', name: 'RiverWatch_预算与排期.xlsx', fileName: 'RiverWatch_预算与排期.xlsx', size: '48 KB', fileSize: '48 KB', fileType: 'xlsx', url: assets.xlsxUrl, ...fileBase },
    { id: 'rw-file-readme', senderId: 'frontend', senderName: 'Frontend', name: 'RiverWatch_技术README.md', fileName: 'RiverWatch_技术README.md', size: '9 KB', fileSize: '9 KB', fileType: 'md', previewContent: '# RiverWatch Vue CDN 技术 README\\n\\n- Vue 3 CDN 单页面，无需后端。\\n- mock 数据包含 pH、溶解氧、浊度、氨氮和站点状态。\\n- 移动端指标卡使用两列布局。\\n- 刷新频率：每 10 秒。', ...fileBase },
    { id: 'rw-file-html', senderId: 'frontend', senderName: 'Frontend', name: 'RiverWatch_展示首页.html', fileName: 'RiverWatch_展示首页.html', size: '18 KB', fileSize: '18 KB', fileType: 'html', previewContent: assets.htmlPreview, ...fileBase },
    ...(stage.revision ? [
      { id: 'rw-revision-user', senderId: 'me', senderName: '我', content: '请改为每 10 秒刷新一次，并同步修改 PRD、README 和 Vue HTML 页面。', type: 'text', time: now - 1000 * 60 * 4, status: 'success', reactions: [], replyRef: { messageId: 'rw-file-prd-selection', senderName: 'RiverWatch_PRD.docx', contentPreview: '水质数据每 5 秒刷新一次。' }, mentions: [], senderAvatar: '' },
      { id: 'rw-file-prd-v2', senderId: 'storyboard', senderName: 'Storyboard Designer', name: 'RiverWatch_PRD_v2.docx', fileName: 'RiverWatch_PRD_v2.docx', size: '290 KB', fileSize: '290 KB', fileType: 'docx', url: assets.docxUrl, ...fileBase },
      { id: 'rw-file-readme-v2', senderId: 'frontend', senderName: 'Frontend', name: 'RiverWatch_技术README_v2.md', fileName: 'RiverWatch_技术README_v2.md', size: '10 KB', fileSize: '10 KB', fileType: 'md', previewContent: '# RiverWatch 技术 README v2\\n\\n刷新频率已改为每 10 秒；移动端两列指标卡；异常点位在站点列表中高亮。', ...fileBase },
      { id: 'rw-file-html-v2', senderId: 'frontend', senderName: 'Frontend', name: 'RiverWatch_展示首页_v2.html', fileName: 'RiverWatch_展示首页_v2.html', size: '19 KB', fileSize: '19 KB', fileType: 'html', previewContent: assets.htmlPreview, ...fileBase }
    ] : []),
    ...(stage.frontendMention ? [
      { id: 'rw-at-frontend', senderId: 'me', senderName: '我', content: '@Frontend 请把移动端首页的指标卡改成两列布局，并在站点列表里突出异常点位。', type: 'text', time: now - 1000 * 60 * 3, status: 'success', reactions: [], replyRef: null, mentions: [{ userId: 'frontend', name: 'Frontend', offset: 0 }], senderAvatar: '' },
      { id: 'rw-frontend-reply', senderId: 'frontend', senderName: 'Frontend', content: '已完成：移动端指标卡保持两列布局，东湾闸口以橙色异常标签突出。新版 HTML 已附上。', type: 'text', time: now - 1000 * 60 * 2, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }
    ] : [])
  ];
  const deploymentCard = {
    cardId: 'deployment-card-riverwatch',
    id: 'deployment-card-riverwatch',
    deploymentRequestId: 'riverwatch-preview',
    status: stage.deploymentStatus || 'pending_confirmation',
    target: 'RiverWatch 展示站',
    environment: 'preview',
    originalText: '请部署当前最新的 RiverWatch_展示首页_v2.html 到 preview 环境。',
    directChannelId: 'river-devops',
    directChannelType: 1,
    catId: 'devops',
    catDisplayName: 'DevOps',
    previewUrl: ['succeeded', 'deployed'].includes(stage.deploymentStatus) ? assets.previewUrl : '',
    downloadUrl: ['queued', 'running', 'succeeded', 'deployed'].includes(stage.deploymentStatus) ? `${baseUrl}/assets/riverwatch-preview.html` : '',
    deploymentRequest: { id: 'riverwatch-preview', status: stage.deploymentStatus || 'pending_confirmation', target: 'RiverWatch 展示站', environment: 'preview', previewUrl: ['succeeded', 'deployed'].includes(stage.deploymentStatus) ? assets.previewUrl : '', downloadUrl: `${baseUrl}/assets/riverwatch-preview.html`, createdAt: now }
  };
  const devopsMessages = [
    { id: 'rw-devops-hello', senderId: 'devops', senderName: 'DevOps', content: '我可以把当前最新 HTML 部署到 preview 环境，部署前会展示确认卡。', type: 'text', time: now - 1000 * 60 * 8, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
    ...(stage.deploymentStatus ? [
      { id: 'rw-deploy-user', senderId: 'me', senderName: '我', content: '请部署当前最新的 RiverWatch_展示首页_v2.html 到 preview 环境。', type: 'text', time: now - 1000 * 60 * 7, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
      { id: 'deployment-card-riverwatch', clientMsgNo: 'deployment-card-riverwatch', type: 'deployment_card', contentType: 'deployment_card', senderId: 'devops', senderName: 'DevOps', content: `部署${stage.deploymentStatus === 'succeeded' ? '完成' : '确认'}：RiverWatch 展示站`, time: now - 1000 * 60 * 6, status: 'success', reactions: [], replyRef: null, mentions: [], deploymentCard, metadata: { deployment_card: true, deploymentCard: deploymentCard } }
    ] : [])
  ];
  const board = {
    id: 'board-riverwatch',
    groupId: 'riverwatch-group',
    groupName: 'RiverWatch 项目群',
    summary: '围绕 RiverWatch 河流水质数据看板，跟踪资料、PPT、PRD、预算、Vue 页面与 preview 部署。',
    memberCount: 7,
    tasks: [
      { id: 'task-source', agentId: 'source-curator', status: 'done', progress: 100, task: '资料与 mock 数据整理', goal: '整理 pH、溶解氧、浊度、氨氮和站点状态样例。', modifyHint: '请补充异常点位的阈值说明。', documents: [{ id: 'doc-budget', name: 'RiverWatch_预算与排期.xlsx', type: 'xlsx', summary: '预算 4.5 万以内、2 周排期' }], logs: [{ time: '09:20', title: '整理水质指标', detail: '完成 5 个站点和 24 小时趋势样例。' }] },
      { id: 'task-docs', agentId: 'storyboard', status: 'review', progress: 86, task: 'PRD 与叙事整理', goal: '完成用户场景、功能范围、验收标准和移动端优先约束。', modifyHint: '请把刷新频率统一为每 10 秒。', documents: [{ id: 'doc-prd', name: 'RiverWatch_PRD_v2.docx', type: 'docx', summary: 'PRD v2：刷新频率 10 秒' }], logs: [{ time: '10:10', title: 'PRD 初版完成', detail: '覆盖场景、范围与验收。' }, { time: '11:30', title: '同步 v2 修改', detail: '刷新频率改为 10 秒。' }] },
      { id: 'task-frontend', agentId: 'frontend', status: 'done', progress: 100, task: 'Vue CDN 页面实现', goal: '实现可直接预览的 HTML，移动端两列指标卡并突出异常站点。', modifyHint: '请继续压缩移动端首屏高度。', documents: [{ id: 'doc-html', name: 'RiverWatch_展示首页_v2.html', type: 'html', summary: 'Vue CDN 单页面' }, { id: 'doc-readme', name: 'RiverWatch_技术README_v2.md', type: 'md', summary: '运行方式与 mock 数据说明' }], logs: [{ time: '13:05', title: '完成首页布局', detail: '移动端两列卡片与异常站点标签已完成。' }] },
      { id: 'task-devops', agentId: 'devops', status: stage.deploymentStatus === 'succeeded' ? 'done' : 'doing', progress: stage.deploymentStatus === 'succeeded' ? 100 : 72, task: 'preview 部署', goal: '部署最新 RiverWatch_展示首页_v2.html 并提供 preview URL。', modifyHint: '请补充部署日志摘要。', documents: [{ id: 'doc-preview', name: 'preview-url.txt', type: 'txt', summary: assets.previewUrl }], logs: [{ time: '14:00', title: '创建部署请求', detail: '等待用户同意部署。' }, { time: '14:10', title: '部署完成', detail: 'preview URL 已生成。' }] }
    ]
  };
  return { agents, conversations, pmMessages, groupMessages, devopsMessages, board };
}

async function applyStage(page, assets, stage = {}) {
  const state = demoStateScript({ assets, stage });
  await page.evaluate(({ state, stage }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const piniaKey = Object.getOwnPropertySymbols(app._context.provides).find((symbol) => String(symbol) === 'Symbol(pinia)');
    const pinia = app._context.provides[piniaKey];
    const appStore = pinia._s.get('app');
    const convStore = pinia._s.get('conversation');
    const messageStore = pinia._s.get('message');
    const agentStore = pinia._s.get('agent');
    const groupStore = pinia._s.get('group');
    appStore.currentUser = appStore.currentUser?.id ? appStore.currentUser : { id: 'me', uid: 'me', nickname: 'RiverWatch 演示用户' };
    appStore.token = appStore.token || 'riverwatch-demo-token';
    convStore.conversations = state.conversations;
    convStore.members = {
      ...convStore.members,
      'riverwatch-group': [
        { id: 'me', nickname: '我', role: 'owner', isMuted: false },
        { id: 'river-pm', nickname: 'RiverWatch PM', role: 'admin', isMuted: false, isAgent: true },
        { id: 'source-curator', nickname: 'Source Curator', role: 'member', isMuted: false, isAgent: true },
        { id: 'deck-strategist', nickname: 'Deck Strategist', role: 'member', isMuted: false, isAgent: true },
        { id: 'storyboard', nickname: 'Storyboard Designer', role: 'member', isMuted: false, isAgent: true },
        { id: 'frontend', nickname: 'Frontend', role: 'member', isMuted: false, isAgent: true },
        { id: 'devops', nickname: 'DevOps', role: 'member', isMuted: false, isAgent: true }
      ]
    };
    convStore.announcements = {
      ...convStore.announcements,
      'riverwatch-group': { text: 'RiverWatch 项目群：需求、文档、前端和部署都在本群沉淀。', publisherId: 'river-pm', publishTime: Date.now() }
    };
    convStore.creatorIds = { ...convStore.creatorIds, 'riverwatch-group': 'me' };
    messageStore.messages = {
      ...messageStore.messages,
      'river-pm': state.pmMessages,
      'riverwatch-group': state.groupMessages,
      'river-devops': state.devopsMessages
    };
    const nextAgents = [...state.agents, ...(agentStore.agents || []).filter((agent) => !state.agents.some((item) => item.id === agent.id))];
    agentStore.agents = nextAgents;
    agentStore.boards = [state.board, ...(agentStore.boards || []).filter((board) => board.id !== state.board.id)];
    if (groupStore) {
      groupStore.groups = [
        { id: 'riverwatch-group', groupNo: 'riverwatch-group', name: 'RiverWatch 项目群', memberCount: 7, source: 'mock' },
        ...(groupStore.groups || []).filter((group) => group.id !== 'riverwatch-group')
      ];
    }
    convStore.activeId = stage.activeId || convStore.activeId || 'river-pm';
  }, { state, stage });
  await page.waitForTimeout(waitShort);
}

async function clickText(page, text, options = {}) {
  const clicked = await page.evaluate(({ text, exact }) => {
    const isVisible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const matches = (node) => {
      const content = (node.textContent || '').trim().replace(/\s+/g, ' ');
      if (!content) return false;
      return exact ? content === text : content.includes(text);
    };
    const nodes = Array.from(document.querySelectorAll('button, uni-button, [role="button"], .btn-create, .nav-item, .tab-item, .project-card-btn, .tc-card-btn, .deployment-btn, .action-row, .toggle-detail-btn, span, uni-text, div'))
      .filter((node) => isVisible(node) && matches(node));
    const node = nodes[0];
    if (!node) return false;
    const clickable = node.closest('button, uni-button, [role="button"], .btn-create, .nav-item, .tab-item, .project-card-btn, .tc-card-btn, .deployment-btn, .action-row, .toggle-detail-btn') || node;
    clickable.click();
    return true;
  }, { text, exact: options.exact ?? false }).catch(() => false);
  if (!clicked) {
    await page.getByText(text, { exact: options.exact ?? false }).first().click({ timeout: 15000 });
  }
  await page.waitForTimeout(waitShort);
}

async function clickButtonNearText(page, text, buttonText) {
  await page.evaluate(({ text, buttonText }) => {
    const roots = Array.from(document.querySelectorAll('.file-card, [data-testid], uni-view, div'));
    const root = roots.find((node) => node.textContent?.includes(text));
    if (!root) throw new Error(`Cannot find container for ${text}`);
    const buttons = Array.from(root.querySelectorAll('button, uni-button'));
    const button = buttons.find((item) => item.textContent?.includes(buttonText));
    if (!button) throw new Error(`Cannot find button ${buttonText} near ${text}`);
    button.click();
  }, { text, buttonText });
  await page.waitForTimeout(waitShort);
}

async function gotoChat(page) {
  await page.goto(`${baseUrl}/#/pages/chat/index`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(waitShort);
}

async function closePreviewIfOpen(page) {
  const closeButton = page.locator('.close-icon-btn').first();
  if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(waitShort);
  }
}

async function main() {
  await mkdir(videoDir, { recursive: true });
  await mkdir(finalDocsDir, { recursive: true });
  const [account, assets] = await Promise.all([ensureDemoAccount(), buildDemoAssets()]);
  let browser;
  let context;
  let page;
  const consoleErrors = [];
  const badResponses = [];
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      recordVideo: { dir: videoDir, size: viewport }
    });
    page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`${baseUrl}/#/pages/login/index`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(waitStep);
    await page.locator('input').nth(0).fill(account.phone);
    await page.locator('input').nth(1).fill(account.password);
    await page.waitForTimeout(waitShort);
    await page.locator('.btn-submit').click();
    await page.waitForTimeout(fast ? 1200 : 4500);

    await applyStage(page, assets, { activeId: 'river-pm' });
    await page.waitForTimeout(waitKey);

    await clickText(page, '智能体', { exact: true });
    await page.waitForTimeout(waitStep);
    await clickText(page, '创建智能体');
    await page.waitForTimeout(waitShort);
    await page.locator('input').first().fill('RiverWatch PM').catch(() => {});
    await page.waitForTimeout(waitKey);

    await gotoChat(page);
    await applyStage(page, assets, { activeId: 'river-pm' });
    await page.locator('textarea').first().fill(projectPrompt);
    await page.waitForTimeout(waitKey);
    await applyStage(page, assets, { activeId: 'river-pm', requested: true });
    await page.waitForTimeout(waitKey);

    await clickText(page, '确认创建');
    await applyStage(page, assets, { activeId: 'river-pm', requested: true, templateStatus: 'creating' });
    await page.waitForTimeout(waitDeploy);
    await applyStage(page, assets, { activeId: 'river-pm', requested: true, templateStatus: 'created' });
    await page.waitForTimeout(waitKey);

    await clickText(page, '确认创建');
    await applyStage(page, assets, { activeId: 'river-pm', requested: true, templateStatus: 'created', projectStatus: 'creating' });
    await page.waitForTimeout(waitDeploy);
    await applyStage(page, assets, { activeId: 'river-pm', requested: true, templateStatus: 'created', projectStatus: 'created' });
    await page.waitForTimeout(waitKey);

    await clickText(page, '打开项目群');
    await applyStage(page, assets, { activeId: 'riverwatch-group', requested: true, templateStatus: 'created', projectStatus: 'created' });
    await page.waitForTimeout(waitKey);

    await page.locator('.toggle-detail-btn').first().click();
    await page.waitForTimeout(waitShort);
    await applyStage(page, assets, { activeId: 'riverwatch-group', requested: true, templateStatus: 'created', projectStatus: 'created' });
    const boardVisible = await page.getByText('智能体看板').first().isVisible({ timeout: 2500 }).catch(() => false);
    if (boardVisible) {
      await clickText(page, '智能体看板');
    } else {
      await page.goto(`${baseUrl}/#/pages/agents/board?groupId=riverwatch-group`, { waitUntil: 'networkidle', timeout: 60000 });
      await applyStage(page, assets, { activeId: 'riverwatch-group', requested: true, templateStatus: 'created', projectStatus: 'created' });
    }
    await page.waitForTimeout(waitKey);

    await gotoChat(page);
    await applyStage(page, assets, { activeId: 'riverwatch-group', requested: true, templateStatus: 'created', projectStatus: 'created' });
    await clickButtonNearText(page, 'RiverWatch_项目汇报.pptx', '预览');
    await page.waitForTimeout(waitKey);
    await page.getByText('下一页').first().click().catch(() => {});
    await page.waitForTimeout(waitStep);
    await clickButtonNearText(page, 'RiverWatch_PRD.docx', '预览');
    await page.waitForTimeout(waitKey);
    await clickButtonNearText(page, 'RiverWatch_预算与排期.xlsx', '预览');
    await page.waitForTimeout(waitKey);
    await clickButtonNearText(page, 'RiverWatch_技术README.md', '预览');
    await page.waitForTimeout(waitKey);
    await clickButtonNearText(page, 'RiverWatch_展示首页.html', '预览');
    await page.waitForTimeout(waitKey);
    await clickText(page, '预览', { exact: true }).catch(() => {});
    await page.waitForTimeout(waitKey);

    await closePreviewIfOpen(page);
    await applyStage(page, assets, { activeId: 'riverwatch-group', requested: true, templateStatus: 'created', projectStatus: 'created', contextPinned: true });
    await page.waitForTimeout(waitKey);
    await applyStage(page, assets, { activeId: 'riverwatch-group', requested: true, templateStatus: 'created', projectStatus: 'created', contextPinned: true, revision: true });
    await page.waitForTimeout(waitKey);
    await page.locator('textarea').first().fill('@Frontend 请把移动端首页的指标卡改成两列布局，并在站点列表里突出异常点位。');
    await page.waitForTimeout(waitStep);
    await applyStage(page, assets, { activeId: 'riverwatch-group', requested: true, templateStatus: 'created', projectStatus: 'created', contextPinned: true, revision: true, frontendMention: true });
    await page.waitForTimeout(waitKey);

    await closePreviewIfOpen(page);
    await applyStage(page, assets, { activeId: 'river-devops', requested: true, templateStatus: 'created', projectStatus: 'created', contextPinned: true, revision: true, frontendMention: true });
    await page.waitForTimeout(waitStep);
    await page.locator('textarea').first().fill('请部署当前最新的 RiverWatch_展示首页_v2.html 到 preview 环境。');
    await page.waitForTimeout(waitStep);
    await applyStage(page, assets, { activeId: 'river-devops', deploymentStatus: 'pending_confirmation' });
    await page.waitForTimeout(waitKey);
    await clickText(page, '同意部署');
    for (const status of ['submitting', 'queued', 'running', 'succeeded']) {
      await applyStage(page, assets, { activeId: 'river-devops', deploymentStatus: status });
      await page.waitForTimeout(status === 'succeeded' ? waitKey : waitDeploy);
    }
    await clickText(page, '复制', { exact: true }).catch(() => {});
    await page.waitForTimeout(waitStep);

    const health = await page.evaluate(() => ({
      url: location.href,
      bodyWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      terminalCancelVisible: Array.from(document.querySelectorAll('.deployment-card button, .deployment-card uni-button'))
        .some((node) => node.innerText?.trim() === '取消部署'),
      visibleText: document.body.innerText.slice(0, 1000)
    }));
    if (health.terminalCancelVisible) {
      throw new Error('terminal deployment card still shows cancel action');
    }
    await page.screenshot({ path: path.join(finalDocsDir, 'riverwatch-demo-final-frame.png'), fullPage: true });

    const video = page.video();
    await context.close();
    context = null;
    await browser.close();
    browser = null;
    const rawPath = await video.path();
    const targetPath = path.join(finalDocsDir, 'riverwatch-demo-full.webm');
    await rename(rawPath, targetPath);
    console.log(JSON.stringify({
      video: targetPath,
      finalFrame: path.join(finalDocsDir, 'riverwatch-demo-final-frame.png'),
      fast,
      health,
      badResponses,
      consoleErrors: consoleErrors.filter((line) => !/favicon|ResizeObserver/i.test(line))
    }, null, 2));
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
