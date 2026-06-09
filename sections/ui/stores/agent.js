import { defineStore } from 'pinia';
import { nativeImService } from '@/services/native-im/service';
import { normalizeClowderProjectBoard } from '@/services/native-im/project-board';
import {
  createLocalOAuthCapabilityLoader,
  oauthProviderForPlatform
} from '@/services/native-im/oauth';
import {
  resolveAgentDeleteIdentity,
  isAgentMatch
} from '@/services/native-im/agent-cleanup';

const STATIC_AGENT_IDS = new Set([
  'pm-agent',
  'codex',
  'claude-code',
  'ds',
  'logic-weaver',
  'creative-spark',
  'clowder'
]);

const SKILL_TONES = ['primary', 'cyan', 'orange', 'green', 'purple'];

function agentErrorText(error) {
  return error?.msg || error?.message || '智能体目录同步失败';
}

function normalizeSkillCatalog(skillCatalog = {}, agents = []) {
  return Object.entries(skillCatalog || {}).flatMap(([provider, entries], providerIndex) => {
    if (!Array.isArray(entries)) return [];
    return entries.map((entry, index) => {
      const name = String(entry.name || entry.id || `${provider}-${index + 1}`).trim();
      const id = `${provider}-${name}`.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-');
      return {
        id,
        name,
        category: entry.category || provider,
        level: entry.mounted === false ? '未启用' : '可用',
        desc: entry.description || entry.trigger || '后端技能已同步',
        icon: 'bookmark',
        tone: SKILL_TONES[(providerIndex + index) % SKILL_TONES.length],
        agentIds: agents.map((agent) => agent.id).filter(Boolean)
      };
    });
  });
}

export const useAgentStore = defineStore('agent', {
  state: () => ({
    syncState: 'idle',
    nativeError: '',
    localOAuthCapabilities: {},
    localOAuthLoading: false,
    localOAuthError: '',
    localOAuthLoaded: false,
    localOAuthInflight: null,
    agents: [
      { id: 'pm-agent', name: 'PM 智能体', alias: '@pm', desc: '项目管理专家，辅助拆解计划与里程碑', avatar: '', status: 'active', creator: 'System', platform: 'claude-code', accessMode: 'oauth', model: 'Claude 3.5 Sonnet', accountRef: 'agenthub-default', apiKey: '', apiUrl: '', customModel: '', systemPrompt: '', roleTemplate: 'general', templateId: 'reviewer', capabilityTags: ['计划', '里程碑'] },
      { id: 'codex', name: 'Codex', alias: '@codex', desc: '代码生成专家，适合快速实现与重构', avatar: '', status: 'active', creator: 'System', platform: 'codex', accessMode: 'api-key', model: 'DeepSeek V3', accountRef: 'openai-prod', apiKey: '', apiUrl: 'https://api.deepseek.com/v1', customModel: '', systemPrompt: '', roleTemplate: 'engineer', templateId: 'engineer', capabilityTags: ['代码生成', '重构'] },
      { id: 'claude-code', name: 'Claude Code', alias: '@claude', desc: '代码审查专家，擅长发现风险与回归', avatar: '', status: 'busy', creator: 'System', platform: 'claude-code', accessMode: 'oauth', model: 'Claude 3.5 Sonnet', accountRef: 'agenthub-default', apiKey: '', apiUrl: '', customModel: '', systemPrompt: '', roleTemplate: 'reviewer', templateId: 'reviewer', capabilityTags: ['代码审查', '风险识别'] },
      { id: 'ds', name: 'DeepSeek AI', alias: '@ds', desc: '通用助手，精通问答、写作和知识检索', avatar: '', status: 'inactive', creator: 'System', platform: 'codex', accessMode: 'api-key', model: 'DeepSeek V3', accountRef: 'openai-prod', apiKey: '', apiUrl: 'https://api.deepseek.com/v1', customModel: '', systemPrompt: '', roleTemplate: 'general', templateId: 'reviewer', capabilityTags: ['问答', '写作'] },
      { id: 'logic-weaver', name: '逻辑编织者', alias: '@logic', desc: '问题解决专家，适合复杂需求澄清', avatar: '', status: 'active', creator: 'User', platform: 'codex', accessMode: 'api-key', model: 'DeepSeek V3', accountRef: 'openai-prod', apiKey: '', apiUrl: 'https://api.deepseek.com/v1', customModel: '', systemPrompt: '', roleTemplate: 'analyst', templateId: 'analyst', capabilityTags: ['需求澄清', '逻辑推演'] },
      { id: 'creative-spark', name: '创意火花', alias: '@spark', desc: '构思伙伴，用于头脑风暴与方案发散', avatar: '', status: 'inactive', creator: 'User', platform: 'claude-code', accessMode: 'oauth', model: 'Claude 3.5 Sonnet', accountRef: 'agenthub-default', apiKey: '', apiUrl: '', customModel: '', systemPrompt: '', roleTemplate: 'creative', templateId: 'creative', capabilityTags: ['头脑风暴', '方案发散'] },
      { id: 'clowder', name: 'Clowder 协同猫', alias: '@clowder', desc: '用于多智能体团队协作和信息聚合', avatar: '', status: 'active', creator: 'System', platform: 'codex', accessMode: 'api-key', model: 'DeepSeek V3', accountRef: 'openai-prod', apiKey: '', apiUrl: 'https://api.deepseek.com/v1', customModel: '', systemPrompt: '', roleTemplate: 'coordinator', templateId: 'reviewer', capabilityTags: ['多智能体', '信息聚合'] }
    ],
    userSkills: [
      { id: 'skill-requirement', name: '需求澄清', category: '产品协作', level: '熟练', desc: '把模糊诉求拆成场景、约束与验收标准', icon: 'search', tone: 'primary', agentIds: ['pm-agent', 'logic-weaver'] },
      { id: 'skill-codegen', name: '代码生成', category: '工程实现', level: '熟练', desc: '根据需求快速生成页面、组件与业务逻辑', icon: 'code', tone: 'cyan', agentIds: ['codex'] },
      { id: 'skill-review', name: '代码审查', category: '质量门禁', level: '进阶', desc: '识别回归风险、交互缺口与缺失测试', icon: 'shield', tone: 'orange', agentIds: ['claude-code', 'codex'] },
      { id: 'skill-docs', name: '文档写作', category: '知识沉淀', level: '熟练', desc: '整理方案、验收记录、复盘与发布说明', icon: 'files', tone: 'green', agentIds: ['ds', 'pm-agent'] },
      { id: 'skill-workflow', name: '多智能体编排', category: '协同流程', level: '进阶', desc: '串联多个智能体执行任务、记录产出和日志', icon: 'agents', tone: 'purple', agentIds: ['clowder', 'logic-weaver'] }
    ],
    localSkills: [
      {
        id: 'skill-requirement',
        name: '需求澄清',
        category: '产品协作',
        level: '熟练',
        desc: '把模糊诉求拆成场景、约束与验收标准',
        icon: 'search',
        tone: 'primary',
        version: '1.4.2',
        packageName: 'requirement-clarifier.skill.zip',
        size: '38 KB',
        updatedAt: '2026-06-04',
        location: '~/.codex/skills/requirement-clarifier',
        author: 'AgentHub Team',
        status: '已启用',
        source: '本地',
        agentIds: ['pm-agent', 'logic-weaver'],
        triggers: ['需求不清晰', '验收标准', '用户故事', '边界条件'],
        files: ['SKILL.md', 'references/question-bank.md', 'scripts/spec-outline.js'],
        documents: [
          {
            id: 'overview',
            title: '使用说明',
            type: 'Markdown',
            updatedAt: '2026-06-04',
            summary: '说明技能触发时机、输入材料和输出格式。',
            markdown: `# 需求澄清 Skill

用于把一句模糊需求整理成可执行的产品说明。适合在新增功能、改造旧页面、拆验收标准前使用。

## 何时使用

- 用户只描述目标，但没有说明边界。
- 需要把想法拆成用户故事、验收场景和非目标。
- 需要提前识别跨端、权限、状态和数据来源风险。

## 输出结构

| 区块 | 内容 |
| --- | --- |
| 背景 | 需求要解决的真实问题 |
| 用户故事 | 按优先级排列的可独立验证场景 |
| 验收标准 | 可截图、可复测、可判定的结果 |
| 风险 | 需要用户或实现阶段确认的约束 |

> 这是 UI 预览用的渲染内容，当前页面不会读取真实本地文件。`
          },
          {
            id: 'checklist',
            title: '澄清清单',
            type: 'Markdown',
            updatedAt: '2026-06-04',
            summary: '用于快速检查需求是否可进入实现。',
            markdown: `# 澄清清单

1. 是否能在 5 秒内说清楚用户下一步动作？
2. 是否明确桌面、H5、移动端、Android 的目标表现？
3. 是否说明空状态、错误状态和加载状态？
4. 是否存在需要后端、权限或本地文件系统支持的能力？

## 建议输出

- 一段简短结论。
- 三到五条关键问题。
- 可以直接落到任务列表的验收项。`
          }
        ]
      },
      {
        id: 'skill-codegen',
        name: '代码生成',
        category: '工程实现',
        level: '熟练',
        desc: '根据需求快速生成页面、组件与业务逻辑',
        icon: 'code',
        tone: 'cyan',
        version: '2.1.0',
        packageName: 'codegen-assistant.skill.zip',
        size: '62 KB',
        updatedAt: '2026-06-05',
        location: '~/.codex/skills/codegen-assistant',
        author: 'Engineering Guild',
        status: '已启用',
        source: '本地',
        agentIds: ['codex'],
        triggers: ['实现页面', '新增组件', '重构', '补测试'],
        files: ['SKILL.md', 'templates/component.vue', 'references/vue-patterns.md'],
        documents: [
          {
            id: 'overview',
            title: '实现流程',
            type: 'Markdown',
            updatedAt: '2026-06-05',
            summary: '定义代码生成前后的最小工程检查。',
            markdown: `# 代码生成 Skill

这个技能帮助智能体在理解现有代码风格后进行小步实现。

## 工作流

- 读取相关页面、组件、store 和样式。
- 优先复用现有组件与设计 token。
- 只在必要时新增抽象。
- 实现后运行可用的构建、烟测或截图脚本。

## Vue/uni-app 注意事项

| 项目 | 约束 |
| --- | --- |
| 状态 | 共享状态放入 Pinia |
| 图标 | 经过 AppIcon 统一出口 |
| 文案 | 中文必须避免乱码 |
| 移动端 | 触控目标不少于 44px |

如果需求明确要求 UI-only，按钮可以提供占位反馈，但不接真实业务逻辑。`
          }
        ]
      },
      {
        id: 'skill-review',
        name: '代码审查',
        category: '质量门禁',
        level: '进阶',
        desc: '识别回归风险、交互缺口与缺失测试',
        icon: 'shield',
        tone: 'orange',
        version: '1.8.3',
        packageName: 'review-gate.skill.zip',
        size: '44 KB',
        updatedAt: '2026-06-03',
        location: '~/.codex/skills/review-gate',
        author: 'QA Guild',
        status: '已启用',
        source: '本地',
        agentIds: ['claude-code', 'codex'],
        triggers: ['代码评审', '回归风险', '缺少测试', '上线前检查'],
        files: ['SKILL.md', 'references/risk-taxonomy.md'],
        documents: [
          {
            id: 'review-template',
            title: '评审模板',
            type: 'Markdown',
            updatedAt: '2026-06-03',
            summary: '按严重程度输出发现、疑问和测试缺口。',
            markdown: `# 代码审查 Skill

审查输出优先关注会影响用户的行为变化，而不是罗列风格偏好。

## 输出顺序

1. 高风险问题。
2. 中低风险问题。
3. 开放问题或假设。
4. 测试缺口。

## UI 回归重点

- 文本是否溢出或遮挡。
- 移动端固定区域是否盖住内容。
- 图标按钮是否有明确含义和触控面积。
- 新入口是否破坏既有导航路径。`
          }
        ]
      },
      {
        id: 'skill-docs',
        name: '文档写作',
        category: '知识沉淀',
        level: '熟练',
        desc: '整理方案、验收记录、复盘与发布说明',
        icon: 'files',
        tone: 'green',
        version: '1.2.7',
        packageName: 'docs-writer.skill.zip',
        size: '41 KB',
        updatedAt: '2026-06-02',
        location: '~/.codex/skills/docs-writer',
        author: 'AgentHub Team',
        status: '已启用',
        source: '本地',
        agentIds: ['ds', 'pm-agent'],
        triggers: ['写 PRD', '发布说明', 'QA 记录', '交接文档'],
        files: ['SKILL.md', 'templates/release-note.md', 'templates/qa-record.md'],
        documents: [
          {
            id: 'doc-format',
            title: '文档格式',
            type: 'Markdown',
            updatedAt: '2026-06-02',
            summary: '约束文档的层级、语气和可复测信息。',
            markdown: `# 文档写作 Skill

文档需要让下一个接手的人快速判断现状、路径和风险。

## 推荐结构

- 背景：为什么做。
- 范围：做什么，不做什么。
- 变更：具体页面、组件、状态。
- 验证：命令、截图、视口和结论。
- 后续：明确可行动作。

## 质量标准

说明要短，信息要实。涉及 UI 验证时，必须记录视口尺寸和截图路径。`
          }
        ]
      },
      {
        id: 'skill-workflow',
        name: '多智能体编排',
        category: '协同流程',
        level: '进阶',
        desc: '串联多个智能体执行任务、记录产出和日志',
        icon: 'agents',
        tone: 'purple',
        version: '0.9.5',
        packageName: 'agent-workflow.skill.zip',
        size: '57 KB',
        updatedAt: '2026-06-01',
        location: '~/.codex/skills/agent-workflow',
        author: 'Workflow Lab',
        status: '试用',
        source: '本地',
        agentIds: ['clowder', 'logic-weaver'],
        triggers: ['多智能体', '任务编排', '协作日志', '产物追踪'],
        files: ['SKILL.md', 'references/state-machine.md', 'scripts/export-log.js'],
        documents: [
          {
            id: 'orchestration',
            title: '编排说明',
            type: 'Markdown',
            updatedAt: '2026-06-01',
            summary: '定义任务归属、产物追踪和日志审计方式。',
            markdown: `# 多智能体编排 Skill

用于把一个复杂任务拆给多个智能体，并保留每个智能体的产物、日志和状态。

## 核心概念

| 名称 | 说明 |
| --- | --- |
| Board | 一组协作任务 |
| Task | 单个智能体负责的目标 |
| Artifact | 文档、截图、代码或检查结果 |
| Log | 可审计的时间线 |

## UI 建议

- 看板展示任务状态和进度。
- 详情页展示完整日志。
- 修改入口需要带上任务标题和明确修改点。`
          }
        ]
      }
    ],
    boards: [
      {
        id: 'board-agenthub-rd',
        groupId: '2',
        groupName: 'AgentHub 产品研发群',
        summary: '围绕 IM Web UI 优化收敛验收、构建、文件预览与移动端交互。',
        memberCount: 7,
        tasks: [
          {
            id: 'task-rd-pm',
            agentId: 'pm-agent',
            status: 'review',
            progress: 82,
            task: '阶段验收与风险收敛',
            goal: '把智能体、聊天、文件预览三个模块的验收标准整理成可执行清单，保证每个阶段都有截图与 issue 记录。',
            modifyHint: '验收清单里缺少智能体看板入口与日志查看的 375px 移动端截图，请补充截图路径和复测结论。',
            documents: [
              { id: 'doc-rd-acceptance', name: 'AgentHub交互验收清单.md', type: 'md', summary: '主流程、移动端、截图与 issue 闭环清单' },
              { id: 'doc-rd-risk', name: 'UI风险复盘.md', type: 'md', summary: '记录未关闭设计确认项与复测重点' }
            ],
            logs: [
              { time: '09:20', title: '拆分验收项', detail: '将聊天、通讯录、智能体与文件预览拆成 4 组检查点，标注需要截图的断点。' },
              { time: '10:45', title: '同步 issue 记录', detail: '把移动端输入区和文件预览修复归档到 2026-06-06 follow-up。' },
              { time: '13:10', title: '等待补充', detail: '看板页与日志页完成后需要追加 5 秒识别记录。' }
            ]
          },
          {
            id: 'task-rd-codex',
            agentId: 'codex',
            status: 'doing',
            progress: 68,
            task: '看板页面与 at 修改入口实现',
            goal: '完成按群聊分组的智能体任务看板，点击 at 按钮可以直接进入对应群聊并写入修改说明。',
            modifyHint: 'at 修改文案需要点明具体卡片和目标，不要只写“请修改”，请在草稿中带上任务标题与修改位置。',
            documents: [
              { id: 'doc-rd-board-spec', name: '智能体看板交互说明.md', type: 'md', summary: '群聊看板、任务卡、Console 日志页、at 修改入口说明' },
              { id: 'doc-rd-board-check', name: '看板视觉QA记录.png', type: 'png', summary: '移动端与桌面端看板截图' }
            ],
            logs: [
              { time: '11:05', title: '建立看板数据结构', detail: '在 agent store 内补充 boards 数据，任务绑定 groupId 与 agentId。' },
              { time: '11:40', title: '实现草稿注入', detail: '点击 @他修改后写入群聊 draft，并跳到对应 chat/detail 页面。' },
              { time: '12:05', title: '移动端复测', detail: '确认任务卡按钮 44px，点击任务卡进入独立 Console 日志页。' }
            ]
          },
          {
            id: 'task-rd-claude',
            agentId: 'claude-code',
            status: 'blocked',
            progress: 44,
            task: '回归风险审查',
            goal: '审查看板页与配置页是否影响智能体列表、聊天右上角、群聊输入框草稿恢复等既有路径。',
            modifyHint: '请补充对 pages/agents/log.vue 的 Console 日志页路径审查，并指出可能的移动端滚动冲突。',
            documents: [
              { id: 'doc-rd-review', name: '智能体看板回归审查.md', type: 'md', summary: '记录新增页面对聊天、配置、store 的影响' }
            ],
            logs: [
              { time: '14:00', title: '初审完成', detail: '确认新增入口不会覆盖原本创建智能体按钮。' },
              { time: '14:35', title: '发现待查项', detail: '需要确认 Console 日志页在 375px 下不会横向溢出。' }
            ]
          }
        ]
      },
      {
        id: 'board-agent-review',
        groupId: 'agent-review',
        groupName: '智能体方案评审群',
        summary: '聚焦多智能体协作产物质量，跟踪方案、代码、文档和复盘日志。',
        memberCount: 5,
        tasks: [
          {
            id: 'task-review-codex',
            agentId: 'codex',
            status: 'done',
            progress: 100,
            task: '配置页复用方案实现',
            goal: '复用新建智能体页面作为配置页，保证卡片入口和对话入口都能查看并修改同一份配置。',
            modifyHint: '配置页已完成，请补充保存后返回群聊时的 toast 文案验证。',
            documents: [
              { id: 'doc-review-config', name: '智能体配置页复用说明.md', type: 'md', summary: '记录 id 参数、表单回填、保存逻辑与会话同步' }
            ],
            logs: [
              { time: '昨天 16:30', title: '完成编辑模式', detail: '新增 pageTitle、submitText、hydrateFormFromAgent 与 updateAgent。' },
              { time: '昨天 17:10', title: '完成聊天入口', detail: '机器人会话右上角改为进入配置页，DeepSeek 会话按名称兜底映射。' }
            ]
          },
          {
            id: 'task-review-logic',
            agentId: 'logic-weaver',
            status: 'doing',
            progress: 57,
            task: '多群聊任务归属梳理',
            goal: '说明同一个智能体在多个群聊中出现时，任务、目标、产物和日志如何互不串线。',
            modifyHint: '请把“同一智能体跨群聊出现”的说明补充到文档第一段，并举 Codex 的两个群聊任务作为例子。',
            documents: [
              { id: 'doc-review-ownership', name: '跨群聊智能体任务归属.md', type: 'md', summary: '解释 groupId + taskId 的归属模型' },
              { id: 'doc-review-map', name: '智能体任务映射表.xlsx', type: 'xlsx', summary: '按群聊列出智能体、目标、状态与产物' }
            ],
            logs: [
              { time: '10:15', title: '归属模型确认', detail: '任务以 groupId + taskId 定位，agentId 只表示执行者。' },
              { time: '10:52', title: '产物映射补充', detail: '每个任务独立挂 documents，避免跨群聊产物混淆。' }
            ]
          },
          {
            id: 'task-review-clowder',
            agentId: 'clowder',
            status: 'doing',
            progress: 73,
            task: '协同日志聚合',
            goal: '把各智能体在群聊中的过程日志聚合成可审查时间线，方便定位任务变更与文档来源。',
            modifyHint: '日志需要补充“文档产出后谁复核”的信息，请在最后一条日志后追加复核人。',
            documents: [
              { id: 'doc-review-log', name: '多智能体协同日志.md', type: 'md', summary: '聚合每个智能体的关键动作和产物变更' }
            ],
            logs: [
              { time: '09:00', title: '收集任务日志', detail: '汇总 Codex、PM 智能体、逻辑编织者在两个群聊中的任务动作。' },
              { time: '09:48', title: '生成审查摘要', detail: '将日志按智能体、任务、文档三条线索聚合。' },
              { time: '11:25', title: '等待复核', detail: '需要补充每份产物的复核人和复核时间。' }
            ]
          }
        ]
      }
    ],
    drafts: []
  }),
  actions: {
    clearStaticCatalog() {
      this.agents = this.agents.filter((agent) => {
        if (agent.source === 'clowder') return false;
        if (STATIC_AGENT_IDS.has(agent.id)) return false;
        return agent.source === 'user';
      });
      this.userSkills = [];
      this.localSkills = [];
    },
    applyNativeAgents(agents = []) {
      if (!Array.isArray(agents) || agents.length === 0) return [];
      const backendIds = new Set(agents.map((agent) => agent.id).filter(Boolean));
      const retainedLocalAgents = this.agents.filter((agent) => {
        if (agent.source === 'clowder') return false;
        if (STATIC_AGENT_IDS.has(agent.id)) return false;
        return agent.source === 'user' && !backendIds.has(agent.id);
      });
      this.agents = [...agents, ...retainedLocalAgents];
      return this.agents;
    },
    applyNativeSkills(skillCatalog = {}) {
      const skills = normalizeSkillCatalog(skillCatalog, this.agents);
      this.userSkills = skills;
      this.localSkills = skills.map((skill) => ({
        ...skill,
        version: '',
        packageName: '',
        size: '',
        updatedAt: '',
        location: 'backend',
        author: 'Clowder',
        status: skill.level,
        source: '后端',
        triggers: [],
        files: [],
        documents: []
      }));
      return skills;
    },
    applyProjectBoard(board) {
      if (!board?.groupId) return null;
      const idx = this.boards.findIndex((item) => item.id === board.id || item.groupId === board.groupId);
      if (idx >= 0) this.boards[idx] = { ...this.boards[idx], ...board };
      else this.boards.unshift(board);
      return board;
    },
    async syncProjectBoardForGroup(groupId, options = {}) {
      const id = String(groupId || '').trim();
      if (!id) return null;
      try {
        const binding = await nativeImService.fetchActiveProjectGroup({
          projectGroupNo: id,
          projectGroupId: id
        });
        if (!binding?.projectGroupNo && !binding?.project_group_no && !binding?.projectGroupId && !binding?.project_group_id) {
          return null;
        }
        const threadId = binding.projectThreadId || binding.project_thread_id || binding.threadId || binding.thread_id;
        let tasks = [];
        if (threadId) {
          try {
            tasks = await nativeImService.fetchThreadTasks(threadId);
          } catch (error) {
            tasks = [];
            this.nativeError = agentErrorText(error);
          }
        }
        const board = normalizeClowderProjectBoard({
          binding,
          tasks,
          agents: this.agents
        });
        return this.applyProjectBoard(board);
      } catch (error) {
        if (!options.silent) this.nativeError = agentErrorText(error);
        if (!options.silent) throw error;
        return null;
      }
    },
    async fetchNativeAgents(options = {}) {
      if (!options.silent) this.syncState = 'syncing';
      if (options.clearStatic !== false) this.clearStaticCatalog();
      this.nativeError = '';
      try {
        const directory = await nativeImService.fetchClowderCatDirectory({
          query: options.query,
          includeUnavailable: true,
          preferDirect: options.preferDirect !== false
        });
        this.applyNativeAgents(directory.agents || []);
        this.applyNativeSkills(directory.skillCatalog || {});
        this.syncState = 'success';
        return directory;
      } catch (error) {
        this.syncState = 'failed';
        this.nativeError = agentErrorText(error);
        if (!options.silent) throw error;
        return { agents: [] };
      }
    },
    async loadLocalOAuthCapabilities(options = {}) {
      if (this.localOAuthInflight && !options.force) return this.localOAuthInflight;
      if (this.localOAuthLoaded && !options.force) return this.localOAuthCapabilities;
      const loader = createLocalOAuthCapabilityLoader(() => nativeImService.getLocalAuthCapabilities());
      this.localOAuthLoading = true;
      this.localOAuthError = '';
      this.localOAuthInflight = loader.load({ force: true })
        .then((capabilities) => {
          this.localOAuthCapabilities = capabilities;
          this.localOAuthLoaded = true;
          this.localOAuthError = '';
          return capabilities;
        })
        .catch((error) => {
          this.localOAuthCapabilities = {};
          this.localOAuthLoaded = false;
          this.localOAuthError = agentErrorText(error);
          throw error;
        })
        .finally(() => {
          this.localOAuthLoading = false;
          this.localOAuthInflight = null;
        });
      return this.localOAuthInflight;
    },
    resetLocalOAuth() {
      this.localOAuthCapabilities = {};
      this.localOAuthLoading = false;
      this.localOAuthError = '';
      this.localOAuthLoaded = false;
      this.localOAuthInflight = null;
    },
    async createAgent(agent) {
      try {
        if (agent?.accessMode === 'oauth') {
          const capabilities = this.localOAuthLoaded
            ? this.localOAuthCapabilities
            : await this.loadLocalOAuthCapabilities();
          const provider = oauthProviderForPlatform(agent.platform);
          if (capabilities?.[provider]?.authConfigured !== true) {
            throw {
              msg: provider === 'claude' ? '未检测到 Claude Code 本机登录' : '未检测到 Codex 本机登录',
              preventLocalFallback: true
            };
          }
        }
        const created = await nativeImService.createClowderCat({
          ...agent,
          roleTemplateId: agent.roleTemplate || agent.templateId,
          defaultModel: agent.model || agent.customModel,
          personality: agent.systemPrompt || agent.desc,
          capabilities: agent.capabilityTags || agent.capabilities || []
        });
        const next = {
          ...agent,
          ...created,
          id: created.id,
          alias: created.alias || agent.alias,
          desc: created.desc || agent.desc,
          isAgent: true,
          source: 'clowder',
          connected: created.connected !== false,
          status: created.status || 'active',
          creator: 'User',
          apiKey: ''
        };
        const existingIndex = this.agents.findIndex((item) => item.id === next.id);
        if (existingIndex >= 0) this.agents[existingIndex] = next;
        else this.agents.push(next);
        return next.id;
      } catch (error) {
        this.nativeError = agentErrorText(error);
        if (agent?.accessMode === 'oauth' || error?.preventLocalFallback) {
          throw error;
        }
        const id = 'agent-' + Date.now().toString();
        this.agents.push({
          ...agent,
          id,
          isAgent: true,
          source: 'user',
          connected: false,
          status: 'inactive',
          creator: 'User',
          runtimeError: this.nativeError
        });
        throw error;
      }
    },
    async deleteAgent(id, options = {}) {
      const agent = this.agents.find((item) => item.id === id || item.catId === id || item.directCatId === id);
      if (!agent) throw { msg: '未找到智能体' };
      if (agent.creator === 'System' || agent.source === 'official' || agent.raw?.source === 'role-template') {
        throw { msg: '系统智能体不能删除' };
      }
      const identity = resolveAgentDeleteIdentity(agent);
      if (!identity.catId) throw { msg: '无法识别智能体 catId' };
      try {
        const remote = await nativeImService.deleteClowderCat(identity.catId);
        this.agents = this.agents.filter((item) => !isAgentMatch(item, identity));

        let cleanup = null;
        const { useConversationStore } = await import('@/stores/conversation');
        const convStore = useConversationStore();
        cleanup = convStore.cleanupAgentReferences(agent, options);

        if (options.deleteDirectMessages) {
          const { useMessageStore } = await import('@/stores/message');
          const messageStore = useMessageStore();
          identity.directConversationIds.forEach((conversationId) => {
            messageStore.clearConversationMessages(conversationId);
          });
        }
        return {
          remote,
          identity,
          cleanup
        };
      } catch (error) {
        this.nativeError = agentErrorText(error);
        throw error;
      }
    },
    updateAgent(id, patch) {
      const idx = this.agents.findIndex(agent => agent.id === id);
      if (idx === -1) return null;
      this.agents[idx] = {
        ...this.agents[idx],
        ...patch,
        id,
        creator: this.agents[idx].creator
      };
      return this.agents[idx];
    },
    saveDraft(agent) {
      const draft = {
        ...agent,
        id: 'draft-' + Date.now().toString(),
        savedAt: Date.now()
      };
      this.drafts.push(draft);
      return draft.id;
    },
    removeDraft(id) {
      const idx = this.drafts.findIndex(d => d.id === id);
      if (idx > -1) this.drafts.splice(idx, 1);
    }
  }
});
