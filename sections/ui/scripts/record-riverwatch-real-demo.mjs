import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import playwright from 'playwright';

const { chromium } = playwright;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(__dirname, '..');
const seedcmpRoot = path.resolve(uiRoot, '../..');
const finalDocsDir = path.join(seedcmpRoot, 'final_docs');
const workDir = path.join(finalDocsDir, 'riverwatch-real-demo-work');
const clowderWorkspaceRoot = path.join(seedcmpRoot, 'sections/clowder-ai/.clowder/workspaces');
const clowderApiLogDir = path.join(seedcmpRoot, 'sections/clowder-ai/packages/api/data/logs/api');

function parseRiverWatchDemoArgs(argv = []) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = (name) => {
      if (arg.includes('=')) return arg.slice(arg.indexOf('=') + 1);
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${name} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === '--fast') {
      parsed.fast = true;
    } else if (arg === '--no-fast') {
      parsed.fast = false;
    } else if (arg === '--suffix' || arg.startsWith('--suffix=')) {
      parsed.suffix = readValue('--suffix');
    } else if (arg === '--ui-url' || arg.startsWith('--ui-url=')) {
      parsed.baseUrl = readValue('--ui-url');
    } else if (arg === '--api-base' || arg.startsWith('--api-base=')) {
      parsed.apiBase = readValue('--api-base');
    } else if (arg === '--clowder-api-base' || arg.startsWith('--clowder-api-base=')) {
      parsed.clowderApiBase = readValue('--clowder-api-base');
    } else if (arg === '--ai-timeout-ms' || arg.startsWith('--ai-timeout-ms=')) {
      parsed.aiWaitTimeout = Number(readValue('--ai-timeout-ms'));
    } else if (arg === '--ai-provider' || arg.startsWith('--ai-provider=')) {
      parsed.aiProvider = readValue('--ai-provider');
    }
  }

  return parsed;
}

function resolveRiverWatchDemoConfig({ argv = process.argv.slice(2), env = process.env, now = Date.now() } = {}) {
  const parsedArgs = parseRiverWatchDemoArgs(argv);
  const fast = parsedArgs.fast ?? env.RIVERWATCH_DEMO_FAST === '1';

  return {
    baseUrl: parsedArgs.baseUrl || env.AGENTHUB_UI_URL || 'http://localhost:5173',
    apiBase: parsedArgs.apiBase || env.AGENTHUB_API_BASE || 'http://127.0.0.1:8090/v1',
    clowderApiBase: parsedArgs.clowderApiBase || env.CLOWDER_API_BASE || 'http://127.0.0.1:3004',
    suffix: parsedArgs.suffix || env.RIVERWATCH_DEMO_SUFFIX || String(now).slice(-6),
    fast,
    aiWaitTimeout: parsedArgs.aiWaitTimeout || Number(env.RIVERWATCH_AI_TIMEOUT_MS || (fast ? 600000 : 1800000)),
    aiProvider: String(parsedArgs.aiProvider || env.RIVERWATCH_AI_PROVIDER || 'claude').toLowerCase()
  };
}

const {
  baseUrl,
  apiBase,
  clowderApiBase,
  suffix,
  fast,
  aiWaitTimeout,
  aiProvider
} = resolveRiverWatchDemoConfig();
const waitBrief = fast ? 250 : 1200;
const waitStep = fast ? 700 : 15000;
const waitKey = fast ? 1000 : 18000;
const waitLong = fast ? 1300 : 22000;
const viewport = { width: 1440, height: 900 };
const aiPlatform = aiProvider.includes('claude') ? {
  label: 'Claude Code',
  readyText: '已检测到 Claude Code 本机登录'
} : {
  label: 'Codex',
  readyText: '已检测到 Codex 本机登录'
};
const usgsInstantValuesUrl = 'https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=ny&parameterCd=00400,00300,63680&siteStatus=active';
const metricDefinitions = {
  '00400': { key: 'ph', label: 'pH', unit: '', good: (value) => value >= 6.5 && value <= 8.5 },
  '00300': { key: 'dissolvedOxygen', label: '溶解氧', unit: 'mg/L', good: (value) => value >= 5 },
  '63680': { key: 'turbidity', label: '浊度', unit: 'FNU', good: (value) => value <= 10 }
};

const expectedRiverWatchDeliverables = [
  { fileName: 'RiverWatch_项目汇报.md', acceptedBaseNames: ['RiverWatch_项目汇报'], acceptedFileTypes: ['md', 'ppt', 'pptx', 'pdf'] },
  { fileName: 'RiverWatch_PRD.md', acceptedBaseNames: ['RiverWatch_PRD'], acceptedFileTypes: ['md', 'doc', 'docx', 'pdf'] },
  { fileName: 'RiverWatch_预算与排期.md', acceptedBaseNames: ['RiverWatch_预算与排期'], acceptedFileTypes: ['md', 'xls', 'xlsx', 'csv', 'pdf'] },
  { fileName: 'RiverWatch_技术README.md', acceptedBaseNames: ['RiverWatch_技术README'], acceptedFileTypes: ['md'] },
  { fileName: 'RiverWatch_展示首页.html', acceptedBaseNames: ['RiverWatch_展示首页'], acceptedFileTypes: ['html', 'htm'] }
];

const expectedRiverWatchRevisionDeliverables = [
  { fileName: 'RiverWatch_PRD_v2.md', acceptedBaseNames: ['RiverWatch_PRD_v2', 'RiverWatch_PRD'], acceptedFileTypes: ['md', 'doc', 'docx', 'pdf'] },
  { fileName: 'RiverWatch_技术README_v2.md', acceptedBaseNames: ['RiverWatch_技术README_v2', 'RiverWatch_技术README'], acceptedFileTypes: ['md'] },
  { fileName: 'RiverWatch_展示首页_v2.html', acceptedBaseNames: ['RiverWatch_展示首页_v2', 'RiverWatch_展示首页'], acceptedFileTypes: ['html', 'htm'] }
];

function buildProjectPrompt(snapshot) {
  return `我想做一个 RiverWatch 河流水质数据看板项目，请你作为 PM 创建项目群并组织多智能体分工执行。

交付物需要包括：
- 项目汇报 PPT
- 产品需求文档 PRD
- 预算与排期表
- Vue 前端技术 README
- 一个可直接预览的 Vue CDN 单页面 HTML
- preview 部署链接

约束：
- 前端使用公开水质数据快照，不接后端、不伪造不可用指标
- 禁止使用 mock、模拟、估算或占位数据；缺失指标必须显示 N/A / 未返回，并解释真实来源限制
- 总预算不超过 5 万
- 优先保证移动端可读
- 水质指标包括 pH、溶解氧、浊度、氨氮和站点状态
- PPT 受众默认按内部项目评审处理，不要等待用户补充确认
- preview 部署方式默认使用 AgentHub preview，不要等待用户补充确认
- 数据源优先使用 USGS NWIS 即时值，当前主站点为 ${snapshot.primarySite.name}（${snapshot.primarySite.siteCode}）

本轮请先只完成缺失执行猫盘点和 RiverWatch 项目群确认卡，不要在 PM 直聊里开始生成 PPT、PRD、预算表、README、HTML 或部署卡；这个限制只适用于 PM 直聊建群阶段。项目群创建后，我会在项目群里发送正式执行请求，届时请提醒执行智能体忽略本条“只建群”阶段限制，开始真实生成交付物。

重要：请不要调用后端 thread proposal / 提议新建 thread，也不要在 PM 直聊或任何中间群聊中 @runtime-cat-* 旧执行猫。项目群只通过当前 IM Web 前端展示的“项目群确认卡”创建，成员必须继承当前 PM 的 Claude Code + OAuth 认证。`;
}

function buildProjectExecutionPrompt() {
  return `RiverWatch 项目群正式执行阶段公告：

请在本项目群内真实分工完成 RiverWatch 第一版交付物。本公告只用于宣布阶段边界和交付约束，本公告不要求任何智能体回复，也不要求任何智能体现在开始执行。后续我会逐个发送单角色执行请求，真正的 Claude/OAuth 执行只以那些单角色请求为准。

阶段切换说明：此前 PM 直聊中的“本轮只完成缺失执行猫盘点和项目群确认卡、不要生成交付物”只适用于直聊建群阶段；现在项目群已经创建并进入正式执行阶段，该限制已经结束，任何执行智能体不得用它拒绝生成文件。

本消息不是让 PM 继续规划或创建任务；单角色执行请求中的执行智能体必须在当前项目群直接执行、写入真实 workspace，并亲自回复自己的真实文件卡。不要检索旧 thread，不要复用旧线程或历史 demo 产物，不要把旧线程内容当作本群交付物。

要求：
- Source Curator 整理公开水质数据来源和可用快照，不得编造无法验证的数据；
- Deck Strategist 生成 RiverWatch_项目汇报.*，可用 md/ppt/pptx/pdf；
- Storyboard Designer 生成 RiverWatch_PRD.*，可用 md/doc/docx/pdf；
- PM 生成 RiverWatch_预算与排期.*，可用 md/xls/xlsx/csv/pdf；
- Frontend 生成 RiverWatch_技术README.md 和 RiverWatch_展示首页.html；
- 所有产物请作为群聊文件卡发送，保留真实 workspace 文件路径，便于右侧预览和后续部署。
- 单角色执行请求中的执行智能体必须亲自回复自己的真实文件卡；PM 只能协调缺口，不能只汇总“已分派/会完成/可继续”。

默认决策：
- PPT 受众使用“内部项目评审”，不要等待用户补充确认；
- 部署方式使用“AgentHub preview”，不要等待用户补充确认；
- 继续并行完成全部交付物，不要停在“待派发”“等待确认”“2 分钟后检查进度”。

文件名要求：
- 文件基础名必须清晰对应交付物：RiverWatch_项目汇报、RiverWatch_PRD、RiverWatch_预算与排期、RiverWatch_技术README、RiverWatch_展示首页；
- 项目汇报后缀可为 .md/.ppt/.pptx/.pdf；PRD 后缀可为 .md/.doc/.docx/.pdf；预算后缀可为 .md/.xls/.xlsx/.csv/.pdf；
- README 必须是 .md，展示首页必须是可直接预览和部署的 .html/.htm；
- 不得使用 prd.md、budget-schedule.md、presentation.md、README.md、index.html、riverwatch-prd.md、riverwatch-project-report.md、riverwatch-frontend-readme.md、riverwatch-dashboard.html 作为最终群聊文件卡名称；
- 如果先生成英文小写或通用草稿，必须再导出/复制为上述 RiverWatch_* 基础名并发送真实文件卡；
- 内容必须来自 AI 刚生成的 RiverWatch 文档与真实数据来源，不得填充 mock 内容。
- 在五个群聊文件卡都发送前，不要启动 preview server，不要进入部署步骤，不要只汇报计划。

文件卡协议：
- 请先在真实 workspace 中创建文件，再在最终回复里列出文件路径；
- 同时使用下面格式发送 \`cc_rich\` 文件块，确保 IM 群聊出现可预览文件卡；
- \`url\` 必须指向你刚创建的真实文件路径或后端可访问的 workspace/raw 路径，不得指向预置 assets。

\`\`\`cc_rich
{
  "v": 1,
  "blocks": [
    {
      "id": "riverwatch-deliverable-example",
      "v": 1,
      "kind": "file",
      "fileName": "RiverWatch_展示首页.html",
      "url": "/api/workspaces/<thread-or-workspace>/raw/RiverWatch_展示首页.html",
      "mimeType": "text/html"
    }
  ]
}
\`\`\`

禁止使用 mock、占位数据、预置 assets 或伪造文件；禁止使用模拟数据、估算数据；不得使用模拟数据。如果公开数据缺失，请显示 N/A / 未返回并说明来源限制，不得用模拟值补齐。`;
}

function buildDirectRoleExecutionPrompts() {
  const sharedRules = `共同规则：
- 阶段切换：PM 直聊里的“只建群、不生成交付物”限制已经结束；当前项目群消息是正式执行请求，必须真实生成对应 workspace 文件和文件卡；
- 只处理当前 RiverWatch 项目群，不要检索旧 thread，不要复用旧线程、历史 demo、预置 assets 或 mock 页面；
- 必须在真实 workspace 中创建文件，再用 \`\`\`cc_rich\`\`\` file block 发送到本群；
- url 必须指向真实 workspace/raw 路径、/uploads 路径或真实本地文件路径；
- 禁止使用 mock、模拟数据、估算数据或占位数据；缺失指标显示 N/A / 未返回，并说明来源限制；
- 不要启动 preview server，不要部署，不要只回复计划或“我将会”。`;

  return [
    {
      role: 'source-curator',
      prompt: `@狸花猫（资料整理师）

请你只负责当前 RiverWatch 项目群的数据来源包：在真实 workspace 写入 source-pack.md 和 usgs-nwis-snapshot.json，并作为本群文件卡发送。内容需要说明 USGS NWIS 站点、快照时间、pH/溶解氧/浊度/氨氮可用性，氨氮缺失时必须写 N/A / 未返回。

执行步骤必须按顺序完成：
1. 使用真实 USGS NWIS 即时值接口获取公开数据：${usgsInstantValuesUrl}
2. 只从接口返回内容整理 pH、溶解氧、浊度、站点状态和采样时间；USGS 没返回氨氮时写 N/A / 未返回，不得自行补数；
3. 先在当前真实 workspace 写入 source-pack.md 和 usgs-nwis-snapshot.json，再回复本群；
4. 如果真实请求失败，也必须在真实 workspace 写入上述两个文件，记录“真实请求失败”、错误信息、接口 URL、缺失指标 N/A / 未返回，不得改用 mock、模拟或估算数据；
5. 最终回复必须列出真实 workspace 路径，并包含 \`\`\`cc_rich\`\`\` 文件块，两个 file block 的 fileName 分别是 source-pack.md 和 usgs-nwis-snapshot.json。

${sharedRules}`
    },
    {
      role: 'deck-strategist',
      prompt: `@俄罗斯蓝猫（叙事策略师）

请你只负责生成 RiverWatch_项目汇报 文件。项目汇报内容来自当前项目群真实数据来源和 AI 产物：项目背景、用户价值、看板结构、公开数据快照、风险与部署计划。文件可为 .md/.ppt/.pptx/.pdf，请在真实 workspace 生成 RiverWatch_项目汇报.* 文件，并作为本群文件卡发送。

${sharedRules}`
    },
    {
      role: 'storyboard-designer',
      prompt: `@土耳其安哥拉猫（分镜设计师）

请你只负责生成 RiverWatch_PRD 文件。PRD 内容来自当前项目群真实数据来源和需求约束：用户场景、功能范围、验收标准、移动端优先、不可用指标显示规则。文件可为 .md/.doc/.docx/.pdf，请在真实 workspace 生成 RiverWatch_PRD.* 文件，并作为本群文件卡发送。

${sharedRules}`
    },
    {
      role: 'pm-budget',
      prompt: `@riverpm${suffix}

请你这次只负责生成 RiverWatch_预算与排期 文件，不要继续总调度。表格内容来自当前项目群真实需求：预算不超过 5 万、2 周排期、角色分工、风险项和验收节点。文件可为 .md/.xls/.xlsx/.csv/.pdf，请在真实 workspace 生成 RiverWatch_预算与排期.* 文件，并作为本群文件卡发送。

${sharedRules}`
    },
    {
      role: 'frontend',
      prompt: `@波斯猫（前端工程师）

请你只负责生成 RiverWatch_技术README.md 和 RiverWatch_展示首页.html。HTML 必须是可直接打开预览的 Vue CDN 单页面，展示 pH、溶解氧、浊度、氨氮 N/A / 未返回、USGS site active 状态和移动端两列指标卡。请在真实 workspace 生成 exact 文件名，并把两个文件都作为本群文件卡发送。

${sharedRules}`
    }
  ];
}

function buildRevisionPrompt() {
  return '请把 USGS 数据来源、主站点和采样时间补到 PRD、README 和 Vue HTML 首屏，并保持不可用指标显示 N/A。禁止使用模拟数据或估算值。请分别发送 RiverWatch_PRD_v2.md、RiverWatch_技术README_v2.md 和 RiverWatch_展示首页_v2.html 真实文件卡；如需要，请使用 cc_rich file block 指向真实 workspace 文件。';
}

function buildFrontendMentionPrompt() {
  return '@Frontend 请把移动端首页的指标卡保持两列布局，并在站点列表里突出需关注点位，同时不要给氨氮编造数值，也不要使用模拟数据。完成后请发送最新 RiverWatch_展示首页 HTML 真实文件卡；如需要，请使用 cc_rich file block 指向真实 workspace 文件。';
}

function buildDeploymentPrompt(latestHtmlFileName = 'RiverWatch_展示首页_v2.html') {
  return `@RiverWatch PM 请基于当前最新的 ${latestHtmlFileName}，在本项目群聊内提供 preview 部署确认卡。部署目标必须使用真实 HTML 文件路径，不要使用示例链接或 mock 页面。`;
}

function buildFileCardRecoveryPrompt() {
  return `@狸花猫（资料整理师）
@俄罗斯蓝猫（叙事策略师）
@土耳其安哥拉猫（分镜设计师）
@波斯猫（前端工程师）
@孟加拉猫（DevOps）

当前群聊还没有收到群聊文件卡。请不要只发文字总结，请在当前 RiverWatch 项目群的真实 workspace 中创建、转换或导出为以下真实文件，并立即用 cc_rich file block 逐个发送到本项目群：

- RiverWatch_项目汇报.*（md/ppt/pptx/pdf 均可）
- RiverWatch_PRD.*（md/doc/docx/pdf 均可）
- RiverWatch_预算与排期.*（md/xls/xlsx/csv/pdf 均可）
- RiverWatch_技术README.md
- RiverWatch_展示首页.html

要求：
- 文件内容必须来自当前项目群里真实生成的 RiverWatch workspace 产物；
- 不要检索旧 thread，不要复用旧线程、历史 demo 或 \`sections/ui/assets\` 中的内容；
- 每个被 @ 的执行智能体必须亲自回复自己的真实文件卡，不能只让 PM 代写状态总结；
- 文件基础名必须对应上面 RiverWatch_* 名称；不得使用 prd.md、budget-schedule.md、presentation.md、README.md、index.html、riverwatch-prd.md、riverwatch-project-report.md、riverwatch-frontend-readme.md、riverwatch-dashboard.html 作为最终文件卡；
- 如果你已经写出了英文小写文件，请立即在同一真实 workspace 中复制/导出为 RiverWatch_* 文件名：
  - riverwatch-project-report.* -> RiverWatch_项目汇报.*
  - riverwatch-prd.* -> RiverWatch_PRD.*
  - riverwatch-budget-schedule.* -> RiverWatch_预算与排期.*
  - riverwatch-frontend-readme.md -> RiverWatch_技术README.md
  - riverwatch-dashboard.html -> RiverWatch_展示首页.html
- md/ppt/xls/doc/pdf/csv 等真实可预览格式都可作为对应文档交付；
- HTML 必须是可直接打开预览的 Vue CDN 单页面；
- 不得使用模拟数据、估算数据、占位数据或预置 assets；
- 公开数据缺失时显示 N/A / 未返回并说明来源限制；
- 在五个群聊文件卡全部发出前，不要启动 preview server，不要部署，不要只写“我将会”；
- 最终回复中必须包含 \`\`\`cc_rich\`\`\` 文件块，fileName 必须使用上面的 RiverWatch_* 基础名，url 指向真实 workspace/raw 路径、/uploads 路径或真实本地文件路径。`;
}

function buildDeliverableConvergencePrompt() {
  return `@狸花猫（资料整理师）
@俄罗斯蓝猫（叙事策略师）
@土耳其安哥拉猫（分镜设计师）
@波斯猫（前端工程师）
@孟加拉猫（DevOps）

请基于已经完成的 source-pack.md、usgs-nwis-snapshot.json、data-source-contract.md 以及当前 workspace 里的 RiverWatch 草稿，立即收敛第一版交付物。

这一步不要继续只做规划，不要再只做任务编排，不要再开新的子 thread；请把已经完成的真实内容导出为五个 RiverWatch 文件，并把五个文件都作为本项目群文件卡发送：

- RiverWatch_项目汇报.*（md/ppt/pptx/pdf 均可）
- RiverWatch_PRD.*（md/doc/docx/pdf 均可）
- RiverWatch_预算与排期.*（md/xls/xlsx/csv/pdf 均可）
- RiverWatch_技术README.md
- RiverWatch_展示首页.html

执行要求：
- 文件内容只能来自本群真实 AI 已完成的 source pack、USGS snapshot、PRD/预算/README/HTML/PPT 草稿和 workspace 文件；
- 只允许使用当前 RiverWatch 项目群的真实 workspace 文件；不要检索旧 thread，不要复用旧线程、历史 demo 或 \`sections/ui/assets\` 里的内容；
- 每个被 @ 的执行智能体必须亲自回复自己的真实文件卡，不能只让 PM 汇总、继续分派、登记任务或回复“已完成”；
- 如果已存在通用草稿，请按以下映射导出 RiverWatch 文件：prd.* -> RiverWatch_PRD.*、budget-schedule.* -> RiverWatch_预算与排期.*、README.md -> RiverWatch_技术README.md、index.html -> RiverWatch_展示首页.html；
- 如果已有项目汇报叙事草稿或 riverwatch-project-report.*，请导出/重命名为 RiverWatch_项目汇报.*；
- 禁止使用 mock、模拟数据、估算数据、占位数据、预置 assets 或脚本生成内容；
- md/ppt/xls/doc/pdf/csv 等真实可预览格式都可作为对应文档交付；如已有草稿，请由 AI 在真实 workspace 内复制为上述 RiverWatch_* 基础名，再发送文件卡；
- 氨氮未返回必须显示 N/A / 未返回，站点状态只能写 USGS site active，不得推断水质安全或健康；
- HTML 必须是可直接打开预览的 Vue CDN 单页面；
- 在五个 RiverWatch 文件卡发送前，不要进入部署、preview server 或“等待下一步确认”。

最终回复必须包含 \`\`\`cc_rich\`\`\` 文件块；每个 block 的 fileName 必须使用上面的 RiverWatch_* 基础名，url 必须指向真实 workspace/raw 路径、/uploads 路径或真实本地文件路径。`;
}

function latestValidValue(series = {}) {
  const values = series.values?.[0]?.value || [];
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const item = values[index];
    const numeric = Number(item?.value);
    if (Number.isFinite(numeric) && numeric > -9999) return { value: numeric, dateTime: item.dateTime || '' };
  }
  return null;
}

function normalizeSiteName(value = '') {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/ AT /g, ' at ')
    .replace(/ NEAR /g, ' near ')
    .replace(/ NY$/i, ', NY')
    .trim();
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return 'N/A';
  return Number(value).toFixed(digits).replace(/\.0$/, '');
}

function formatSnapshotTime(value = '') {
  if (!value) return '未返回时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function buildMetricStatus(code, numeric) {
  const definition = metricDefinitions[code];
  if (!definition || !Number.isFinite(Number(numeric))) return { label: '缺测', className: 'missing' };
  return definition.good(Number(numeric)) ? { label: '正常', className: 'ok' } : { label: '关注', className: 'warn' };
}

function pickPrimarySite(sites) {
  const preferredSiteIds = ['01304562', '01302020', '01303152', '04231600'];
  for (const siteId of preferredSiteIds) {
    const site = sites.find((item) => item.siteCode === siteId && item.metrics['00400'] && item.metrics['00300'] && item.metrics['63680']);
    if (site) return site;
  }
  return sites.find((item) => item.metrics['00400'] && item.metrics['00300'] && item.metrics['63680']) || sites[0];
}

function buildUnavailableWaterSnapshot(error = '') {
  const primarySite = {
    siteCode: '01304562',
    name: 'PECONIC RIVER at County Hwy 105 at Riverhead, NY'
  };
  const indicators = Object.entries(metricDefinitions).map(([code, definition]) => ({
    code,
    key: definition.key,
    label: definition.label,
    unit: definition.unit,
    value: 'N/A',
    numericValue: null,
    sampledAt: '',
    statusLabel: '未返回',
    statusClass: 'missing',
    source: 'USGS NWIS instantaneous values request failed'
  }));
  indicators.push({
    code: '00610',
    key: 'ammonia',
    label: '氨氮',
    unit: 'mg/L as N',
    value: 'N/A',
    numericValue: null,
    sampledAt: '',
    statusLabel: '未返回',
    statusClass: 'missing',
    source: 'USGS NWIS instantaneous values request failed'
  });
  return {
    sourceUrl: usgsInstantValuesUrl,
    sourceName: 'USGS NWIS instantaneous values',
    generatedAt: new Date().toISOString(),
    primarySite: {
      siteCode: primarySite.siteCode,
      name: normalizeSiteName(primarySite.name)
    },
    sampleTime: '',
    indicators,
    stationStatuses: [{
      siteCode: primarySite.siteCode,
      name: normalizeSiteName(primarySite.name),
      statusLabel: '未返回',
      statusClass: 'missing',
      detail: 'USGS request failed; no fallback numeric values used'
    }],
    warning: error || 'USGS NWIS request failed; no fallback numeric values used'
  };
}

function buildWaterSnapshotFromSite(primarySite, sites, warning = '') {
  const indicators = Object.entries(metricDefinitions).map(([code, definition]) => {
    const metric = primarySite.metrics[code] || {};
    const status = buildMetricStatus(code, metric.value);
    return {
      code,
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      value: formatNumber(metric.value),
      numericValue: metric.value,
      sampledAt: metric.dateTime || '',
      statusLabel: status.label,
      statusClass: status.className,
      source: 'USGS NWIS instantaneous values'
    };
  });
  indicators.push({
    code: '00610',
    key: 'ammonia',
    label: '氨氮',
    unit: 'mg/L as N',
    value: 'N/A',
    numericValue: null,
    sampledAt: '',
    statusLabel: '未返回',
    statusClass: 'missing',
    source: 'USGS/WQP: selected surface-water station returned no recent ammonia value'
  });

  const stationStatuses = sites
    .filter((site) => site.metrics['00400'] && site.metrics['00300'] && site.metrics['63680'])
    .slice(0, 5)
    .map((site) => {
      const statuses = Object.keys(metricDefinitions).map((code) => buildMetricStatus(code, site.metrics[code]?.value));
      const warnCount = statuses.filter((status) => status.className !== 'ok').length;
      return {
        siteCode: site.siteCode,
        name: normalizeSiteName(site.name),
        statusLabel: warnCount > 0 ? '需关注' : '正常',
        statusClass: warnCount > 0 ? 'warn' : 'ok',
        detail: `pH ${formatNumber(site.metrics['00400']?.value)} · DO ${formatNumber(site.metrics['00300']?.value)} · Turb ${formatNumber(site.metrics['63680']?.value)}`
      };
    });

  const allTimes = indicators.map((item) => item.sampledAt).filter(Boolean).sort();
  return {
    sourceUrl: usgsInstantValuesUrl,
    sourceName: 'USGS NWIS instantaneous values',
    generatedAt: new Date().toISOString(),
    primarySite: {
      siteCode: primarySite.siteCode,
      name: normalizeSiteName(primarySite.name)
    },
    sampleTime: allTimes.at(-1) || '',
    indicators,
    stationStatuses,
    warning
  };
}

async function fetchWaterQualitySnapshot() {
  try {
    const response = await fetch(usgsInstantValuesUrl);
    if (!response.ok) throw new Error(`USGS NWIS request failed: ${response.status}`);
    const body = await response.json();
    const grouped = new Map();
    for (const series of body.value?.timeSeries || []) {
      const siteCode = String(series.sourceInfo?.siteCode?.[0]?.value || '').trim();
      const siteName = String(series.sourceInfo?.siteName || '').trim();
      const variableCode = String(series.variable?.variableCode?.[0]?.value || '').trim();
      if (!siteCode || !metricDefinitions[variableCode]) continue;
      const latest = latestValidValue(series);
      if (!latest) continue;
      if (!grouped.has(siteCode)) grouped.set(siteCode, { siteCode, name: siteName, metrics: {} });
      grouped.get(siteCode).metrics[variableCode] = latest;
    }
    const sites = Array.from(grouped.values());
    const primarySite = pickPrimarySite(sites);
    if (!primarySite) throw new Error('USGS NWIS returned no usable pH/oxygen/turbidity site');
    return buildWaterSnapshotFromSite(primarySite, sites);
  } catch (error) {
    return buildUnavailableWaterSnapshot(error?.message || String(error));
  }
}

function riverWatchDemoResetAgentIds(agents = []) {
  const demoRoleNamePattern = /狸花猫（资料整理师）|俄罗斯蓝猫（叙事策略师）|土耳其安哥拉猫（分镜设计师）/;
  const demoAgentIdPattern = /^riverwatch-(?:source-curator|deck-strategist|storyboard-designer)-\d+$/i;
  const protectedIds = new Set([
    'bobo',
    'pm',
    'duanduan',
    'sensen',
    'devops',
    'source-curator',
    'deck-strategist',
    'storyboard-designer',
    'frontend',
    'qa',
    'coordinator',
    'svg-executor-guardian',
    'deck-qa-exporter',
    'architect',
    'peer-reviewer'
  ]);
  const nonRuntimeSources = new Set(['disconnected', 'role-template', 'cat-template']);
  return (Array.isArray(agents) ? agents : [])
    .filter((agent) => {
      const catId = String(agent.catId || agent.id || '').trim();
      const displayName = String(agent.displayName || agent.name || '').trim();
      const source = String(agent.source || agent.raw?.source || agent.raw?.kind || '').trim().toLowerCase();
      if (protectedIds.has(catId)) return false;
      if (nonRuntimeSources.has(source)) return false;
      if (/^riverpm\d+$/i.test(catId)) return true;
      if (demoAgentIdPattern.test(catId)) return true;
      if (/^runtime-cat-/i.test(catId)) return true;
      return demoRoleNamePattern.test(displayName);
    })
    .map((agent) => String(agent.catId || agent.id || '').trim())
    .filter(Boolean);
}

async function resetDemoRuntimeCats() {
  if (process.env.RIVERWATCH_RESET_RUNTIME_CATS === '0') return [];
  const response = await fetch(`${clowderApiBase.replace(/\/$/, '')}/api/connectors/im-web/agents?externalChatId=1:clowder_ai`).catch(() => null);
  if (!response?.ok) return [];
  const body = await response.json().catch(() => ({}));
  const ids = riverWatchDemoResetAgentIds(body.agents || []);
  for (const id of ids) {
    await fetch(`${clowderApiBase.replace(/\/$/, '')}/api/cats/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Cat-Cafe-User': 'riverwatch-demo-reset' }
    }).catch(() => null);
  }
  return ids;
}

async function apiFetch(endpoint, options = {}, token = '') {
  const response = await fetch(`${apiBase.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { token } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { text };
  }
  if (!response.ok) {
    throw new Error(`${endpoint} failed ${response.status}: ${text.slice(0, 500)}`);
  }
  return body;
}

function normalizeSession(raw = {}) {
  const user = raw.user || raw.data?.user || raw.data || raw;
  const token = raw.token || raw.data?.token || user.token || '';
  const uid = user.uid || user.id || user.user_id || raw.uid || raw.data?.uid || '';
  return {
    token,
    user: {
      ...user,
      id: uid || user.id,
      uid: uid || user.uid,
      nickname: user.name || user.nickname || `RiverWatch 演示用户 ${suffix}`,
      raw: user
    }
  };
}

async function ensureAccount() {
  const phone = process.env.AGENTHUB_DEMO_PHONE || `196${String(Date.now()).slice(-8)}`;
  const password = process.env.AGENTHUB_DEMO_PASSWORD || 'Demo12345';
  if (!process.env.AGENTHUB_DEMO_PHONE) {
    await apiFetch('user/sms/registercode', {
      method: 'POST',
      body: JSON.stringify({ zone: '0086', phone })
    }).catch(() => null);
    return { phone, password };
  }

  const loggedIn = await apiFetch('user/login', {
    method: 'POST',
    body: JSON.stringify({
      username: phone,
      password,
      flag: 1,
      device: {
        device_id: `riverwatch-real-demo-${suffix}`,
        device_name: 'Playwright',
        device_model: 'Chromium'
      }
    })
  });
  const session = normalizeSession(loggedIn);
  return { phone, password, ...session };
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(workDir, `${name}.png`), fullPage: true });
}

async function clickText(page, text, options = {}) {
  const locator = page.getByText(text, { exact: options.exact ?? false }).first();
  await locator.waitFor({ timeout: options.timeout || 30000 });
  await locator.click({ timeout: options.timeout || 30000 });
  await page.waitForTimeout(waitBrief);
}

async function clickButtonText(page, text, options = {}) {
  const locator = page.locator('button, uni-button, [role="button"]').filter({ hasText: text }).first();
  await locator.waitFor({ timeout: options.timeout || 30000 });
  await locator.click({ timeout: options.timeout || 30000 });
  await page.waitForTimeout(waitBrief);
}

async function fillInput(page, index, value) {
  const input = page.locator('input').nth(index);
  await input.waitFor({ timeout: 30000 });
  await input.fill(value);
}

async function fillLastTextarea(page, value) {
  const input = page.locator('textarea').last();
  await input.waitFor({ timeout: 30000 });
  await input.fill(value);
}

async function sendCurrentInput(page) {
  const composer = page.locator('.message-input-area').last();
  await composer.waitFor({ timeout: 30000 });
  const sendButton = composer
    .locator('.desktop-input-container .input-box-row .btn-send-msg, .input-box-row .btn-send-msg, .mobile-input-row .mobile-send-btn-new, .mobile-send-btn-new')
    .last();
  await sendButton.waitFor({ timeout: 30000 });
  await sendButton.click({ timeout: 30000 });
  await page.waitForTimeout(waitBrief);
}

async function maybeConfirmTemplateCats(page) {
  const card = page.locator('[data-testid="coordinator-template-cats-card"]').first();
  const appeared = await card.waitFor({ timeout: fast ? 5000 : 15000 }).then(() => true).catch(() => false);
  if (!appeared) return false;
  const confirm = card.getByText('确认创建', { exact: true }).first();
  if (await confirm.count()) {
    await confirm.click({ timeout: 30000 });
    await card.getByText('已创建', { exact: false }).first().waitFor({ timeout: 60000 });
  }
  return true;
}

async function selectRole(page) {
  const picker = page.locator('.picker-trigger').first();
  await picker.waitFor({ timeout: 30000 });
  await picker.click();
  const option = page.locator('.uni-picker-item', { hasText: '暹罗猫（协调者）' }).filter({ visible: true }).first();
  await option.waitFor({ timeout: 30000 });
  await option.click();
  const done = page.locator('.uni-picker-action-confirm').filter({ visible: true }).first();
  if (await done.count()) await done.click();
  await page.getByText('暹罗猫（协调者）', { exact: false }).first().waitFor({ timeout: 30000 });
}

async function openAgentsAndCreatePm(page) {
  await page.goto(`${baseUrl}/#/pages/agents/index`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('智能体', { exact: false }).first().waitFor({ timeout: 30000 });
  await page.getByText('创建智能体', { exact: false }).first().waitFor({ timeout: 30000 });
  await screenshot(page, '04-agents');
  await page.waitForTimeout(waitStep);

  await clickButtonText(page, '创建智能体');
  await page.getByText('新建智能体', { exact: false }).first().waitFor({ timeout: 30000 });
  const name = `RiverWatch PM ${suffix}`;
  const alias = `riverpm${suffix}`;
  await fillInput(page, 0, name);
  await fillInput(page, 1, alias);
  await page.locator('textarea').first().fill('负责 RiverWatch 项目需求拆解、任务分发和交付聚合。');
  await selectRole(page);
  await clickText(page, aiPlatform.label, { exact: true });
  await clickText(page, 'OAuth', { exact: true });
  await page.getByText(aiPlatform.readyText, { exact: false }).first().waitFor({ timeout: 30000 });
  await screenshot(page, '05-new-pm-oauth-ready');
  await page.waitForTimeout(waitStep);
  await clickButtonText(page, '创建并部署', { timeout: 45000 });
  await page.waitForURL(/pages\/chat\/detail/, { timeout: 60000 });
  await page.getByText(name, { exact: false }).first().waitFor({ timeout: 45000 });
  await screenshot(page, '06-pm-direct-chat');
  await page.waitForTimeout(waitStep);
  return { name, alias };
}

async function getStoresSnapshot(page) {
  return page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
    const pinia = piniaKey ? app._context.provides[piniaKey] : null;
    const convStore = pinia?._s?.get('conversation');
    const messageStore = pinia?._s?.get('message');
    const agentStore = pinia?._s?.get('agent');
    const appStore = pinia?._s?.get('app');
    return {
      activeId: convStore?.activeId || '',
      activeConversation: (convStore?.conversations || []).find((item) => item.id === convStore?.activeId || item.channelId === convStore?.activeId) || null,
      conversations: (convStore?.conversations || []).map((item) => ({
        id: item.id,
        channelId: item.channelId || item.id,
        channelType: Number(item.channelType || (item.type === 'group' ? 2 : 1)),
        type: item.type,
        name: item.name,
        source: item.source,
        directCatId: item.directCatId || item.direct_cat_id || '',
        projectThreadId: item.projectThreadId || item.project_thread_id || '',
        threadId: item.threadId || item.thread_id || '',
        catMemberIds: Array.isArray(item.catMemberIds) ? [...item.catMemberIds] : [],
        workerCatIds: Array.isArray(item.workerCatIds) ? [...item.workerCatIds] : [],
        targetCatIds: Array.isArray(item.targetCatIds) ? [...item.targetCatIds] : [],
        catMembers: Array.isArray(item.catMembers) ? item.catMembers.map((cat) => ({
          id: cat.id || cat.catId || cat.directCatId || cat.uid || '',
          catId: cat.catId || cat.id || cat.directCatId || cat.uid || '',
          directCatId: cat.directCatId || cat.catId || cat.id || cat.uid || '',
          name: cat.name || cat.nickname || cat.displayName || '',
          platform: cat.platform || cat.clientId || '',
          clientId: cat.clientId || '',
          accessMode: cat.accessMode || cat.authType || '',
          authType: cat.authType || cat.accessMode || '',
          accountRef: cat.accountRef || ''
        })) : [],
        agentMembers: Array.isArray(item.agentMembers) ? item.agentMembers.map((cat) => ({
          id: cat.id || cat.catId || cat.directCatId || cat.uid || '',
          catId: cat.catId || cat.id || cat.directCatId || cat.uid || '',
          directCatId: cat.directCatId || cat.catId || cat.id || cat.uid || '',
          name: cat.name || cat.nickname || cat.displayName || '',
          platform: cat.platform || cat.clientId || '',
          clientId: cat.clientId || '',
          accessMode: cat.accessMode || cat.authType || '',
          authType: cat.authType || cat.accessMode || '',
          accountRef: cat.accountRef || ''
        })) : [],
        binding: item.binding || null
      })),
      activeMessages: messageStore?.messages?.[convStore?.activeId] || [],
      agents: agentStore?.agents || [],
      currentUser: appStore?.currentUser || {}
    };
  });
}

async function refreshActiveMessages(page, silent = true) {
  await page.evaluate(async ({ silent }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
    const pinia = piniaKey ? app._context.provides[piniaKey] : null;
    const convStore = pinia?._s?.get('conversation');
    const messageStore = pinia?._s?.get('message');
    if (convStore?.activeId && messageStore?.syncNativeMessages) {
      await messageStore.syncNativeMessages(convStore.activeId, { silent, limit: 80 }).catch(() => []);
    }
  }, { silent });
  await page.waitForTimeout(waitBrief);
}

async function waitForConversationTextInStore(page, snippet, options = {}) {
  const timeout = options.timeout || 30000;
  const deadline = Date.now() + timeout;
  const expected = String(snippet || '').trim();
  if (!expected) return null;
  const previousIds = new Set(options.previousIds || []);

  while (Date.now() < deadline) {
    const result = await page.evaluate(async ({ conversationId, expected, previousIds }) => {
      const app = document.querySelector('#app')?.__vue_app__;
      const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
      const pinia = piniaKey ? app._context.provides[piniaKey] : null;
      const convStore = pinia?._s?.get('conversation');
      const messageStore = pinia?._s?.get('message');
      const activeId = conversationId || convStore?.activeId || '';
      if (!activeId) return null;
      await messageStore?.syncNativeMessages?.(activeId, { silent: true, limit: 120 }).catch(() => []);
      const messages = messageStore?.messages?.[activeId] || [];
      const knownIds = new Set(previousIds || []);
      const identity = (message = {}) => String(
        message.id
        || message.messageId
        || message.message_id
        || message.clientMsgNo
        || message.client_msg_no
        || `${message.senderName || ''}:${message.time || ''}:${message.fileName || ''}:${String(message.content || message.text || '').slice(0, 80)}`
      );
      const match = [...messages].reverse().find((message) => {
        if (knownIds.has(identity(message))) return false;
        return String(message.content || message.text || '').includes(expected);
      });
      return match ? {
        id: String(match.id || match.messageId || match.clientMsgNo || ''),
        conversationId: activeId,
        content: String(match.content || match.text || '').slice(0, 500)
      } : null;
    }, { conversationId: options.conversationId || '', expected, previousIds: [...previousIds] });
    if (result) return result;
    await page.waitForTimeout(fast ? 500 : 1000);
  }

  throw new Error(`sent prompt did not appear in message store: ${expected}`);
}

async function confirmSentPromptText(page, snippet, options = {}) {
  try {
    return await waitForConversationTextInStore(page, snippet, options);
  } catch (error) {
    if (options.required === false) {
      console.warn(`sent prompt text was not confirmed, continuing: ${String(error?.message || error)}`);
      return null;
    }
    throw error;
  }
}

const terminalStreamingStatuses = ['success', 'succeeded', 'completed', 'complete', 'done', 'final', 'failed', 'error', 'cancelled', 'canceled', 'revoked'];
const terminalStreamingPhases = ['final', 'done', 'complete', 'completed', 'cleanup'];
const activeStreamingPhases = ['placeholder', 'chunk', 'delta', 'streaming'];

function nestedValue(source, path) {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== 'object') return '';
    current = current[key];
  }
  return current === undefined || current === null ? '' : current;
}

function streamStatusValue(message = {}) {
  return String(
    message.status
    || message.streamStatus
    || message.stream_state
    || message.streamState
    || nestedValue(message, ['metadata', 'status'])
    || nestedValue(message, ['metadata', 'streamStatus'])
    || nestedValue(message, ['metadata', 'stream_state'])
    || nestedValue(message, ['metadata', 'streamState'])
    || nestedValue(message, ['payload', 'status'])
    || nestedValue(message, ['payload', 'streamStatus'])
    || nestedValue(message, ['raw', 'status'])
    || ''
  ).toLowerCase();
}

function streamPhaseValue(message = {}) {
  return String(
    message.streamPhase
    || message.phase
    || message.stage
    || nestedValue(message, ['metadata', 'streamPhase'])
    || nestedValue(message, ['metadata', 'phase'])
    || nestedValue(message, ['metadata', 'stage'])
    || nestedValue(message, ['payload', 'streamPhase'])
    || nestedValue(message, ['payload', 'phase'])
    || nestedValue(message, ['raw', 'phase'])
    || ''
  ).toLowerCase();
}

function isActiveStreamingMessage(message = {}) {
  const phase = streamPhaseValue(message);
  const status = streamStatusValue(message);
  const source = String(message.source || '').toLowerCase();
  if (terminalStreamingStatuses.includes(status)) return false;
  if (terminalStreamingPhases.includes(phase)) return false;
  if (source === 'clowder' && status === 'sending') return true;
  if (message.streaming === false) return false;
  if (message.streaming === true) return true;
  return activeStreamingPhases.includes(phase);
}

async function getConversationStreamStatus(page, conversationId) {
  return page.evaluate(async ({ conversationId, terminalStatuses, terminalPhases, activePhases }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
    const pinia = piniaKey ? app._context.provides[piniaKey] : null;
    const messageStore = pinia?._s?.get('message');
    await messageStore?.syncNativeMessages?.(conversationId, { silent: true, limit: 120 }).catch(() => []);
    const messages = messageStore?.messages?.[conversationId] || [];
    const terminalStatusSet = new Set(terminalStatuses);
    const terminalPhaseSet = new Set(terminalPhases);
    const activePhaseSet = new Set(activePhases);
    const nestedValue = (source, path) => {
      let current = source;
      for (const key of path) {
        if (!current || typeof current !== 'object') return '';
        current = current[key];
      }
      return current === undefined || current === null ? '' : current;
    };
    const statusValue = (message = {}) => String(
      message.status
      || message.streamStatus
      || message.stream_state
      || message.streamState
      || nestedValue(message, ['metadata', 'status'])
      || nestedValue(message, ['metadata', 'streamStatus'])
      || nestedValue(message, ['metadata', 'stream_state'])
      || nestedValue(message, ['metadata', 'streamState'])
      || nestedValue(message, ['payload', 'status'])
      || nestedValue(message, ['payload', 'streamStatus'])
      || nestedValue(message, ['raw', 'status'])
      || ''
    ).toLowerCase();
    const phaseValue = (message = {}) => String(
      message.streamPhase
      || message.phase
      || message.stage
      || nestedValue(message, ['metadata', 'streamPhase'])
      || nestedValue(message, ['metadata', 'phase'])
      || nestedValue(message, ['metadata', 'stage'])
      || nestedValue(message, ['payload', 'streamPhase'])
      || nestedValue(message, ['payload', 'phase'])
      || nestedValue(message, ['raw', 'phase'])
      || ''
    ).toLowerCase();
    const streamingMessages = messages.filter((message) => {
      const phase = phaseValue(message);
      const status = statusValue(message);
      if (terminalStatusSet.has(status)) return false;
      if (terminalPhaseSet.has(phase)) return false;
      if (String(message.source || '').toLowerCase() === 'clowder' && status === 'sending') return true;
      if (message.streaming === false) return false;
      if (message.streaming === true) return true;
      return activePhaseSet.has(phase);
    });
    const activeStreamingSummary = streamingMessages.slice(-5).map((message) => ({
      id: String(message.id || message.messageId || message.clientMsgNo || ''),
      senderName: String(message.senderName || message.from_name || ''),
      status: statusValue(message),
      phase: phaseValue(message),
      streaming: Boolean(message.streaming),
      source: String(message.source || ''),
      text: String(message.content || message.text || '').slice(0, 120)
    }));
    const latestAgent = [...messages].reverse().find((message) => {
      if (message.streamKey || message.streaming || message.streamPhase) return true;
      if (String(message.source || '').toLowerCase() === 'clowder') return true;
      return /clowder|riverwatch|coordinator|pm|猫|资料整理|叙事|分镜|前端|devops/i.test(String(message.senderName || ''));
    }) || null;
    return {
      messageCount: messages.length,
      streamingCount: streamingMessages.length,
      activeStreamingSummary,
      latestAgentText: String(latestAgent?.content || '').slice(0, 500),
      latestAgentStatus: String(latestAgent?.status || ''),
      latestAgentStreamPhase: String(latestAgent?.streamPhase || ''),
      latestAgentStreaming: Boolean(latestAgent?.streaming)
    };
  }, {
    conversationId,
    terminalStatuses: terminalStreamingStatuses,
    terminalPhases: terminalStreamingPhases,
    activePhases: activeStreamingPhases
  });
}

async function waitForConversationStreamingIdle(page, conversationId, label = 'conversation', options = {}) {
  const timeout = options.timeout || Number(process.env.RIVERWATCH_KICKOFF_IDLE_TIMEOUT_MS || (fast ? 900000 : 1800000));
  const quietMs = options.quietMs || Number(process.env.RIVERWATCH_KICKOFF_IDLE_QUIET_MS || (fast ? 12000 : 45000));
  const staleStreamBypassMs = options.staleStreamBypassMs ?? Number(process.env.RIVERWATCH_STALE_STREAM_BYPASS_MS || 0);
  const deadline = Date.now() + timeout;
  const start = Date.now();
  let quietSince = 0;
  let lastStatus = null;
  let lastStreamingSignature = '';
  let streamingUnchangedSince = 0;

  while (Date.now() < deadline) {
    const status = await getConversationStreamStatus(page, conversationId);
    lastStatus = status;
    if (status.streamingCount === 0) {
      quietSince ||= Date.now();
      if (Date.now() - quietSince >= quietMs) return status;
    } else {
      quietSince = 0;
      const signature = JSON.stringify(status.activeStreamingSummary || []);
      if (signature === lastStreamingSignature) {
        streamingUnchangedSince ||= Date.now();
      } else {
        lastStreamingSignature = signature;
        streamingUnchangedSince = Date.now();
      }
      if (staleStreamBypassMs > 0 && Date.now() - start >= staleStreamBypassMs && Date.now() - streamingUnchangedSince >= Math.min(quietMs, 10000)) {
        return { ...status, staleStreamBypassed: true };
      }
    }
    await page.waitForTimeout(fast ? 1500 : 5000);
  }

  throw new Error(`${label} did not become idle before group execution; active streaming messages may keep project group execution queued: ${JSON.stringify(lastStatus)}`);
}

function isLikelyAgentMessage(message = {}) {
  if (isHumanPromptMessage(message)) return false;
  if (String(message.source || '').toLowerCase() === 'clowder') return true;
  if (message.streamKey || message.streaming || message.streamPhase) return true;
  return /clowder|riverwatch|coordinator|pm|猫|资料整理|叙事|分镜|前端|devops|source|deck|storyboard|frontend/i.test(String(message.senderName || ''));
}

async function waitForProjectGroupInitialSettled(page, groupId, options = {}) {
  const timeout = options.timeout || Number(process.env.RIVERWATCH_GROUP_INITIAL_SETTLE_TIMEOUT_MS || (fast ? 180000 : 420000));
  const minSettleMs = options.minSettleMs || Number(process.env.RIVERWATCH_GROUP_INITIAL_SETTLE_MS || (fast ? 15000 : 45000));
  const staleStreamBypassMs = options.staleStreamBypassMs || Number(process.env.RIVERWATCH_GROUP_INITIAL_STALE_STREAM_BYPASS_MS || (fast ? 90000 : 240000));
  const quietMs = options.quietMs || Number(process.env.RIVERWATCH_GROUP_INITIAL_IDLE_QUIET_MS || (fast ? 7000 : 20000));
  const agentQuietMs = options.agentQuietMs || Number(process.env.RIVERWATCH_GROUP_INITIAL_AGENT_QUIET_MS || quietMs);
  const deadline = Date.now() + timeout;
  const start = Date.now();
  const seenIds = await getConversationMessageIdentitySet(page, groupId);
  let quietSince = 0;
  let observedAgent = false;
  let lastNewAgentAt = 0;
  let lastStatus = null;
  let lastAgentSummary = null;

  while (Date.now() < deadline) {
    await refreshActiveMessages(page);
    const messages = await getConversationMessages(page, groupId);
    const now = Date.now();
    const newAgentMessages = [];
    for (const message of messages) {
      const identity = messageIdentity(message);
      if (seenIds.has(identity)) continue;
      seenIds.add(identity);
      if (isLikelyAgentMessage(message)) newAgentMessages.push(message);
    }

    if (newAgentMessages.length) {
      observedAgent = true;
      lastNewAgentAt = now;
      const latest = newAgentMessages.at(-1);
      lastAgentSummary = {
        id: messageIdentity(latest),
        senderName: String(latest.senderName || ''),
        time: String(latest.time || latest.timestamp || latest.createdAt || ''),
        content: String(latest.content || latest.text || '').slice(0, 240)
      };
    }

    lastStatus = await getConversationStreamStatus(page, groupId);
    if (lastStatus.streamingCount === 0) {
      quietSince ||= now;
    } else {
      quietSince = 0;
    }

    const elapsed = now - start;
    const streamQuiet = quietSince > 0 && now - quietSince >= quietMs;
    const agentQuiet = !observedAgent || now - lastNewAgentAt >= agentQuietMs;
    const canBypassStaleStream = elapsed >= staleStreamBypassMs && agentQuiet;
    if (elapsed >= minSettleMs && agentQuiet && (streamQuiet || canBypassStaleStream)) {
      return {
        groupId,
        observedAgent,
        settledMs: elapsed,
        staleStreamBypassed: !streamQuiet && canBypassStaleStream,
        messageCount: messages.length,
        lastStatus,
        lastAgentSummary,
        previousIds: new Set(messages.map(messageIdentity))
      };
    }

    await page.waitForTimeout(fast ? 1500 : 5000);
  }

  throw new Error(`project group initial queued agents did not settle before execution prompt: ${JSON.stringify({
    groupId,
    observedAgent,
    waitedMs: Date.now() - start,
    lastStatus,
    lastAgentSummary
  })}`);
}

async function setActiveConversation(page, id) {
  await page.evaluate(async ({ id }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
    const pinia = piniaKey ? app._context.provides[piniaKey] : null;
    const convStore = pinia?._s?.get('conversation');
    const messageStore = pinia?._s?.get('message');
    convStore?.setActiveId?.(id);
    await messageStore?.syncNativeMessages?.(id, { silent: true, limit: 80 }).catch(() => []);
  }, { id });
  await page.waitForTimeout(waitBrief);
}

function decodeRepeated(value = '') {
  let next = String(value || '');
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(next);
      if (decoded === next) break;
      next = decoded;
    } catch {
      break;
    }
  }
  return next;
}

function projectThreadIdFromConversation(conversation = {}) {
  return conversation.projectThreadId || conversation.threadId || conversation.binding?.projectThreadId || conversation.binding?.threadId || '';
}

function providerFamilyFromText(value = '') {
  const text = String(value || '').toLowerCase();
  if (text.includes('claude') || text.includes('anthropic')) return 'claude';
  if (text.includes('codex') || text.includes('openai')) return 'codex';
  if (text.includes('gemini') || text.includes('google')) return 'gemini';
  return '';
}

function accessModeFromText(value = '') {
  const text = String(value || '').toLowerCase().replace(/_/g, '-');
  if (text.includes('oauth')) return 'oauth';
  if (text.includes('api-key') || text.includes('api key') || text.includes('apikey')) return 'api-key';
  return '';
}

function catIdFromMember(member = {}) {
  return String(member.catId || member.directCatId || member.id || member.uid || '').replace(/^clowder_cat:/, '').trim();
}

function projectGroupProviderViolations(conversation = {}, expectedProvider = aiProvider) {
  if (!String(expectedProvider || '').toLowerCase().includes('claude')) return [];
  const members = [
    ...(Array.isArray(conversation.catMembers) ? conversation.catMembers : []),
    ...(Array.isArray(conversation.agentMembers) ? conversation.agentMembers : [])
  ];
  const byId = new Map();
  for (const member of members) {
    const id = catIdFromMember(member);
    if (id) byId.set(id, member);
  }
  const ids = new Set([
    ...(Array.isArray(conversation.workerCatIds) ? conversation.workerCatIds : []),
    ...(Array.isArray(conversation.targetCatIds) ? conversation.targetCatIds : []),
    ...(Array.isArray(conversation.catMemberIds) ? conversation.catMemberIds : [])
  ].map((id) => String(id || '').replace(/^clowder_cat:/, '').trim()).filter(Boolean));
  return [...ids].map((id) => {
    const member = byId.get(id) || {};
    const providerFamily = providerFamilyFromText([
      member.provider,
      member.platform,
      member.clientId,
      member.accountRef
    ].join(' '));
    const accessMode = accessModeFromText([member.accessMode, member.authType].join(' '));
    return { id, name: member.name || id, providerFamily, accessMode, member };
  }).filter((entry) => (
    (entry.providerFamily && entry.providerFamily !== 'claude')
    || (entry.accessMode && entry.accessMode !== 'oauth')
  ));
}

function assertProjectGroupProviderCompatibility(conversation = {}, expectedProvider = aiProvider) {
  const violations = projectGroupProviderViolations(conversation, expectedProvider);
  if (!violations.length) return conversation;
  throw new Error(`project group contains non-Claude/OAuth execution cats: ${violations.map((item) => `${item.id}(${item.providerFamily || 'unknown'}/${item.accessMode || 'unknown'})`).join(', ')}`);
}

function pmDirectProposalProviderViolations(messages = [], expectedProvider = aiProvider) {
  if (!String(expectedProvider || '').toLowerCase().includes('claude')) return [];
  return (Array.isArray(messages) ? messages : []).map((message) => {
    const text = [
      message.content,
      message.text,
      message.proposalCard?.title,
      message.proposalCard?.bodyMarkdown,
      message.proposalCard?.description
    ].map((value) => String(value || '')).join('\n');
    const hasBackendProposal = Boolean(message.proposalCard)
      || /提议新建\s*thread|proposal_[a-z0-9]+|后端\s*thread\s*proposal/i.test(text);
    const hasOldRuntimeMention = /@runtime-cat-[a-z0-9-]+|runtime-cat-[a-z0-9-]+|codex\s+exec|\bcodex\b/i.test(text);
    return { id: message.id, senderName: message.senderName, hasBackendProposal, hasOldRuntimeMention, text: text.slice(0, 500) };
  }).filter((item) => item.hasBackendProposal || item.hasOldRuntimeMention);
}

function assertNoPmDirectBackendProposal(messages = [], expectedProvider = aiProvider) {
  const violations = pmDirectProposalProviderViolations(messages, expectedProvider);
  const blocking = violations.filter((item) => item.hasOldRuntimeMention);
  if (!blocking.length) return messages;
  throw new Error(`PM direct chat produced old runtime/codex mentions before front-end project group confirmation: ${blocking.map((item) => `${item.id || 'unknown'}${item.hasBackendProposal ? ':proposal' : ''}/old-runtime`).join(', ')}`);
}

function assertProjectGroupOpenState(state = {}, groupId = '', currentUrl = '') {
  const expectedGroupId = String(groupId || '').trim();
  const activeId = String(state.activeId || '').trim();
  const active = state.conversations?.find((item) => item.id === activeId || item.channelId === activeId)
    || state.activeConversation
    || {};
  const activeIdentity = [active.id, active.channelId].map((value) => String(value || '').trim()).filter(Boolean);
  if (!expectedGroupId || (!activeIdentity.includes(expectedGroupId) && activeId !== expectedGroupId)) {
    throw new Error(`project group is not open: active=${activeId || 'none'} expected=${expectedGroupId || 'none'}`);
  }
  if (Number(active.channelType) !== 2 || String(active.type || '') !== 'group') {
    throw new Error(`project group is not open: active conversation is ${active.type || active.channelType || 'unknown'}`);
  }
  if (!projectThreadIdFromConversation(active)) {
    throw new Error('project group is missing Clowder projectThreadId; real AI collaboration cannot be verified');
  }
  const decodedUrl = decodeRepeated(currentUrl);
  if (/pages\/chat\/detail/.test(decodedUrl) && !decodedUrl.includes(expectedGroupId)) {
    throw new Error(`project group is not open: route still points elsewhere (${decodedUrl})`);
  }
  if (/clowder_cat:/i.test(decodedUrl) && !decodedUrl.includes(expectedGroupId)) {
    throw new Error(`project group is not open: route still points to PM direct chat (${decodedUrl})`);
  }
  return active;
}

function createdProjectGroupCardFromMessages(messages = []) {
  return messages
    .map((item) => item.projectGroupCard)
    .filter(Boolean)
    .find((card) => {
      const status = String(card.status || '').toLowerCase();
      return status === 'created' && (card.projectGroupNo || card.groupNo);
    }) || null;
}

async function waitForCreatedProjectGroupCard(page) {
  for (let i = 0; i < 80; i += 1) {
    await refreshActiveMessages(page);
    const state = await getStoresSnapshot(page);
    const card = createdProjectGroupCardFromMessages(state.activeMessages);
    if (card) return card;
    await page.waitForTimeout(750);
  }
  throw new Error('created project group card not found after confirmation');
}

async function ensureProjectGroupCreated(page) {
  const projectGroupCard = page.locator('[data-testid="project-group-confirmation-card"]').first();
  await projectGroupCard.waitFor({ timeout: 45000 });

  const confirmLabels = ['确认创建', '批准并创建', '同意创建'];
  const deadline = Date.now() + 90000;
  let clickedConfirm = false;

  while (Date.now() < deadline) {
    await refreshActiveMessages(page);
    const state = await getStoresSnapshot(page);
    const createdCard = createdProjectGroupCardFromMessages(state.activeMessages);
    if (createdCard) return createdCard;

    const openButton = projectGroupCard.getByText('打开项目群', { exact: true }).first();
    if (await openButton.isVisible().catch(() => false)) {
      return waitForCreatedProjectGroupCard(page);
    }

    if (!clickedConfirm) {
      for (const label of confirmLabels) {
        const confirmButton = projectGroupCard.getByText(label, { exact: true }).first();
        if (await confirmButton.isVisible().catch(() => false)) {
          await confirmButton.click({ timeout: 30000 });
          clickedConfirm = true;
          break;
        }
      }
    }

    await page.waitForTimeout(750);
  }

  throw new Error('project group card did not reach created/openable state');
}

async function markProjectGroupConversation(page, groupId, groupPatch = {}) {
  await page.evaluate(({ groupId, groupPatch }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
    const pinia = piniaKey ? app._context.provides[piniaKey] : null;
    const convStore = pinia?._s?.get('conversation');
    const group = (convStore?.conversations || []).find((item) => item.id === groupId || item.channelId === groupId) || {};
    convStore?.upsertGroupConversation?.({
      ...group,
      ...groupPatch,
      id: groupId,
      group_no: groupId,
      channelId: groupId,
      channelType: 2,
      type: 'group',
      source: 'clowder',
      isProjectGroup: true
    });
  }, { groupId, groupPatch });
}

async function getConversationMessages(page, conversationId) {
  return page.evaluate(({ conversationId }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
    const pinia = piniaKey ? app._context.provides[piniaKey] : null;
    const messageStore = pinia?._s?.get('message');
    const list = messageStore?.messages?.[conversationId] || [];
    const normalizeFile = (message) => {
      const metadata = message.metadata || {};
      const file = message.file || metadata.file || {};
      const payload = message.payload || {};
      return {
        id: String(message.id || message.messageId || message.clientMsgNo || ''),
        time: Number(message.time || message.timestamp || message.createdAt || 0),
        type: String(message.type || message.contentType || ''),
        senderId: String(message.senderId || message.from_uid || payload.cat_id || ''),
        senderName: String(message.senderName || message.from_name || payload.cat_display_name || ''),
        content: String(message.content || message.text || payload.content || ''),
        fileName: String(message.fileName || message.name || file.name || payload.name || metadata.fileName || ''),
        fileType: String(message.fileType || file.fileType || payload.fileType || metadata.fileType || ''),
        url: String(message.url || message.sourceUrl || message.contentUrl || file.url || payload.url || metadata.sourceUrl || metadata.contentUrl || ''),
        workspacePath: String(message.workspacePath || metadata.workspacePath || file.workspacePath || payload.workspacePath || ''),
        previewContent: String(message.previewContent || metadata.previewContent || file.previewContent || payload.previewContent || ''),
        deploymentCard: message.deploymentCard ? {
          cardId: String(message.deploymentCard.cardId || message.deploymentCard.id || message.id || ''),
          deploymentRequestId: String(message.deploymentCard.deploymentRequestId || ''),
          status: String(message.deploymentCard.status || ''),
          statusLabel: String(message.deploymentCard.statusLabel || ''),
          target: String(message.deploymentCard.target || ''),
          previewUrl: String(message.deploymentCard.previewUrl || ''),
          downloadUrl: String(message.deploymentCard.downloadUrl || '')
        } : null
      };
    };
    return list.map(normalizeFile);
  }, { conversationId });
}

function isExpectedRiverWatchFileCard(message, expected) {
  const actualName = String(message.fileName || '');
  const actualType = String(message.fileType || '').toLowerCase().replace(/^\./, '');
  const expectedName = String(expected.fileName || '');
  if (!actualName) return false;
  if (!['file', 'document'].includes(String(message.type || '').toLowerCase()) && !actualType) return false;
  const actualBase = path.basename(actualName).replace(/\.[^.]+$/, '');
  const actualExtension = path.extname(actualName).replace(/^\./, '').toLowerCase();
  const actualFileType = actualType || actualExtension;
  const acceptedBaseNames = expected.acceptedBaseNames || [expectedName.replace(/\.[^.]+$/, '')];
  const acceptedFileTypes = expected.acceptedFileTypes || (expected.fileType ? [expected.fileType] : []);
  const matchesName = acceptedBaseNames.some((baseName) => {
    const normalized = String(baseName || '').replace(/\.[^.]+$/, '');
    return normalized && (actualBase === normalized || actualName.includes(normalized));
  });
  if (!matchesName) return false;
  if (acceptedFileTypes.length && actualFileType && !acceptedFileTypes.includes(actualFileType)) return false;
  return true;
}

function assertRealFileCard(file) {
  if (!file?.fileName) throw new Error('missing file card name');
  const source = [file.url, file.workspacePath, file.previewContent].join(' ');
  if (/riverwatch-real-\d+|\/assets\/riverwatch-real-/i.test(source)) {
    throw new Error(`file card appears to use prebuilt/mock content: ${file.fileName}`);
  }
}

function isMeaningfulRiverWatchWorkspaceFile(filePath = '') {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const baseName = normalized.split('/').pop() || '';
  if (!normalized || !baseName) return false;
  if (baseName === '.clowder-workspace.json') return false;
  if (baseName.startsWith('.')) return false;
  if (/\/node_modules\/|\/\.git\/|\/dist\/|\/coverage\//i.test(`/${normalized}`)) return false;
  return true;
}

async function listWorkspaceFilesForThread(threadId, options = {}) {
  const id = String(threadId || '').trim();
  if (!id || id.includes('/') || id.includes('..')) return [];
  const root = options.root || clowderWorkspaceRoot;
  const threadRoot = path.join(root, id);
  const maxDepth = options.maxDepth ?? 8;
  const files = [];

  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(threadRoot, absolute).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        await walk(absolute, depth + 1);
      } else if (entry.isFile()) {
        files.push(relative);
      } else {
        const info = await stat(absolute).catch(() => null);
        if (info?.isFile()) files.push(relative);
      }
    }
  }

  await walk(threadRoot, 0);
  return files.sort();
}

async function waitForWorkspaceFileEvidence(threadId, previousFiles = [], options = {}) {
  const timeout = options.timeout || Number(process.env.RIVERWATCH_WORKSPACE_FILE_EVIDENCE_TIMEOUT_MS || (fast ? 90000 : 300000));
  const deadline = Date.now() + timeout;
  const previous = new Set((previousFiles || []).map((item) => String(item || '')));
  let latest = [];

  while (Date.now() < deadline) {
    latest = await listWorkspaceFilesForThread(threadId, options);
    const added = latest
      .filter(isMeaningfulRiverWatchWorkspaceFile)
      .filter((file) => !previous.has(file));
    if (added.length) {
      return { threadId, added, all: latest };
    }
    await wait(fast ? 1500 : 5000);
  }

  throw new Error(`no current RiverWatch workspace files were produced for thread ${threadId || 'unknown'} before timeout; latest=${JSON.stringify(latest)}`);
}

function normalizeInvocationLogLine(rawLine = '') {
  const line = String(rawLine || '').trim();
  if (!line) return null;
  try {
    const parsed = JSON.parse(line);
    if (parsed?.msg !== 'Created invocation') return null;
    return {
      invocationId: String(parsed.invocationId || ''),
      catId: String(parsed.catId || ''),
      threadId: String(parsed.threadId || ''),
      userId: String(parsed.userId || ''),
      time: String(parsed.time || '')
    };
  } catch {
    return null;
  }
}

function normalizeQueuedInvocationLogLine(rawLine = '') {
  const line = String(rawLine || '').trim();
  if (!line) return null;
  try {
    const parsed = JSON.parse(line);
    if (!/\[ConnectorInvokeTrigger\] Queued/i.test(String(parsed?.msg || ''))) return null;
    return {
      threadId: String(parsed.threadId || ''),
      catId: String(parsed.catId || ''),
      time: String(parsed.time || '')
    };
  } catch {
    return null;
  }
}

async function listInvocationLogFiles(options = {}) {
  const root = options.logDir || clowderApiLogDir;
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/^api(?:\.\d{4}-\d{2}-\d{2}\.\d+)?\.log$/.test(entry.name)) continue;
    const filePath = path.join(root, entry.name);
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) continue;
    files.push({ filePath, mtimeMs: info.mtimeMs });
  }
  return files.sort((a, b) => a.mtimeMs - b.mtimeMs).map((item) => item.filePath);
}

async function readInvocationRecordsFromLogs(options = {}) {
  const records = [];
  const files = options.files || await listInvocationLogFiles(options);

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8').catch(() => '');
    if (!content) continue;
    for (const line of content.split(/\r?\n/)) {
      const record = normalizeInvocationLogLine(line);
      if (record) records.push({ ...record, logFile: filePath });
    }
  }

  return records;
}

async function readQueuedInvocationRecordsFromLogs(options = {}) {
  const records = [];
  const files = options.files || await listInvocationLogFiles(options);

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8').catch(() => '');
    if (!content) continue;
    for (const line of content.split(/\r?\n/)) {
      const record = normalizeQueuedInvocationLogLine(line);
      if (record) records.push({ ...record, logFile: filePath });
    }
  }

  return records;
}

async function listInvocationRecordsForThread(threadId, options = {}) {
  const id = String(threadId || '').trim();
  if (!id) return [];
  const records = options.readRecords
    ? await options.readRecords()
    : await readInvocationRecordsFromLogs(options);
  return records.filter((record) => record.threadId === id);
}

async function listQueuedInvocationRecordsForThread(threadId, options = {}) {
  const id = String(threadId || '').trim();
  if (!id) return [];
  const records = options.readQueuedRecords
    ? await options.readQueuedRecords()
    : await readQueuedInvocationRecordsFromLogs(options);
  return records.filter((record) => record.threadId === id);
}

function invocationRecordIdentity(record = {}) {
  return String(record.invocationId || `${record.threadId}:${record.catId}:${record.time}`);
}

function queuedInvocationRecordIdentity(record = {}) {
  return String(`${record.threadId}:${record.catId}:${record.time}`);
}

async function waitForNewThreadInvocation(threadId, previousRecords = [], options = {}) {
  const timeout = options.timeout || Number(process.env.RIVERWATCH_INVOCATION_GATE_TIMEOUT_MS || (fast ? 120000 : 300000));
  const pollMs = options.pollMs || (fast ? 1500 : 5000);
  const deadline = Date.now() + timeout;
  const previous = new Set((previousRecords || []).map(invocationRecordIdentity));
  const previousQueued = new Set((options.previousQueuedRecords || []).map(queuedInvocationRecordIdentity));
  let latest = [];
  let latestQueued = [];

  while (Date.now() < deadline) {
    latest = await listInvocationRecordsForThread(threadId, options);
    const added = latest.filter((record) => !previous.has(invocationRecordIdentity(record)));
    if (added.length) return { status: 'created', threadId, added, all: latest };
    latestQueued = await listQueuedInvocationRecordsForThread(threadId, options);
    const queued = latestQueued.filter((record) => !previousQueued.has(queuedInvocationRecordIdentity(record)));
    if (queued.length) return { status: 'queued', threadId, queued, all: latest, queuedAll: latestQueued };
    await wait(pollMs);
  }

  throw new Error(`no new Clowder invocation or queued connector invocation was observed for current project thread ${threadId || 'unknown'} before timeout; latest=${JSON.stringify(latest)} queued=${JSON.stringify(latestQueued)}`);
}

async function waitForFileCards(page, groupId, expectedFiles, options = {}) {
  const timeout = options.timeout || aiWaitTimeout;
  const deadline = Date.now() + timeout;
  const found = new Map();
  while (Date.now() < deadline) {
    await refreshActiveMessages(page);
    const messages = await getConversationMessages(page, groupId);
    for (const expected of expectedFiles) {
      if (found.has(expected.fileName)) continue;
      const match = messages.find((message) => isExpectedRiverWatchFileCard(message, expected));
      if (match) {
        assertRealFileCard(match);
        found.set(expected.fileName, match);
      }
    }
    if (found.size === expectedFiles.length) return Object.fromEntries(found.entries());
    await page.waitForTimeout(fast ? 1500 : 5000);
  }
  const missing = expectedFiles.map((file) => file.fileName).filter((fileName) => !found.has(fileName));
  throw new Error(`real AI file cards not produced before timeout: ${missing.join(', ')}`);
}

async function sendFileCardRecoveryRequest(page) {
  await fillLastTextarea(page, buildFileCardRecoveryPrompt());
  await screenshot(page, '11d-file-card-recovery-draft');
  await page.waitForTimeout(waitStep);
  await sendCurrentInput(page);
  await confirmSentPromptText(page, '当前群聊还没有收到群聊文件卡', { required: false });
  await page.waitForTimeout(waitBrief);
}

async function sendDeliverableConvergenceRequest(page) {
  await fillLastTextarea(page, buildDeliverableConvergencePrompt());
  await screenshot(page, '11e-deliverable-convergence-draft');
  await page.waitForTimeout(waitStep);
  await sendCurrentInput(page);
  await confirmSentPromptText(page, '请基于已经完成的 source-pack.md', { required: false });
  await page.waitForTimeout(waitBrief);
}

function directRolePromptSnippet(prompt = '') {
  return prompt.match(/请你(?:这次)?只负责[^\n]+/)?.[0]
    || prompt.split(/\r?\n/).find((line) => line.trim().startsWith('@'))
    || prompt.slice(0, 80);
}

const roleExecutionProfiles = {
  'source-curator': {
    actor: /资料整理|狸花|source curator/i,
    file: /source-pack\.md|usgs-nwis-snapshot\.json|data-source-contract\.md|usgs-iv-[^\s/]*\.json/i,
    work: /USGS|NWIS|数据来源|快照|氨氮|N\/A|未返回/i
  },
  'deck-strategist': {
    actor: /叙事策略|俄罗斯蓝猫|deck strategist/i,
    file: /RiverWatch_项目汇报\.md|RiverWatch_项目汇报\.pptx|riverwatch-project-report\.md|riverwatch-project-report\.pptx|ppt-storyboard/i,
    work: /PPT|项目汇报|大纲|封面|部署计划|Deck/i
  },
  'storyboard-designer': {
    actor: /分镜设计|土耳其安哥拉|storyboard designer/i,
    file: /RiverWatch_PRD\.md|RiverWatch_PRD\.docx|riverwatch-prd\.md|(?:^|\/)prd\.md/i,
    work: /PRD|需求文档|用户场景|验收标准|移动端/i
  },
  'pm-budget': {
    actor: /RiverWatch PM|riverpm|PM/i,
    file: /RiverWatch_预算与排期\.md|RiverWatch_预算与排期\.xlsx|riverwatch-budget-schedule\.md|riverwatch-budget-schedule\.xlsx|budget-schedule\.md/i,
    work: /预算|排期|5\s*万|验收节点|风险项/i
  },
  frontend: {
    actor: /前端工程师|波斯猫|Frontend/i,
    file: /RiverWatch_技术README\.md|RiverWatch_展示首页\.html|riverwatch-frontend-readme\.md|riverwatch-dashboard\.html|(?:^|\/)README\.md|(?:^|\/)index\.html/i,
    work: /Vue|HTML|README|首页|指标卡|两列|站点列表/i
  }
};

function messageIdentity(message = {}) {
  return String(message.id || `${message.senderName || ''}:${message.time || ''}:${message.fileName || ''}:${String(message.content || '').slice(0, 80)}`);
}

function isHumanPromptMessage(message = {}) {
  return /演示用户|co-creator|用户/i.test(String(message.senderName || ''));
}

function isOldBoundaryRefusal(text = '') {
  return /只做执行猫盘点|项目群确认卡|不会开始整理数据源|不会.*生成.*交付物|不生成 PPT|不生成.*PRD|不生成.*README|不生成.*HTML|退：|不是.*执行球/i.test(String(text || ''));
}

function isConcreteRoleWorkText(text = '', profile = {}) {
  const value = String(text || '');
  if (!profile.work.test(value)) return false;
  if (!/(已|完成|生成|写入|创建|导出|发送|整理|核验|workspace|\.clowder\/workspaces|文件卡|cc_rich)/i.test(value)) return false;
  if (/(我将|稍后|待确认|等待|可以继续|会继续|计划|准备)/i.test(value) && !/\.clowder\/workspaces|文件卡|cc_rich/i.test(value)) return false;
  return true;
}

function findRoleExecutionEvidence(messages = [], role, options = {}) {
  const profile = roleExecutionProfiles[role];
  if (!profile) return null;
  const previousIds = options.previousIds || new Set();

  for (const message of [...messages].reverse()) {
    const identity = messageIdentity(message);
    if (previousIds.has(identity)) continue;
    if (isHumanPromptMessage(message)) continue;

    const text = [
      message.senderName,
      message.content,
      message.fileName,
      message.url,
      message.workspacePath,
      message.previewContent
    ].join('\n');

    if (isOldBoundaryRefusal(text)) {
      return {
        status: 'blocked',
        role,
        reason: 'old-boundary-refusal',
        message: identity,
        senderName: String(message.senderName || ''),
        time: String(message.time || message.timestamp || message.createdAt || ''),
        summary: String(message.content || message.text || '').slice(0, 240)
      };
    }

    if (profile.file.test(text)) {
      return { status: 'ready', role, reason: 'role-file-or-workspace', message: identity };
    }

    if (profile.actor.test(String(message.senderName || '')) && isConcreteRoleWorkText(text, profile)) {
      return {
        status: 'soft',
        role,
        reason: 'role-agent-text-without-file',
        message: identity,
        senderName: String(message.senderName || ''),
        summary: String(message.content || message.text || '').slice(0, 240)
      };
    }
  }

  return null;
}

async function getConversationMessageIdentitySet(page, conversationId) {
  await refreshActiveMessages(page);
  const messages = await getConversationMessages(page, conversationId);
  return new Set(messages.map(messageIdentity));
}

async function waitForRoleExecutionEvidence(page, groupId, role, options = {}) {
  const timeout = options.timeout || Number(process.env.RIVERWATCH_ROLE_EVIDENCE_TIMEOUT_MS || (fast ? 60000 : 300000));
  const deadline = Date.now() + timeout;
  let lastEvidence = null;

  while (Date.now() < deadline) {
    await refreshActiveMessages(page);
    const messages = await getConversationMessages(page, groupId);
    const evidence = findRoleExecutionEvidence(messages, role, { previousIds: options.previousIds || new Set() });
    if (evidence?.status === 'ready') return evidence;
    if (evidence?.status === 'blocked') return evidence;
    lastEvidence = evidence;
    await page.waitForTimeout(fast ? 1500 : 5000);
  }

  throw new Error(`role ${role} did not produce concrete execution evidence before timeout: ${JSON.stringify(lastEvidence)}`);
}

async function waitForRoleExecutionOutcome(page, groupId, projectThreadId, role, options = {}) {
  const timeout = options.timeout || Number(process.env.RIVERWATCH_ROLE_OUTCOME_TIMEOUT_MS || process.env.RIVERWATCH_ROLE_EVIDENCE_TIMEOUT_MS || (fast ? 180000 : 600000));
  const pollMs = options.pollMs || (fast ? 1500 : 5000);
  const previousIds = options.previousIds || new Set();
  const previousFiles = new Set((options.previousWorkspaceFiles || []).map((item) => String(item || '')));
  const waitMs = options.waitMs || (async (ms) => {
    if (page?.waitForTimeout) await page.waitForTimeout(ms);
    else await wait(ms);
  });
  const deadline = Date.now() + timeout;
  let lastEvidence = null;
  let latestFiles = [];

  while (Date.now() < deadline) {
    let messages;
    if (options.getMessages) {
      messages = await options.getMessages();
    } else {
      await refreshActiveMessages(page);
      messages = await getConversationMessages(page, groupId);
    }

    const evidence = findRoleExecutionEvidence(messages, role, { previousIds });
    if (evidence?.status === 'ready') return evidence;
    if (evidence?.status === 'blocked') return evidence;
    lastEvidence = evidence || lastEvidence;

    latestFiles = options.listFiles
      ? await options.listFiles()
      : await listWorkspaceFilesForThread(projectThreadId, options);
    const addedFiles = latestFiles
      .filter(isMeaningfulRiverWatchWorkspaceFile)
      .filter((file) => !previousFiles.has(file));
    if (addedFiles.length) {
      return {
        status: 'ready',
        role,
        reason: 'role-workspace-file',
        addedFiles,
        allFiles: latestFiles,
        evidence: lastEvidence
      };
    }

    await waitMs(pollMs);
  }

  throw new Error(`role ${role} did not produce concrete execution outcome before timeout: ${JSON.stringify({ lastEvidence, latestFiles })}`);
}

async function sendRoleBoundaryRetryRequest(page, item, reason = 'missing role execution evidence') {
  const mentionLine = item.prompt.split(/\r?\n/).find((line) => line.trim().startsWith('@')) || '';
  const retryPrompt = `${mentionLine}

上一条没有看到你在当前 RiverWatch 项目群里的真实执行证据（${reason}）。请不要引用 PM 直聊“只建群、不生成交付物”的旧阶段限制；该限制已经结束。

请你现在亲自执行自己负责的 RiverWatch 交付物：在当前项目群真实 workspace 创建文件，回复真实 workspace 路径，并用 \`\`\`cc_rich\`\`\` file block 发送文件卡。不要检索旧 thread，不要复用历史 demo，不要只回复计划或“会做”。

这是本角色完整执行请求，请严格按它执行：

${item.prompt}`;
  await fillLastTextarea(page, retryPrompt);
  await page.waitForTimeout(waitBrief);
  await sendCurrentInput(page);
  await waitForConversationTextInStore(page, '上一条没有看到你在当前 RiverWatch 项目群里的真实执行证据', {
    conversationId: item.groupId,
    previousIds: [...(item.previousIds || [])],
    timeout: 45000
  });
}

async function sendDirectRoleExecutionRequests(page, groupId, projectThreadId) {
  const prompts = buildDirectRoleExecutionPrompts();
  for (const [index, item] of prompts.entries()) {
    const previousIds = await getConversationMessageIdentitySet(page, groupId);
    const previousInvocationRecords = await listInvocationRecordsForThread(projectThreadId);
    const previousWorkspaceFiles = await listWorkspaceFilesForThread(projectThreadId);
    await fillLastTextarea(page, item.prompt);
    if (index === 0) await screenshot(page, '11a2-direct-role-execution-draft');
    await page.waitForTimeout(waitBrief);
    await sendCurrentInput(page);
    let promptConfirmed = false;
    try {
      await waitForConversationTextInStore(page, directRolePromptSnippet(item.prompt), {
        conversationId: groupId,
        previousIds: [...previousIds],
        timeout: 45000
      });
      promptConfirmed = true;
    } catch (error) {
      console.warn(`direct role prompt text was not confirmed before invocation gate for ${item.role}: ${error?.message || error}`);
    }
    const invocationOutcome = await waitForNewThreadInvocation(projectThreadId, previousInvocationRecords, {
      timeout: Number(process.env.RIVERWATCH_ROLE_INVOCATION_GATE_TIMEOUT_MS || (fast ? 120000 : 300000))
    });
    if (!promptConfirmed) {
      console.warn(`direct role prompt text was not confirmed, continuing after invocation evidence for ${item.role}: ${JSON.stringify(invocationOutcome)}`);
    }
    let outcome;
    try {
      outcome = await waitForRoleExecutionOutcome(page, groupId, projectThreadId, item.role, {
        previousIds,
        previousWorkspaceFiles,
        timeout: Number(process.env.RIVERWATCH_ROLE_OUTCOME_TIMEOUT_MS || process.env.RIVERWATCH_ROLE_EVIDENCE_TIMEOUT_MS || (fast ? 180000 : 600000))
      });
    } catch (error) {
      outcome = { status: 'missing', reason: String(error?.message || error) };
    }

    if (!outcome || outcome.status === 'blocked' || outcome.status === 'missing') {
      const retryPreviousIds = await getConversationMessageIdentitySet(page, groupId);
      const retryPreviousInvocationRecords = await listInvocationRecordsForThread(projectThreadId);
      const retryPreviousWorkspaceFiles = await listWorkspaceFilesForThread(projectThreadId);
      await sendRoleBoundaryRetryRequest(page, { ...item, groupId, previousIds: retryPreviousIds }, outcome.reason);
      await waitForNewThreadInvocation(projectThreadId, retryPreviousInvocationRecords, {
        timeout: Number(process.env.RIVERWATCH_ROLE_INVOCATION_GATE_TIMEOUT_MS || (fast ? 120000 : 300000))
      });
      const retryOutcome = await waitForRoleExecutionOutcome(page, groupId, projectThreadId, item.role, {
        previousIds: retryPreviousIds,
        previousWorkspaceFiles: retryPreviousWorkspaceFiles,
        timeout: Number(process.env.RIVERWATCH_ROLE_RETRY_OUTCOME_TIMEOUT_MS || process.env.RIVERWATCH_ROLE_OUTCOME_TIMEOUT_MS || process.env.RIVERWATCH_ROLE_EVIDENCE_TIMEOUT_MS || (fast ? 180000 : 600000))
      });
      if (retryOutcome?.status === 'blocked') {
        throw new Error(`role ${item.role} still references old PM-only boundary after retry`);
      }
    }
    await page.waitForTimeout(waitBrief);
  }
  await screenshot(page, '11a3-direct-role-execution-sent');
}

function hasRiverWatchSourceOrDraftArtifacts(messages) {
  const artifactNameSource = [
    'source-pack\\.md',
    'usgs-nwis-snapshot\\.json',
    'usgs-iv-[^\\s/]*\\.json',
    'usgs-site-[^\\s/]*\\.rdb',
    'data-source-contract\\.md',
    'README\\.md',
    'index\\.html',
    'prd\\.md',
    'budget-schedule\\.md',
    'riverwatch-prd\\.md',
    'riverwatch-budget-schedule\\.md',
    'riverwatch-project-report\\.md',
    'riverwatch-frontend-readme\\.md',
    'riverwatch-dashboard\\.html',
    'riverwatch-internal-review-ppt-storyboard\\.md'
  ].join('|');
  const artifactNamePattern = new RegExp(artifactNameSource, 'i');
  const fileEvidence = messages
    .map((message) => [
      message.fileName,
      message.url,
      message.workspacePath,
      message.previewContent
    ].join(' '))
    .join('\n');
  if (artifactNamePattern.test(fileEvidence)) return true;

  const agentWorkspaceText = messages
    .filter((message) => !/演示用户/.test(String(message.senderName || '')))
    .map((message) => String(message.content || ''))
    .join('\n');
  return new RegExp(`\\.clowder\\/workspaces\\/\\S*(${artifactNameSource})`, 'i').test(agentWorkspaceText);
}

async function waitForInitialDeliverableFileCards(page, groupId) {
  const found = new Map();
  const start = Date.now();
  const firstPhaseMs = Number(process.env.RIVERWATCH_INITIAL_FILE_WAIT_MS || (fast ? 240000 : 720000));
  const recoveryDeadlineMs = Number(process.env.RIVERWATCH_RECOVERY_FILE_WAIT_MS || (fast ? 1080000 : 1800000));
  let deadline = start + firstPhaseMs;
  let recoverySent = false;
  let convergenceSent = false;

  while (Date.now() < deadline) {
    await refreshActiveMessages(page);
    const messages = await getConversationMessages(page, groupId);
    for (const expected of expectedRiverWatchDeliverables) {
      if (found.has(expected.fileName)) continue;
      const match = messages.find((message) => isExpectedRiverWatchFileCard(message, expected));
      if (match) {
        assertRealFileCard(match);
        found.set(expected.fileName, match);
      }
    }
    if (found.size === expectedRiverWatchDeliverables.length) {
      return Object.fromEntries(found.entries());
    }

    const transcript = messages.map((message) => `${message.senderName}: ${message.content}`).join('\n');
    const aiLooksDone = /(PRD.*已完成|预算.*已完成|README.*已完成|HTML.*已完成|前端看板.*完成|部署 preview|现在.*部署)/i.test(transcript);
    const sourceOrDraftArtifactsReady = hasRiverWatchSourceOrDraftArtifacts(messages);
    if (!convergenceSent && sourceOrDraftArtifactsReady) {
      await sendDeliverableConvergenceRequest(page);
      convergenceSent = true;
      recoverySent = true;
      deadline = Date.now() + recoveryDeadlineMs;
    } else if (!recoverySent && (aiLooksDone || Date.now() - start > firstPhaseMs * 0.7)) {
      await sendFileCardRecoveryRequest(page);
      recoverySent = true;
      deadline = Date.now() + recoveryDeadlineMs;
    }

    await page.waitForTimeout(fast ? 1500 : 5000);
  }

  const missing = expectedRiverWatchDeliverables.map((file) => file.fileName).filter((fileName) => !found.has(fileName));
  throw new Error(`real AI file cards not produced before timeout: ${missing.join(', ')}`);
}

async function getFileCardIds(page, groupId) {
  await refreshActiveMessages(page);
  const messages = await getConversationMessages(page, groupId);
  return new Set(messages.filter((message) => message.fileName).map((message) => message.id || `${message.fileName}:${message.time}`));
}

async function waitForLatestHtmlFile(page, groupId, options = {}) {
  const deadline = Date.now() + (options.timeout || aiWaitTimeout);
  const previousIds = options.previousIds || new Set();
  let latest = null;
  while (Date.now() < deadline) {
    await refreshActiveMessages(page);
    const messages = await getConversationMessages(page, groupId);
    const htmlFiles = messages
      .filter((message) => /RiverWatch_展示首页.*\.html/i.test(message.fileName) || (/\.html$/i.test(message.fileName) && /RiverWatch/i.test(message.fileName + message.content + message.previewContent)))
      .filter((message) => !previousIds.has(message.id || `${message.fileName}:${message.time}`));
    if (htmlFiles.length) {
      latest = htmlFiles.at(-1);
      assertRealFileCard(latest);
      return latest;
    }
    await page.waitForTimeout(fast ? 1500 : 5000);
  }
  throw new Error('latest real RiverWatch HTML file card not produced before timeout');
}

async function waitForAgentText(page, groupId, patterns, options = {}) {
  const checks = patterns.map((pattern) => pattern instanceof RegExp ? pattern : new RegExp(String(pattern)));
  const deadline = Date.now() + (options.timeout || aiWaitTimeout);
  while (Date.now() < deadline) {
    await refreshActiveMessages(page);
    const messages = await getConversationMessages(page, groupId);
    const match = messages.find((message) => {
      const text = `${message.senderName} ${message.content}`;
      return checks.every((pattern) => pattern.test(text));
    });
    if (match) return match;
    await page.waitForTimeout(fast ? 1500 : 5000);
  }
  throw new Error(`expected real agent text not found: ${checks.map(String).join(', ')}`);
}

async function clickPreviewNearFile(page, fileName) {
  await page.getByText(fileName, { exact: false }).first().waitFor({ timeout: 30000 });
  await page.evaluate(({ fileName }) => {
    const roots = Array.from(document.querySelectorAll('.file-card'));
    const root = roots.find((node) => node.textContent?.includes(fileName));
    if (!root) throw new Error(`file card not found: ${fileName}`);
    const button = Array.from(root.querySelectorAll('button, uni-button')).find((node) => node.textContent?.includes('预览'));
    if (!button) throw new Error(`preview button not found: ${fileName}`);
    button.click();
  }, { fileName });
  await page.waitForTimeout(waitBrief);
}

async function waitForPreviewSurface(page, fileName) {
  await page.getByText(fileName, { exact: false }).first().waitFor({ timeout: 30000 });
  await page.locator('.file-preview-panel, .preview-panel, .file-preview-content, .preview-body').first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(waitBrief);
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 8) throw new Error(`${label} horizontal overflow: ${overflow}`);
}

function fileNameFor(files = {}, fallback) {
  return files[fallback]?.fileName || fallback;
}

async function previewFiles(page, files = {}) {
  const reportName = fileNameFor(files, 'RiverWatch_项目汇报.md');
  const prdName = fileNameFor(files, 'RiverWatch_PRD.md');
  const budgetName = fileNameFor(files, 'RiverWatch_预算与排期.md');
  const readmeName = fileNameFor(files, 'RiverWatch_技术README.md');
  const htmlName = fileNameFor(files, 'RiverWatch_展示首页.html');

  await clickPreviewNearFile(page, reportName);
  await waitForPreviewSurface(page, reportName);
  await screenshot(page, '12-preview-report');
  await page.waitForTimeout(waitStep);
  const fullscreenButton = page.locator('.ppt-fullscreen-btn').first();
  if (await fullscreenButton.count()) {
    await clickButtonText(page, '下一页').catch(() => {});
    await page.waitForTimeout(waitStep);
    await fullscreenButton.click({ timeout: 30000 });
    await page.locator('.ppt-fullscreen-layer, .presentation-pdf-fullscreen-layer').first().waitFor({ timeout: 30000 });
    await screenshot(page, '13-preview-ppt-fullscreen');
  } else {
    await screenshot(page, '13-preview-report-detail');
  }
  await page.waitForTimeout(waitLong);
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('.ppt-fullscreen-close, .presentation-pdf-fullscreen-close').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(waitBrief);

  await clickPreviewNearFile(page, prdName);
  await waitForPreviewSurface(page, prdName);
  await screenshot(page, '14-preview-prd');
  await page.waitForTimeout(waitStep);

  await clickPreviewNearFile(page, budgetName);
  await waitForPreviewSurface(page, budgetName);
  await screenshot(page, '15-preview-budget');
  await page.waitForTimeout(waitStep);

  await clickPreviewNearFile(page, readmeName);
  await waitForPreviewSurface(page, readmeName);
  await screenshot(page, '16-preview-readme');
  await page.waitForTimeout(waitStep);
  await clickButtonText(page, '源码').catch(() => {});
  await page.waitForTimeout(waitStep);
  await clickButtonText(page, '预览').catch(() => {});
  await page.waitForTimeout(waitBrief);

  await clickPreviewNearFile(page, htmlName);
  await waitForPreviewSurface(page, htmlName);
  await screenshot(page, '17-preview-html');
  await page.waitForTimeout(waitStep);
  await assertNoHorizontalOverflow(page, 'file previews');
}

async function pinConstraintMessage(page) {
  const box = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.message-row'));
    const row = rows.find((node) => {
      const text = node.textContent || '';
      return /预算/.test(text) && /5\s*万/.test(text) && /(公开|数据|不伪造|N\/A|移动端)/i.test(text);
    });
    if (!row) return null;
    const rect = row.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!box) throw new Error('constraint message box unavailable');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  try {
    await clickText(page, '设为长期上下文', { timeout: 5000 });
  } catch {
    await page.evaluate(async () => {
      const app = document.querySelector('#app')?.__vue_app__;
      const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
      const pinia = piniaKey ? app._context.provides[piniaKey] : null;
      const convStore = pinia?._s?.get('conversation');
      const messageStore = pinia?._s?.get('message');
      const conversation = (convStore?.conversations || []).find((item) => item.id === convStore?.activeId || item.channelId === convStore?.activeId) || convStore?.activeId;
      const messages = messageStore?.messages?.[convStore?.activeId] || [];
      const message = messages.find((item) => {
        const text = String(item.content || item.text || '');
        return /预算/.test(text) && /5\s*万/.test(text) && /(公开|数据|不伪造|N\/A|移动端)/i.test(text);
      });
      if (!message) throw new Error('constraint message unavailable for manual context pin');
      await messageStore.pinMessageAsContext(conversation, message);
    });
  }
  await page.getByText('长期上下文', { exact: false }).first().waitFor({ timeout: 30000 });
  await screenshot(page, '18-pinned-context');
  await page.waitForTimeout(waitStep);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(waitBrief);
}

async function returnToGroupChat(page, groupId) {
  await page.goto(`${baseUrl}/#/pages/chat/index`, { waitUntil: 'networkidle', timeout: 60000 });
  await setActiveConversation(page, groupId);
  await page.getByText('RiverWatch', { exact: false }).first().waitFor({ timeout: 30000 });
  await page.locator('.file-preview-close, .preview-close, .panel-close').first().click({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(waitBrief);
}

async function sendRevisionRequest(page, files = {}) {
  const prdName = fileNameFor(files, 'RiverWatch_PRD.md');
  await clickPreviewNearFile(page, prdName);
  await waitForPreviewSurface(page, prdName);
  const selectionPoint = await page.evaluate(() => {
    const root = Array.from(document.querySelectorAll('.word-preview-container, .preview-body'))
      .find((node) => String(node.textContent || '').trim().length > 20);
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    let target = null;
    while (walker.nextNode()) {
      const value = String(walker.currentNode.nodeValue || '').trim();
      if (value.length > 16 && /RiverWatch|水质|数据|预算|移动端|需求|验收/i.test(value)) {
        target = walker.currentNode;
        break;
      }
    }
    if (!target) throw new Error('target text not found');
    const text = String(target.nodeValue || '');
    const trimmedStart = Math.max(0, text.search(/\S/));
    const selectedLength = Math.min(48, text.trim().length);
    const range = document.createRange();
    range.setStart(target, trimmedStart);
    range.setEnd(target, trimmedStart + selectedLength);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    const rect = range.getBoundingClientRect();
    return {
      x: rect.left + Math.max(8, Math.min(rect.width - 4, 40)),
      y: rect.top + Math.max(8, Math.min(rect.height - 4, 12))
    };
  });
  await page.waitForTimeout(waitBrief);
  await page.mouse.click(selectionPoint.x, selectionPoint.y, { button: 'right' });
  await clickText(page, '引用选中文本');
  await fillLastTextarea(page, buildRevisionPrompt());
  await screenshot(page, '19-quote-revision');
  await page.waitForTimeout(waitStep);
  await sendCurrentInput(page);
  await page.getByText('请把 USGS 数据来源', { exact: false }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(waitBrief);
}

async function sendFrontendMention(page) {
  await fillLastTextarea(page, buildFrontendMentionPrompt());
  await screenshot(page, '20-at-frontend-draft');
  await page.waitForTimeout(waitStep);
  await sendCurrentInput(page);
  await page.getByText('@Frontend 请把移动端首页', { exact: false }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(waitBrief);
}

async function waitForDeploymentCard(page, groupId, options = {}) {
  const deadline = Date.now() + (options.timeout || 90000);
  while (Date.now() < deadline) {
    await refreshActiveMessages(page);
    const messages = await getConversationMessages(page, groupId);
    const cardMessage = messages.find((message) => message.deploymentCard?.cardId);
    if (cardMessage?.deploymentCard) return cardMessage.deploymentCard;
    await page.waitForTimeout(fast ? 800 : 2000);
  }
  throw new Error('real group deployment card did not appear');
}

async function pollDeploymentComplete(page, groupId, cardId) {
  for (let i = 0; i < 80; i += 1) {
    const result = await page.evaluate(async ({ groupId, cardId }) => {
      const app = document.querySelector('#app')?.__vue_app__;
      const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
      const pinia = piniaKey ? app._context.provides[piniaKey] : null;
      const messageStore = pinia?._s?.get('message');
      const msg = (messageStore?.messages?.[groupId] || []).find((item) => item.id === cardId || item.deploymentCard?.cardId === cardId);
      const card = msg?.deploymentCard;
      if (!card) return { status: '' };
      return {
        status: card.status,
        previewUrl: card.previewUrl || '',
        downloadUrl: card.downloadUrl || ''
      };
    }, { groupId, cardId });
    if (result.status === 'succeeded' || result.status === 'deployed') return result;
    await page.evaluate(async ({ groupId, cardId }) => {
      const app = document.querySelector('#app')?.__vue_app__;
      const piniaKey = Object.getOwnPropertySymbols(app?._context?.provides || {}).find((symbol) => String(symbol) === 'Symbol(pinia)');
      const pinia = piniaKey ? app._context.provides[piniaKey] : null;
      const messageStore = pinia?._s?.get('message');
      const msg = (messageStore?.messages?.[groupId] || []).find((item) => item.id === cardId || item.deploymentCard?.cardId === cardId);
      const card = msg?.deploymentCard;
      if (!card?.deploymentRequestId) return;
      const token = localStorage.getItem('app_token') || '';
      const response = await fetch(`/v1/clowder/conversation/deployment-request/${encodeURIComponent(card.deploymentRequestId)}`, {
        headers: token ? { token } : {}
      }).catch(() => null);
      if (!response?.ok) return;
      const body = await response.json().catch(() => ({}));
      const latest = body.deploymentRequest || body.data?.deploymentRequest || body.data || body;
      if (latest) {
        messageStore.createDeploymentCard(groupId, {
          deploymentRequest: latest,
          sourceMessage: { id: card.sourceMessageId, clientMsgNo: card.sourceClientMsgNo, content: card.originalText },
          conversation: { id: groupId, channelId: groupId, channelType: 2, directCatId: card.catId, source: 'clowder', type: 'group', isProjectGroup: true },
          agent: { id: card.catId, name: card.catDisplayName }
        });
      }
    }, { groupId, cardId });
    await page.waitForTimeout(fast ? 500 : 1500);
  }
  throw new Error('deployment did not complete');
}

async function waitForDeploymentCancelled(page, groupId, cardId) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    await refreshActiveMessages(page);
    const messages = await getConversationMessages(page, groupId);
    const card = messages.find((message) => message.deploymentCard?.cardId === cardId)?.deploymentCard;
    if (card && ['cancelled', 'canceled'].includes(card.status)) return card;
    await page.waitForTimeout(fast ? 800 : 2000);
  }
  throw new Error('deployment card did not switch to cancelled state');
}

async function showDeploymentAndPreview(page, groupId, latestHtmlFile) {
  await setActiveConversation(page, groupId);
  await page.getByText('确认部署', { exact: false }).first().waitFor({ timeout: 30000 });
  const initialCard = await waitForDeploymentCard(page, groupId);
  await screenshot(page, '22-deployment-card');
  await page.waitForTimeout(waitKey);
  await clickButtonText(page, '同意部署', { timeout: 30000 });
  await page.waitForTimeout(waitStep);
  const deployment = await pollDeploymentComplete(page, groupId, initialCard.cardId);
  await page.getByText('部署完成', { exact: false }).first().waitFor({ timeout: 30000 });
  await screenshot(page, '23-deployment-complete');
  await page.waitForTimeout(waitStep);
  if (!deployment.previewUrl) throw new Error('deployment completed without real previewUrl');

  const previewPromise = page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);
  await clickButtonText(page, '复制', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(waitStep);
  await clickButtonText(page, '打开预览', { timeout: 10000 });
  const previewPage = await previewPromise || await page.context().newPage();
  if (!previewPage.url() || previewPage.url() === 'about:blank') {
    await previewPage.goto(deployment.previewUrl, { waitUntil: 'networkidle', timeout: 60000 });
  }
  await previewPage.bringToFront();
  await previewPage.setViewportSize(viewport);
  await previewPage.getByText('RiverWatch', { exact: false }).first().waitFor({ timeout: 30000 });
  for (const text of ['pH', '溶解氧', '浊度', '氨氮']) {
    await previewPage.getByText(text, { exact: false }).first().waitFor({ timeout: 30000 }).catch(() => {});
  }
  await previewPage.screenshot({ path: path.join(finalDocsDir, 'riverwatch-real-demo-preview-page.png'), fullPage: true });
  await previewPage.waitForTimeout(waitLong);
  await page.bringToFront();
  await setActiveConversation(page, groupId);
  await page.getByText(latestHtmlFile.fileName || 'RiverWatch_展示首页', { exact: false }).first().waitFor({ timeout: 30000 }).catch(() => {});
  await clickButtonText(page, '取消部署', { timeout: 30000 });
  await waitForDeploymentCancelled(page, groupId, initialCard.cardId);
  await screenshot(page, '24-deployment-cancelled');
  await page.waitForTimeout(waitKey);
  return { previewPage, previewUrl: previewPage.url(), cardId: initialCard.cardId };
}

async function saveFailure(page, error) {
  await mkdir(workDir, { recursive: true });
  try {
    await screenshot(page, 'failure');
  } catch {}
  try {
    const state = await page.evaluate(() => ({
      url: location.href,
      text: document.body?.innerText?.slice(0, 8000) || '',
      storageKeys: Object.keys(localStorage || {}).filter((key) => /agent|chat|token|user/i.test(key))
    }));
    await writeFile(path.join(workDir, 'failure-state.json'), JSON.stringify({
      error: String(error?.stack || error?.message || error),
      state
    }, null, 2));
  } catch {}
}

async function maybeConcatVideos(inputs, output) {
  const existing = inputs.filter(Boolean);
  if (existing.length === 1) {
    await rename(existing[0], output);
    return output;
  }
  const listPath = path.join(workDir, 'concat-list.txt');
  await writeFile(listPath, existing.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n'));
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', output], {
    stdio: 'pipe',
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    await rename(existing[0], output);
    return output;
  }
  return output;
}

async function run() {
  await mkdir(workDir, { recursive: true });
  await mkdir(finalDocsDir, { recursive: true });
  await resetDemoRuntimeCats();
  const waterSnapshot = await fetchWaterQualitySnapshot();
  await writeFile(path.join(workDir, 'water-quality-snapshot.json'), JSON.stringify(waterSnapshot, null, 2), 'utf8');
  const projectPrompt = buildProjectPrompt(waterSnapshot);
  const account = await ensureAccount();
  const consoleErrors = [];
  const badResponses = [];
  let browser;
  let context;
  let mainPage;
  let previewPage;
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      locale: 'zh-CN',
      recordVideo: { dir: workDir, size: viewport }
    });
    mainPage = await context.newPage();
    mainPage.setDefaultTimeout(30000);
    mainPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    mainPage.on('pageerror', (err) => consoleErrors.push(err.message));
    mainPage.on('response', (response) => {
      if (response.status() >= 400 && !/favicon|unsplash|sockjs|__vite_ping/i.test(response.url())) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await mainPage.goto(`${baseUrl}/#/pages/login/index`, { waitUntil: 'networkidle', timeout: 60000 });
    await mainPage.getByText('AgentHub 通讯', { exact: false }).first().waitFor({ timeout: 30000 });
    await screenshot(mainPage, '01-login');
    await mainPage.waitForTimeout(waitStep);
    if (process.env.AGENTHUB_DEMO_PHONE) {
      await fillInput(mainPage, 0, account.phone);
      await fillInput(mainPage, 1, account.password);
      await screenshot(mainPage, '02-login-filled');
      await clickButtonText(mainPage, '安全登录');
      await mainPage.waitForURL(/pages\/chat\/index/, { timeout: 60000 });
    } else {
      await clickText(mainPage, '注册账号');
      await mainPage.getByText('加入 AgentHub', { exact: false }).first().waitFor({ timeout: 30000 });
      await fillInput(mainPage, 0, account.phone);
      await fillInput(mainPage, 1, '123456');
      await fillInput(mainPage, 2, `RiverWatch 演示用户 ${suffix}`);
      await fillInput(mainPage, 3, account.password);
      await screenshot(mainPage, '02-register-filled');
      await clickButtonText(mainPage, '注册账号');
      await mainPage.waitForURL(/pages\/chat\/index/, { timeout: 60000 });
    }
    await mainPage.getByText('聊天', { exact: false }).first().waitFor({ timeout: 30000 });
    await screenshot(mainPage, '03-chat');
    await mainPage.waitForTimeout(waitStep);

    const pm = await openAgentsAndCreatePm(mainPage);
    const pmConversationState = await getStoresSnapshot(mainPage);
    const pmConversationId = pmConversationState.activeId || `clowder_cat:${pm.alias}`;

    await fillLastTextarea(mainPage, projectPrompt);
    await screenshot(mainPage, '07-kickoff-draft');
    await mainPage.waitForTimeout(waitStep);
    await sendCurrentInput(mainPage);
    await mainPage.getByText('建议创建项目群', { exact: false }).first().waitFor({ timeout: 45000 });
    await screenshot(mainPage, '08-kickoff-cards');
    await mainPage.waitForTimeout(waitKey);
    const pmMessagesBeforeProjectGroupConfirm = await getConversationMessages(mainPage, pmConversationId);
    assertNoPmDirectBackendProposal(pmMessagesBeforeProjectGroupConfirm, aiProvider);

    const templateCatsConfirmed = await maybeConfirmTemplateCats(mainPage);
    if (templateCatsConfirmed) {
      await screenshot(mainPage, '09-template-cats-created');
      await mainPage.waitForTimeout(waitStep);
    } else {
      await screenshot(mainPage, '09-template-cats-reused');
      await mainPage.waitForTimeout(waitBrief);
    }

    const projectCard = await ensureProjectGroupCreated(mainPage);
    await mainPage.getByText('打开项目群', { exact: false }).first().waitFor({ timeout: 60000 });
    await screenshot(mainPage, '10-project-group-created');
    await mainPage.waitForTimeout(waitStep);

    const groupId = projectCard.projectGroupNo || projectCard.groupNo;
    await mainPage.locator('[data-testid="project-group-confirmation-card"]').first().getByText('打开项目群', { exact: true }).click({ timeout: 30000 });
    await mainPage.waitForTimeout(waitBrief);
    await mainPage.goto(`${baseUrl}/#/pages/chat/detail?id=${encodeURIComponent(groupId)}`, { waitUntil: 'networkidle', timeout: 60000 });
    await setActiveConversation(mainPage, groupId);
    await mainPage.getByText('RiverWatch', { exact: false }).first().waitFor({ timeout: 30000 });
    const stateAfterGroupOpen = await getStoresSnapshot(mainPage);
    const activeProjectGroup = assertProjectGroupOpenState(stateAfterGroupOpen, groupId, mainPage.url());
    assertProjectGroupProviderCompatibility(activeProjectGroup, aiProvider);
    const projectThreadId = projectThreadIdFromConversation(activeProjectGroup);
    await screenshot(mainPage, '11-project-group-open');
    await mainPage.waitForTimeout(waitKey);
    await waitForConversationStreamingIdle(mainPage, pmConversationId, 'PM kickoff', {
      timeout: Number(process.env.RIVERWATCH_PM_KICKOFF_IDLE_TIMEOUT_MS || (fast ? 420000 : 900000)),
      quietMs: Number(process.env.RIVERWATCH_PM_KICKOFF_IDLE_QUIET_MS || (fast ? 12000 : 45000)),
      staleStreamBypassMs: Number(process.env.RIVERWATCH_PM_KICKOFF_STALE_STREAM_BYPASS_MS || (fast ? 90000 : 240000))
    });
    const pmMessagesAfterKickoffIdle = await getConversationMessages(mainPage, pmConversationId);
    assertNoPmDirectBackendProposal(pmMessagesAfterKickoffIdle, aiProvider);
    await screenshot(mainPage, '11a-pm-kickoff-idle');
    await mainPage.waitForTimeout(waitBrief);
    await waitForProjectGroupInitialSettled(mainPage, groupId, {
      timeout: Number(process.env.RIVERWATCH_GROUP_INITIAL_SETTLE_TIMEOUT_MS || (fast ? 180000 : 420000)),
      minSettleMs: Number(process.env.RIVERWATCH_GROUP_INITIAL_SETTLE_MS || (fast ? 15000 : 45000)),
      staleStreamBypassMs: Number(process.env.RIVERWATCH_GROUP_INITIAL_STALE_STREAM_BYPASS_MS || (fast ? 90000 : 240000)),
      quietMs: Number(process.env.RIVERWATCH_GROUP_INITIAL_IDLE_QUIET_MS || (fast ? 7000 : 20000)),
      agentQuietMs: Number(process.env.RIVERWATCH_GROUP_INITIAL_AGENT_QUIET_MS || (fast ? 7000 : 20000))
    });
    await screenshot(mainPage, '11a1-project-group-initial-idle');
    await mainPage.waitForTimeout(waitBrief);
    const workspaceFilesBeforeExecution = await listWorkspaceFilesForThread(projectThreadId);
    const executionPromptPreviousIds = await getConversationMessageIdentitySet(mainPage, groupId);
    await fillLastTextarea(mainPage, buildProjectExecutionPrompt());
    await screenshot(mainPage, '11a-project-execution-draft');
    await mainPage.waitForTimeout(waitStep);
    await sendCurrentInput(mainPage);
    await waitForConversationTextInStore(mainPage, 'RiverWatch 项目群正式执行阶段公告', {
      conversationId: groupId,
      previousIds: [...executionPromptPreviousIds],
      timeout: 45000
    });
    await sendDirectRoleExecutionRequests(mainPage, groupId, projectThreadId);
    await waitForWorkspaceFileEvidence(projectThreadId, workspaceFilesBeforeExecution, {
      timeout: Number(process.env.RIVERWATCH_WORKSPACE_FILE_EVIDENCE_TIMEOUT_MS || (fast ? 90000 : 300000))
    });
    await waitForAgentText(mainPage, groupId, [/预算|RiverWatch|数据|交付|分工/i], { timeout: aiWaitTimeout });
    const initialFiles = await waitForInitialDeliverableFileCards(mainPage, groupId);
    await screenshot(mainPage, '11b-project-deliverables');
    await mainPage.waitForTimeout(waitKey);

    await mainPage.locator('.toggle-detail-btn').first().click({ timeout: 30000 }).catch(() => {});
    await mainPage.waitForTimeout(waitBrief);
    await clickText(mainPage, '智能体看板').catch(async () => {
      await mainPage.goto(`${baseUrl}/#/pages/agents/board?groupId=${encodeURIComponent(groupId)}`, { waitUntil: 'networkidle', timeout: 60000 });
    });
    await mainPage.getByText('RiverWatch', { exact: false }).first().waitFor({ timeout: 30000 });
    await screenshot(mainPage, '11c-agent-board');
    await mainPage.waitForTimeout(waitStep);
    await mainPage.goto(`${baseUrl}/#/pages/chat/index`, { waitUntil: 'networkidle', timeout: 60000 });
    await setActiveConversation(mainPage, groupId);

    await previewFiles(mainPage, initialFiles);
    await pinConstraintMessage(mainPage);
    await returnToGroupChat(mainPage, groupId);
    await sendRevisionRequest(mainPage, initialFiles);
    const revisionFiles = await waitForFileCards(mainPage, groupId, expectedRiverWatchRevisionDeliverables);
    await mainPage.getByText(fileNameFor(revisionFiles, 'RiverWatch_展示首页_v2.html'), { exact: false }).first().waitFor({ timeout: 30000 });
    await screenshot(mainPage, '21-revision-files');
    await mainPage.waitForTimeout(waitKey);
    const htmlIdsBeforeFrontendMention = await getFileCardIds(mainPage, groupId);
    await sendFrontendMention(mainPage);
    const latestHtmlFile = await waitForLatestHtmlFile(mainPage, groupId, { previousIds: htmlIdsBeforeFrontendMention });
    await mainPage.getByText(latestHtmlFile.fileName, { exact: false }).first().waitFor({ timeout: 30000 });
    await mainPage.waitForTimeout(waitKey);

    await fillLastTextarea(mainPage, buildDeploymentPrompt(latestHtmlFile.fileName || revisionFiles['RiverWatch_展示首页_v2.html']?.fileName));
    await screenshot(mainPage, '21b-deployment-request-draft');
    await mainPage.waitForTimeout(waitStep);
    await sendCurrentInput(mainPage);
    const previewInfo = await showDeploymentAndPreview(mainPage, groupId, latestHtmlFile);
    previewPage = previewInfo.previewPage;
    await mainPage.bringToFront();
    await mainPage.screenshot({ path: path.join(finalDocsDir, 'riverwatch-real-demo-final-frame.png'), fullPage: true });

    const mainVideoHandle = mainPage.video();
    const previewVideoHandle = previewPage?.video();
    await context.close();
    context = null;
    await browser.close();
    browser = null;
    const mainVideo = mainVideoHandle ? await mainVideoHandle.path() : '';
    const previewVideo = previewVideoHandle ? await previewVideoHandle.path().catch(() => '') : '';

    const targetVideo = path.join(finalDocsDir, 'riverwatch-demo-real-full.webm');
    await maybeConcatVideos([mainVideo, previewVideo], targetVideo);

    const report = {
      video: targetVideo,
      finalFrame: path.join(finalDocsDir, 'riverwatch-real-demo-final-frame.png'),
      previewScreenshot: path.join(finalDocsDir, 'riverwatch-real-demo-preview-page.png'),
      previewUrl: previewInfo.previewUrl,
      fast,
      groupId,
      aiProvider,
      aiPlatform: aiPlatform.label,
      oauthReadyText: aiPlatform.readyText,
      deliverables: {
        initial: initialFiles,
        revision: revisionFiles,
        latestHtml: latestHtmlFile
      },
      badResponses,
      consoleErrors: consoleErrors.filter((line) => !/ResizeObserver|favicon|Unsplash|WebSocket/i.test(line))
    };
    await writeFile(path.join(finalDocsDir, 'riverwatch-demo-real-full-report.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (mainPage) await saveFailure(mainPage, error);
    throw error;
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  assertProjectGroupProviderCompatibility,
  assertProjectGroupOpenState,
  assertNoPmDirectBackendProposal,
  buildDeliverableConvergencePrompt,
  buildDirectRoleExecutionPrompts,
  buildFileCardRecoveryPrompt,
  buildProjectExecutionPrompt,
  buildProjectPrompt,
  buildUnavailableWaterSnapshot,
  buildWaterSnapshotFromSite,
  ensureProjectGroupCreated,
  expectedRiverWatchDeliverables,
  findRoleExecutionEvidence,
  hasRiverWatchSourceOrDraftArtifacts,
  isActiveStreamingMessage,
  isExpectedRiverWatchFileCard,
  isMeaningfulRiverWatchWorkspaceFile,
  invocationRecordIdentity,
  normalizeInvocationLogLine,
  normalizeQueuedInvocationLogLine,
  parseRiverWatchDemoArgs,
  pmDirectProposalProviderViolations,
  projectGroupProviderViolations,
  riverWatchDemoResetAgentIds,
  resolveRiverWatchDemoConfig,
  waitForNewThreadInvocation,
  waitForRoleExecutionOutcome
};
