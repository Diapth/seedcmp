# 010 - Backend Role Template and Skill Management API Gap

**状态**：Open
**创建时间**：2026-06-08
**标签**：feature / backend / clowder / skills / role-template
**优先级**：P1

---

## 问题描述

AgentHub / Clowder UI 已经把“创建猫猫”和“技能库”入口露给用户，但后端目前只支持读取已有角色模板和已有 Skill，缺少用户可通过前端完成的写入能力。

实际现状：

| 能力 | 当前实现 | 用户能否前端操作 |
|---|---|---|
| 编辑 `.cat-cafe/cat-catalog.json` 创建角色模板 | 需要开发者手动改服务器文件，并重启 Clowder API | 否 |
| 前端创建 Agent / 猫猫 | `/chat/clowder-cats` / AgentHub 创建页可调用后端创建猫 | 是 |
| 创建 Skill | 需要开发者写文件，放到 `packages/api/skills/` 或 `cat-cafe-skills/`，并重启或重新同步服务 | 否 |
| 使用已有 Skill | Agent 通过已加载的 MCP / Skill catalog 间接使用 | 是 |

用户看到的是一个“可配置智能体平台”，但角色模板和 Skill 的新增仍停留在开发者部署流程。需要后端补齐角色模板管理与 Skill 上传 / 安装 / 重新扫描能力，适配前端已经预留的接口和页面。

---

## 复现步骤

1. 打开 AgentHub / Clowder 的创建猫猫页面。
2. 在角色模板下拉框里只能选择后端返回的已有模板。
3. 尝试新增、编辑或上传角色模板，当前没有后端可调用的写入能力。
4. 打开技能库页面，前端已有上传入口 / API adapter 预留，但后端没有 `clowder/skills` 写入适配。
5. 想新增 Skill 时，只能让开发者把文件放入服务器目录并重启 / 同步服务。

---

## 相关代码

```text
sections/clowder-ai/packages/api/src/config/cat-catalog-store.ts
  .cat-cafe/cat-catalog.json 是服务器文件系统 JSON；
  后端通过 readFileSync / writeFileSync / atomic rename 读写。

sections/clowder-ai/packages/api/src/routes/cats.ts
  GET /api/cat-templates 只返回 template.roleTemplates、clientDefaults、skillCatalog。
  POST /api/cats 可以创建猫猫，但没有角色模板 CRUD。

sections/clowder-ai/packages/api/src/routes/skills.ts
  GET /api/skills 返回共享 Skills 看板数据。
  POST /api/skills/sync 只做 managed symlink re-sync。
  POST /api/skills/resolve-conflict 只处理冲突选择。
  没有上传 Skill 包、校验 manifest、安装到技能目录、触发 catalog reload 的接口。

sections/agenthub_ui/api/clowder.js
  clowderApi.uploadSkill(data) -> POST clowder/skills

sections/agenthub_ui/stores/settings.js
  settingsStore.uploadSkill(payload) 已经按真实后端接口形式封装成功 / 不可用状态。

sections/agenthub_ui/pages/agents/new.vue
  roleTemplates 来自 agentStore.roleTemplates，只能 picker 选择已有模板。

sections/agenthub_ui/pages/agents/skills.vue
  技能库页面已有上传区域，但真实上传接入前显示不可用。
```

---

## 根因分析

当前缺的是后端配置管理 API，而不是单纯的前端按钮：

1. 角色模板的事实源在服务器 `.cat-cafe/cat-catalog.json` 或模板配置中，写入流程没有暴露为 HTTP API。
2. `GET /api/cat-templates` 只读模板，`POST /api/cats` 只创建猫实例，不能创建 / 编辑模板本身。
3. Skill catalog 依赖启动时扫描 `cat-cafe-skills/manifest.yaml`、Skill 目录和 provider home 挂载状态，缺少从上传包到落盘、校验、同步、刷新目录的完整事务。
4. 前端已经预留 `POST clowder/skills`，但后端没有对应 Clowder adapter / route，导致上传入口只能提示“后端能力待确认”。
5. 没有热刷新或事件通知，新增模板 / Skill 后无法保证当前进程、cat registry、skill catalog 和前端缓存同步。

---

## 需求建议

### 角色模板管理 API

建议后端新增 owner-only 的角色模板管理接口，至少支持：

```http
GET    /api/cat-templates
POST   /api/cat-templates
PUT    /api/cat-templates/:templateId
DELETE /api/cat-templates/:templateId
POST   /api/cat-templates/reload
```

写入要求：

- 写入 `.cat-cafe/cat-catalog.json` 或明确的 runtime overlay，不直接修改内置模板。
- 使用现有 `cat-catalog-store.ts` 的安全路径和 atomic write 机制。
- 校验 `templateId` / `logicalKey` 唯一，避免和已有 catId、breed id、role template 冲突。
- 写入后触发 catalog subscriber / cat registry refresh，使创建猫猫页面无需重启即可读到新模板。
- 返回标准化 `RoleTemplate` 数据，字段兼容前端 `normalizeRoleTemplate()`。

建议请求体：

```ts
type UpsertRoleTemplateRequest = {
  id?: string;
  logicalKey: string;
  displayName: string;
  description?: string;
  personalitySummary?: string;
  capabilitySummary?: string;
  systemPrompt?: string;
  capabilityTags?: string[];
  cloneable?: boolean;
};
```

### Skill 上传 / 安装 API

建议后端适配前端已有的 `POST clowder/skills`，并在 Clowder API 层落到真实 Skill 管理服务。首版可以只支持 `.skill.zip` / `.zip` 上传，不做在线编辑器。

建议接口：

```http
GET    /api/skills
POST   /api/skills/import
POST   /api/skills/sync
POST   /api/skills/reload
DELETE /api/skills/:skillName
```

`POST /api/skills/import` 需要：

- owner-only 鉴权，复用 `skillsRoutes` 现有 owner 检查语义。
- 支持 multipart 或前端当前 `clowder/skills` adapter 约定的上传格式。
- 解压到临时目录，拒绝 path traversal、绝对路径、过大包和非法文件类型。
- 校验 `SKILL.md`、`manifest.yaml` / skill metadata、名称规则、重复名称和 required MCP 声明。
- 安装到受控 Skill 目录，必要时更新 manifest / catalog state。
- 调用现有 `syncSkills()` 或等价逻辑，把 Skill 挂载到 Claude / Codex / Gemini / Kimi provider home。
- 重新构建 `skillCatalog`，让 `GET /api/cats` / `GET /api/cat-templates` 返回最新 skill catalog。

建议响应体：

```ts
type SkillImportResponse = {
  ok: true;
  skill: {
    id: string;
    name: string;
    version?: string;
    description?: string;
    triggers: string[];
    files: string[];
    location: string;
    status: 'enabled' | 'needs_sync' | 'invalid';
  };
  sync: {
    claude: boolean;
    codex: boolean;
    gemini: boolean;
    kimi: boolean;
  };
  warnings: string[];
};
```

### Clowder / AgentHub Adapter

- `sections/agenthub_ui/api/clowder.js` 现在调用 `POST clowder/skills`；后端需要在 TangSeng / Clowder adapter 层把该路径映射到真实 `/api/skills/import` 或同等能力。
- 角色模板写入也需要暴露给 AgentHub UI，建议接口返回字段直接兼容 `agentStore.applyDirectoryMetadata()`。
- 写入成功后，前端下一次 `getCatDirectory({ includeUnavailable: true })` 应能拿到最新 `templates` 和 `skillCatalog`。

---

## 非目标

- 首版不要求前端提供完整 Skill 在线 IDE。
- 首版不要求普通用户修改系统内置 `cat-template.json`。
- 首版不允许上传包执行任意安装脚本。
- 首版不把 Skill 创建等同于 agent 自动启用；安装、挂载、可调用状态需要明确返回。

---

## 验收标准

1. 用户可以通过后端 API 新增角色模板，刷新创建猫猫页面后无需重启即可在角色模板下拉框看到新模板。
2. 用户可以编辑 / 删除自己创建的角色模板；删除被已有猫猫引用的模板时，后端返回明确错误或降级策略。
3. 前端调用 `POST clowder/skills` 上传 `.skill.zip` 后，后端完成解包、校验、安装、同步和 catalog refresh。
4. 上传成功的 Skill 会出现在技能库列表和 `skillCatalog` 中，并带有触发词、文件清单、文档摘要、挂载状态。
5. 非 owner 用户调用模板写入或 Skill 上传接口会被 401 / 403 拒绝。
6. 恶意 zip path traversal、重复 skillName、缺失 `SKILL.md`、非法 manifest、超大包都有明确 4xx 错误和前端可展示 message。
7. 新增模板后创建猫猫时，`roleTemplateId` 可以正确传入 `POST /api/cats` 并创建可用 cat。
8. 新增 Skill 后触发 agent invocation 时，相关 provider 能看到已同步的 Skill；不需要重启 Clowder API。
9. 单元测试覆盖 catalog write、template validation、skill zip validation、import rollback、reload/sync；H5 smoke 覆盖上传成功和失败主路径。

---

## 问题列表（Q&A 迭代）

### Q1: 角色模板应该写到 `cat-template.json` 还是 `.cat-cafe/cat-catalog.json`？

**A1**: 建议写入 runtime/project overlay，即 `.cat-cafe/cat-catalog.json` 或等价用户配置层。内置 `cat-template.json` 应保持产品默认模板，不作为用户前端编辑目标。

### Q2: Skill 上传后是否必须重启服务？

**A2**: 不应该。验收目标是上传后触发重新扫描 / 同步 / catalog refresh，让当前进程能立即返回最新 Skill 状态。

### Q3: 首版是否支持在前端编辑 Skill 源码？

**A3**: 不建议。首版只做打包上传、校验、安装、同步和展示；源码编辑器、版本管理、回滚历史可以作为后续独立需求。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm lint && pnpm test:unit` | Pending |
| Backend Unit | cat template CRUD + skill import validation | Pending |
| Backend Integration | import -> sync -> GET skillCatalog refresh | Pending |
| Layer 5 E2E | H5 新增模板 -> 创建猫；上传 Skill -> 技能库出现 | Pending |

---

## 修复记录

暂无。此 issue 用于追踪后端适配工作。

---

## 测试结果

```bash
# Not run: issue proposal only.
```

---

## 关闭备注

待后端实现、前端联调和无重启热刷新验证后补充 PR、测试证据与截图。
