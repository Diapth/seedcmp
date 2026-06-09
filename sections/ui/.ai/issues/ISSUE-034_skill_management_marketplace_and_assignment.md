# [ISSUE-034] Skill 管理、市场与用户级分配

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：feature / clowder / skill / marketplace / agent / backend / im-web-parity
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-034_skill_management_marketplace_and_assignment.md
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- 若 `AI修复模式：Plan First`，先使用 `writing-plans` 写计划，计划无需用户确认直接实现。
- 若涉及前端页面、截图或交互验收，必须使用 `browser-preview` 或 Playwright 实测。
- 测试截图必须保存到 `seedcmp/sections/ui/.ai/tests-e2e/` 下，并按 issue 序号命名。
- 若涉及后端表结构、上传、删除、用户隔离，必须先补接口/权限/幂等测试，再改实现。
- 若遇到测试失败或行为不符合预期，使用 `debugging` / `systematic-debugging` 定位根因。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

`sections/ui` 当前已经有智能体首页的"我的技能"横条和 `pages/agents/skills.vue` 技能库页面，但这套能力仍是 UI-only / catalog-only：

1. 智能体首页直接展示 `agentStore.userSkills`，没有区分"用户已添加"、"市场可添加"、"分配给哪些智能体"。
2. `pages/agents/skills.vue` 上传、启用、绑定智能体按钮只 `showUiToast`，没有真实上传、编辑、删除、分配链路。
3. `agentStore.applyNativeSkills` 只是把 Clowder 返回的 `skillCatalog` 扁平化，并把所有 skill 默认挂到所有 agents 上，无法表达用户 A 和用户 B 的不同选择。
4. `sections/im` Clowder bridge 当前只透传 `skillCatalog`，没有 `/v1/clowder/skills/*` 管理接口，也没有数据库表持久化用户级 skill ownership / assignment。
5. `sections/clowder-ai` 已有 `/api/skills`、`/api/skills/sync`、`/api/skills/resolve-conflict` 和能力中心的 per-cat toggles，但这是 Clowder 本地治理/挂载视角；`sections/ui` 需要的是 IM 用户视角的"我的技能 + 市场 + 分配给智能体"，两者不能混成一层。

本 issue 目标：把 `sections/ui` 的 Skill 页面从静态展示升级为完整功能。智能体面板顶部只展示用户已有 Skill 的轻量横条；点进 Skill 管理面板后，用户可以上传、删除、编辑 Skill，能把 Skill 自由分配给自己的智能体；同时提供本地 Skill 市场，显示 Clowder 本地可用的所有 Skill，供用户添加到自己的空间。后端必须建表和接口，保证不同用户之间的 Skill 配置互不冲突。

---

## 目标体验

### 智能体面板顶部横条

1. `pages/agents/index.vue` 顶部只展示当前登录用户已添加的 Skill，最多展示一行横向滚动卡片。
2. 卡片只呈现 Skill 名称、分类、已分配智能体数量、启用状态，不展示完整文档和文件清单。
3. 点击任意 Skill 或"管理"入口进入 `pages/agents/skills.vue`，并定位到该 Skill。
4. 如果用户没有添加任何 Skill，顶部不铺大空态，只保留"技能管理"轻入口。

### Skill 管理面板

1. 管理页分为两个主视图：
   - `我的 Skill`：当前用户已添加/上传/启用的 Skill。
   - `Skill 市场`：Clowder 本地发现到的所有 Skill，包括 `cat-cafe-skills`、provider home/project mounts、后续上传到本地仓库的 Skill。
2. 用户可以从市场添加 Skill 到自己的空间；添加后不会影响其他用户。
3. 用户可以上传 `.skill.zip` / `.zip`，后端解析 `SKILL.md` 和 metadata，安全校验通过后写入本地 Skill 仓库，并默认归属当前用户。
4. 用户可以编辑自己拥有的 Skill 元数据和正文内容：
   - 名称/描述/分类/触发词/启用状态。
   - `SKILL.md` 正文或至少 Markdown 文档内容。
   - 文件清单只允许在安全白名单范围内编辑/替换，不能越权写任意路径。
5. 用户可以删除自己拥有的 Skill：
   - 删除"我的添加关系"不删除市场源。
   - 删除自己上传的私有 Skill 时，需要二次确认；若无其他用户引用，可物理删除或标记删除。
6. 用户可以把 Skill 分配给自己的智能体：
   - 全局启用/禁用。
   - 按智能体启用/禁用。
   - 只显示当前用户可见/已连接的智能体，不能分配给其他用户的智能体。
7. Skill 详情页展示文档预览、源码/文件清单、MCP 依赖、挂载状态、使用该 Skill 的智能体。

### Skill 市场

1. 市场显示本机 Clowder 发现到的所有 Skill，而不是只显示当前用户已拥有的 Skill。
2. 市场 Skill 可以标出来源：
   - `official`：`sections/clowder-ai/cat-cafe-skills`。
   - `project`：项目级 `.claude/.codex/.gemini/.kimi/skills`。
   - `user_home`：用户级 provider skills。
   - `uploaded`：通过 UI 上传进入本地仓库。
3. 市场需要显示冲突/挂载/依赖状态，但不要求用户理解 symlink 细节。
4. 如果某 Skill 与用户已有 Skill 同名但内容不同，市场页显示冲突并要求用户选择"添加为副本"或"替换我的版本"，不能静默覆盖。

---

## 复现步骤

1. 启动 `sections/ui` 并登录用户 A。
2. 进入智能体首页，观察"我的技能"横条。
3. 进入 `pages/agents/skills.vue`。
4. 点击"上传技能包"、"启用"、"绑定智能体"、"导入到本地"。
5. 切换用户 B，再次查看技能横条和技能库。

实际：

1. `pages/agents/skills.vue` 的上传和操作按钮只是 toast。
2. `agentStore.localSkills` 有大量静态示例数据，不来自真实后端。
3. Clowder `skillCatalog` 同步后被默认分配给所有 agents。
4. 用户 A / 用户 B 没有隔离的 skill ownership 和 assignment。
5. 市场和我的 Skill 没有清晰分层。

预期：

1. 顶部横条只展示当前用户已添加的 Skill。
2. 管理页能真实上传、删除、编辑、启用和分配 Skill。
3. 市场能显示本地所有可用 Skill，并允许当前用户添加。
4. 用户 A 的添加、删除、启用、分配不会影响用户 B。
5. 后端表结构、接口和 Clowder 本地 skill/governance 数据有明确对照关系。

---

## 相关代码

```text
sections/ui/pages/agents/index.vue
- 当前顶部"我的技能"直接读 agentStore.userSkills。
- 需要改成只展示 current user 已添加的轻量列表。

sections/ui/pages/agents/skills.vue
- 当前是完整的技能库 UI，但上传、启用、绑定智能体等操作仍是 showUiToast。
- 需要拆出"我的 Skill / 市场"视图和真实 action。

sections/ui/stores/agent.js
- userSkills / localSkills 当前有静态示例数据。
- normalizeSkillCatalog 把 Clowder skillCatalog 默认挂到所有 agents，不能表达用户级分配。
- applyNativeSkills 只适合 catalog preview，不适合 ownership / assignment。

sections/ui/services/native-im/service.js
- fetchClowderCatDirectory 当前从 /v1/clowder/cats 获取 agents/templates/clientDefaults/skillCatalog。
- 需要新增 skill 管理 service wrapper。

sections/im/TangSengDaoDaoServer/modules/clowder/api.go
- CatDirectoryResponse 已有 skillCatalog map[string][]ClowderSkill。
- Route 当前没有 /v1/clowder/skills/* 管理接口。
- createdCatContacts / projectGroupBindings 仍以内存 map 为主，Skill 管理必须落 SQL 表，不能只放内存。

sections/clowder-ai/packages/api/src/routes/skills.ts
- 已有 GET /api/skills、POST /api/skills/sync、POST /api/skills/resolve-conflict。
- 这些接口提供本地 governance / mount / conflict 视图，不包含 IM 用户级 ownership。

sections/clowder-ai/packages/api/src/utils/skill-catalog.ts
- buildProviderSkillCatalog(projectRoot) 可作为市场列表和 provider 挂载状态的参考。

sections/clowder-ai/packages/shared/src/types/capability.ts
- CapabilityEntry / CapabilityPatchRequest 已支持 type: 'skill'、global/cat toggles。
- 可参考 per-cat override，但 UI 用户级分配不能直接写入共享 capabilities.json，否则不同 IM 用户会互相影响。

sections/clowder-ai/packages/web/src/components/settings/SkillsContent.tsx
sections/clowder-ai/packages/web/src/components/settings/useSkillControls.ts
- Clowder Web 里的 Skill 管理和 per-cat toggles 参考实现。
```

---

## 根因分析

`sections/ui` 当前把三个不同概念混在了一个前端数组里：

1. **市场目录**：本机有哪些 Skill 可用，来自 Clowder `cat-cafe-skills`、provider mount、上传仓库。
2. **用户拥有关系**：当前 IM 用户把哪些 Skill 添加到自己的空间。
3. **智能体分配关系**：当前 IM 用户允许哪些智能体使用哪些 Skill。

Clowder 现有 `/api/skills` 更接近"本机治理/挂载健康"视角，负责判断 Skill 是否同步到 `.claude/.codex/.gemini/.kimi/skills`、是否有 conflict、是否 stale。它不是多 IM 用户产品层的 ownership store。`sections/ui` 如果直接把 `/api/skills` 当用户配置写入，会导致所有登录用户共享同一套开关，无法满足"每个用户之间的 skill 不冲突"。

因此需要在 `sections/im` Clowder bridge 增加一层 IM 用户级数据库模型：市场可读 Clowder，本人配置落 SQL；运行时再把"Clowder 本地可用 + 当前用户授权 + 当前智能体分配"合成为前端和调用路由可用的 Skill 集合。

---

## 建议数据表结构

### 1. `clowder_skill_source`

市场目录表，记录本地发现或上传的 Skill 源。官方 / project / user_home 可通过定时扫描或接口刷新 upsert；用户上传也写入这里。

```sql
CREATE TABLE `clowder_skill_source` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `skill_id` VARCHAR(128) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `display_name` VARCHAR(128) NOT NULL DEFAULT '',
  `description` TEXT,
  `category` VARCHAR(128) NOT NULL DEFAULT '',
  `triggers_json` JSON,
  `requires_mcp_json` JSON,
  `source_type` VARCHAR(32) NOT NULL, -- official / project / user_home / uploaded
  `source_owner_uid` VARCHAR(40) NOT NULL DEFAULT '',
  `provider` VARCHAR(32) NOT NULL DEFAULT '', -- claude / codex / gemini / kimi / all
  `source_path` VARCHAR(1024) NOT NULL DEFAULT '',
  `content_hash` VARCHAR(128) NOT NULL DEFAULT '',
  `version` VARCHAR(64) NOT NULL DEFAULT '',
  `mount_status_json` JSON,
  `conflict_status` VARCHAR(32) NOT NULL DEFAULT 'none',
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_skill_source` (`skill_id`, `source_type`, `source_owner_uid`, `content_hash`),
  KEY `idx_skill_source_status` (`status`),
  KEY `idx_skill_source_owner` (`source_owner_uid`)
);
```

建议：

1. `skill_id` 使用安全 slug，例如 `writing-plans`，不要直接用文件路径。
2. `content_hash` 用于识别同名不同内容冲突。
3. official/project/user_home 记录可以不复制正文，只记录 `source_path` 和 hash；上传 Skill 的文件落到受控目录，例如 `data/clowder/skills/{uid}/{skill_id}/{hash}`。

### 2. `clowder_user_skill`

用户拥有/添加关系。用户从市场添加 Skill 或上传私有 Skill 后写入本表。

```sql
CREATE TABLE `clowder_user_skill` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` VARCHAR(40) NOT NULL,
  `skill_source_id` BIGINT UNSIGNED NOT NULL,
  `alias` VARCHAR(128) NOT NULL DEFAULT '',
  `display_name` VARCHAR(128) NOT NULL DEFAULT '',
  `description_override` TEXT,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `visibility` VARCHAR(32) NOT NULL DEFAULT 'private', -- private / shared_later
  `add_source` VARCHAR(32) NOT NULL DEFAULT 'market', -- market / upload / clone
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_skill` (`uid`, `skill_source_id`),
  KEY `idx_user_skill_uid` (`uid`, `status`),
  KEY `idx_user_skill_source` (`skill_source_id`)
);
```

隔离原则：

1. 所有"我的 Skill"查询都必须带 `uid = ctx.GetLoginUID()`。
2. 删除市场添加的 Skill 默认只软删 `clowder_user_skill`，不删除 `clowder_skill_source`。
3. 删除用户上传的私有源时，只有 `source_owner_uid = uid` 且没有其他 active user_skill 引用，才允许物理删除文件。

### 3. `clowder_user_skill_assignment`

用户把 Skill 分配给智能体的关系。它是当前用户维度的 per-agent override，不直接写 Clowder 共享 `capabilities.json`。

```sql
CREATE TABLE `clowder_user_skill_assignment` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` VARCHAR(40) NOT NULL,
  `user_skill_id` BIGINT UNSIGNED NOT NULL,
  `cat_id` VARCHAR(128) NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `scope` VARCHAR(32) NOT NULL DEFAULT 'cat', -- cat / all_owned_agents
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_skill_cat` (`uid`, `user_skill_id`, `cat_id`),
  KEY `idx_assignment_uid_cat` (`uid`, `cat_id`, `enabled`)
);
```

约束：

1. `cat_id` 必须属于当前用户可见/已连接智能体，或是官方系统 cat 且当前用户已 connect。
2. 对同一个 `uid + user_skill_id + cat_id` 做 upsert，避免重复分配。
3. 当前用户禁用 `clowder_user_skill.enabled = 0` 时，所有 assignment 运行时都视为 disabled。

### 4. `clowder_skill_file`

可选，但建议 P0 就建。用于上传/编辑后的文件索引、预览、审计和删除引用。

```sql
CREATE TABLE `clowder_skill_file` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `skill_source_id` BIGINT UNSIGNED NOT NULL,
  `relative_path` VARCHAR(512) NOT NULL,
  `mime_type` VARCHAR(128) NOT NULL DEFAULT '',
  `size_bytes` BIGINT NOT NULL DEFAULT 0,
  `sha256` VARCHAR(128) NOT NULL DEFAULT '',
  `editable` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_skill_file` (`skill_source_id`, `relative_path`)
);
```

上传安全：

1. 解压前检查总大小、文件数、单文件大小。
2. 禁止绝对路径、`..`、symlink、hardlink、可执行二进制落入 provider 配置目录。
3. 必须包含顶层 `SKILL.md`。
4. 解析 frontmatter / manifest 失败时返回明确错误，不写半成品记录。

### 5. `clowder_skill_audit_log`

记录上传、添加、编辑、删除、分配变更，便于排查用户之间"谁改了我的 Skill"的问题。

```sql
CREATE TABLE `clowder_skill_audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` VARCHAR(40) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `skill_source_id` BIGINT UNSIGNED DEFAULT NULL,
  `user_skill_id` BIGINT UNSIGNED DEFAULT NULL,
  `cat_id` VARCHAR(128) NOT NULL DEFAULT '',
  `before_json` JSON,
  `after_json` JSON,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_skill_audit_uid` (`uid`, `created_at`),
  KEY `idx_skill_audit_skill` (`skill_source_id`, `created_at`)
);
```

---

## 建议接口契约

### `GET /v1/clowder/skills/summary`

智能体首页顶部横条用。只返回当前用户已添加 Skill 的轻量列表。

Query:

```text
limit=12
```

Response:

```json
{
  "skills": [
    {
      "userSkillId": "101",
      "skillId": "writing-plans",
      "name": "writing-plans",
      "displayName": "实施计划",
      "category": "开发流程",
      "enabled": true,
      "assignedAgentCount": 2,
      "status": "active"
    }
  ]
}
```

### `GET /v1/clowder/skills`

管理页"我的 Skill"列表。

Query:

```text
q=&status=active&assignedCatId=codex
```

Response:

```json
{
  "skills": [
    {
      "userSkillId": "101",
      "skillSourceId": "31",
      "skillId": "writing-plans",
      "name": "writing-plans",
      "displayName": "实施计划",
      "description": "...",
      "category": "开发流程",
      "triggers": ["plan", "implementation"],
      "requiresMcp": [{ "id": "cat-cafe", "status": "ready" }],
      "sourceType": "official",
      "enabled": true,
      "assignedCatIds": ["codex", "claude-code"],
      "files": [{ "path": "SKILL.md", "editable": true, "sizeBytes": 1234 }]
    }
  ]
}
```

### `GET /v1/clowder/skills/market`

市场列表。后端从 `clowder_skill_source` 读取，并可按需同步 Clowder `/api/skills` 或 `buildProviderSkillCatalog` 结果。

Response:

```json
{
  "skills": [
    {
      "skillSourceId": "31",
      "skillId": "writing-plans",
      "name": "writing-plans",
      "description": "...",
      "category": "开发流程",
      "sourceType": "official",
      "added": true,
      "ownedUserSkillId": "101",
      "mounts": { "claude": true, "codex": true, "gemini": true, "kimi": false },
      "conflictStatus": "none",
      "requiresMcp": []
    }
  ],
  "summary": {
    "total": 42,
    "added": 5,
    "conflicts": 1
  }
}
```

### `POST /v1/clowder/skills/market/:skillSourceId/add`

从市场添加到当前用户空间。

Request:

```json
{
  "displayName": "可选别名",
  "assignedCatIds": ["codex"]
}
```

Response:

```json
{
  "userSkillId": "101",
  "skillSourceId": "31",
  "added": true
}
```

幂等：同一 `uid + skillSourceId` 已存在 active 记录时返回已有记录，不重复创建。

### `POST /v1/clowder/skills/upload`

上传 Skill 包。

Form-data:

```text
file=.skill.zip
visibility=private
assignedCatIds[]=codex
```

Response:

```json
{
  "skillSourceId": "88",
  "userSkillId": "188",
  "skillId": "my-review-skill",
  "status": "active",
  "warnings": []
}
```

### `PATCH /v1/clowder/skills/:userSkillId`

编辑当前用户拥有的 Skill 元数据或正文。

Request:

```json
{
  "displayName": "代码审查",
  "description": "识别回归风险",
  "category": "质量门禁",
  "triggers": ["review", "风险"],
  "enabled": true,
  "skillMarkdown": "# Skill..."
}
```

权限：

1. 只能编辑 `clowder_user_skill.uid = loginUID` 的记录。
2. official/project/user_home 源默认只允许编辑用户 override；如要改正文，必须先"复制为我的版本"生成 uploaded/private source。

### `DELETE /v1/clowder/skills/:userSkillId`

从当前用户空间删除 Skill。默认软删 owned relation，保留 source。

Response:

```json
{ "deleted": true }
```

### `PUT /v1/clowder/skills/:userSkillId/assignments`

批量设置当前 Skill 分配到哪些智能体。

Request:

```json
{
  "assignments": [
    { "catId": "codex", "enabled": true },
    { "catId": "claude-code", "enabled": false }
  ]
}
```

Response:

```json
{
  "userSkillId": "101",
  "assignedCatIds": ["codex"]
}
```

### `GET /v1/clowder/cats/:catId/skills`

运行时和智能体详情页用，返回当前用户对该智能体可用的 Skill。

Response:

```json
{
  "catId": "codex",
  "skills": [
    {
      "skillId": "writing-plans",
      "name": "writing-plans",
      "sourcePath": "...",
      "enabled": true,
      "promptHint": "Use when writing implementation plans..."
    }
  ]
}
```

---

## 与 Clowder AI 的对照建议

### 需要复用的 Clowder 能力

1. `GET /api/skills`
   - 复用 Skill 列表、category、trigger、description、mounts、requiresMcp、staleness、conflicts。
   - `sections/im` 可新增代理：`GET /v1/clowder/skills/market/sync` 或在 `GET /v1/clowder/skills/market` 内部按 TTL 刷新。
2. `buildProviderSkillCatalog(projectRoot)`
   - 适合生成 provider 维度市场目录，尤其是 Codex/Claude/Gemini/Kimi 挂载状态。
3. `GET /api/rules/skill/:skillId`
   - Skill 文档预览可复用，避免 UI 后端自己乱读路径。
4. `/api/capabilities` + `PATCH /api/capabilities`
   - 只作为 Clowder 本机治理后台使用，不建议直接承载 IM 多用户 assignment。

### 不建议直接复用为用户配置的部分

1. 不要让 `sections/ui` 每次分配 Skill 就直接 PATCH Clowder `capabilities.json`。
   - 原因：`capabilities.json` 是项目/本机级配置，不是 IM 用户级配置。
   - 结果：用户 A 关闭 Codex 的某 Skill 会影响用户 B。
2. 不要把 provider mount status 当成用户拥有状态。
   - mount 表示本机 CLI 是否能加载，拥有表示当前 IM 用户是否把它添加到自己的空间。
3. 不要把 `agentStore.applyNativeSkills` 的"所有 agents 默认拥有所有 Skill"继续作为真实逻辑。

### 运行时对接建议

1. Clowder route/invocation 需要接收 IM bridge 传来的 user scope：
   - `userId`
   - `catId`
   - `enabledSkillIds` 或 `skillPolicyRef`
2. `sections/im` 在调用 `sendInboundTextWithRouting` 或 conversation message 时，按当前登录用户和 target cat 查询 `clowder_user_skill_assignment`，把可用 Skill 作为 routing metadata 传给 Clowder。
3. Clowder 后端只把用户授权 Skill 注入 promptTags / provider context，不应把未授权 Skill 暴露给该用户的智能体。
4. 对官方 Skill 的实际文件挂载仍由 Clowder governance/sync 保证；IM 用户表只决定"能不能用"，不负责 symlink。

---

## 建议前端改造

### `pages/agents/index.vue`

1. 新增 `agentStore.fetchUserSkillSummary()`。
2. 顶部横条只读 `/v1/clowder/skills/summary`。
3. 点击卡片跳转 `/pages/agents/skills?tab=mine&userSkillId=...`。
4. 不在首页展示上传区域、文档正文、完整文件清单。

### `pages/agents/skills.vue`

1. 去掉 `UI only` 标记和纯 toast action。
2. 新增 tab/segmented control：
   - `我的 Skill`
   - `Skill 市场`
3. 我的 Skill 列表支持搜索、分类、启用状态、分配状态筛选。
4. 市场列表支持搜索、来源、mount 状态、是否已添加筛选。
5. 详情面板分三块：
   - 基本信息 / 文档预览。
   - 智能体分配。
   - 文件与依赖。
6. 上传成功后进入我的 Skill，并在顶部横条刷新。
7. 删除/替换/复制为我的版本必须有确认弹窗。

### `stores/agent.js`

建议拆出独立 `stores/skill.js`，避免 agent store 继续膨胀：

```text
userSkillSummary
mySkills
marketSkills
skillLoading
skillError
fetchUserSkillSummary()
fetchMySkills(params)
fetchSkillMarket(params)
addMarketSkill(skillSourceId, payload)
uploadSkill(file, payload)
updateUserSkill(userSkillId, patch)
deleteUserSkill(userSkillId)
updateSkillAssignments(userSkillId, assignments)
```

`agentStore.applyNativeSkills` 可保留为 fallback/catalog preview，但真实页面应优先使用 `skillStore` 的用户级接口。

---

## 降级策略

1. Clowder `/api/skills` 不可用：
   - 市场页显示"本地 Skill 市场暂不可用"。
   - 我的 Skill 仍可显示数据库里已添加的记录，但 mount 状态标 unknown。
2. 上传解析失败：
   - 返回具体失败原因，不能创建半成品 user_skill。
3. 删除失败：
   - 不从前端本地乐观移除，保持原状态并展示错误。
4. assignment 更新失败：
   - 回滚 toggle 状态，提示用户重试。
5. 同名冲突：
   - 市场页提示冲突，不自动覆盖。
6. 多用户切换：
   - 登出/切换用户必须清空 `skillStore` 缓存，重新按 login UID 拉取。

---

## 问题列表（Q&A 迭代）

### Q1: 这和 `sections/clowder-ai` 的 Skill 管理是不是重复？
**A1**: 不重复。Clowder Web 的 Skill 管理关注本机/project governance、provider mount、MCP 依赖和 capabilities 编排；`sections/ui` 关注 IM 用户把哪些 Skill 加入自己的空间，并分配给自己的智能体。两者需要对照，但不能共用同一份用户配置。

### Q2: 为什么需要数据库表，而不是只写 Clowder `capabilities.json`？
**A2**: `capabilities.json` 是本机/项目级真相源，所有 IM 用户共享。用户级产品能力必须落在 TangSeng/IM 后端按 `uid` 隔离的表里，否则用户 A 的开关会影响用户 B。

### Q3: 市场里的 official Skill 可以编辑吗？
**A3**: 默认不直接编辑正文。用户可以编辑自己的显示名/描述 override；如果要改 `SKILL.md`，应走"复制为我的版本"，生成 uploaded/private source，再编辑副本。

### Q4: 上传的 Skill 是否立刻同步到 Codex/Claude/Gemini/Kimi provider 目录？
**A4**: 初版建议只写入受控上传仓库并进入当前用户空间；是否同步到 provider 目录由后端调用 Clowder sync 或后续治理流程决定。页面要显示 mount 状态，不能假装已可加载。

### Q5: 智能体运行时如何知道用户给它分配了哪些 Skill？
**A5**: `sections/im` bridge 在路由消息时按 `loginUID + catId` 查询 assignment，并把 enabled skill ids 作为 Clowder routing metadata / prompt tags 传入。Clowder 只对该次 invocation 暴露这些 Skill。

### Q6: 顶部横条为什么不能直接显示市场全部 Skill？
**A6**: Skill 内容可能很多，首页应该只承担"我已经有哪些能力"的轻量扫描。完整搜索、上传、编辑、分配和市场添加都放到 Skill 管理页。

---

## 验收标准

- 智能体首页顶部横条只展示当前登录用户已添加 Skill，不展示市场全部 Skill。
- Skill 管理页有"我的 Skill / Skill 市场"两类视图。
- 用户可以从市场添加 Skill 到自己的空间，刷新后仍存在。
- 用户 A 添加/删除/分配 Skill 不影响用户 B。
- 用户可以上传合法 `.skill.zip`，后端解析 `SKILL.md` 并生成 source + user_skill 记录。
- 用户可以删除自己的 Skill；市场 official source 不会被误删。
- 用户可以编辑自己拥有的 Skill 元数据；official 正文编辑必须走复制为私有版本。
- 用户可以把 Skill 分配给自己的一个或多个智能体，刷新后状态保持。
- `agentStore.applyNativeSkills` 不再把所有 Skill 默认赋给所有 agents 作为真实状态。
- 后端接口所有写操作都按 `ctx.GetLoginUID()` 鉴权和过滤。
- Clowder `/api/skills` 不可用时，页面有明确降级状态。

---

## 建议测试

```bash
# UI
npm run build:h5
npm run test:smoke

# IM backend
cd sections/im/TangSengDaoDaoServer
go test ./modules/clowder
```

补充自动化/手工验收：

1. 用户 A 从市场添加 `writing-plans`，用户 B 看不到 A 的"我的 Skill"记录。
2. 用户 A 把 `writing-plans` 分配给 `codex`，刷新页面后 assignment 保持。
3. 用户 A 禁用 Skill 后，`GET /v1/clowder/cats/codex/skills` 不再返回该 Skill。
4. 上传包含 `../evil` 路径的 zip 被拒绝，数据库不落半成品。
5. 删除 official 市场 Skill 的用户拥有关系后，市场 source 仍存在。
6. 同名不同 hash 的 Skill 进入市场时显示冲突。
7. Clowder `/api/skills` 500 时，市场页显示错误，我的 Skill 页仍能展示已添加记录。

---

## 修复记录

### 2026-06-10

- 后端已新增 `/v1/clowder/skills/*` 用户级 Skill 管理接口、内存/SQL 结构、市场同步、上传安全校验、用户隔离和智能体分配校验。
- 前端数据层已新增用户 Skill / 市场 Skill 归一化、service wrapper、Pinia action，并确保 `applyNativeSkills` 只作为 catalog preview，不再把所有市场 Skill 默认分配给所有 agents。
- `pages/agents/skills.vue` 已从 UI-only 改为真实管理页：
  - 增加“我的 Skill / Skill 市场”分栏。
  - 支持从市场添加到当前用户空间。
  - 支持上传 `.skill.zip` / `.zip`，并通过 multipart 调用 `/v1/clowder/skills/upload`。
  - 支持编辑元数据、启用/停用、删除用户拥有关系。
  - 支持按当前可见智能体保存分配。
  - 桌面和移动端均检查了横向溢出、按钮文字、表单与空态。
- 上传服务层补齐 H5 `Blob/File` 与 uni `tempFilePath/path` 两种形态，避免把文件对象误当 JSON payload。

---

## 测试结果

### 自动化

```bash
cd sections/im/TangSengDaoDaoServer && /home/yunyi/go1.22/go/bin/go test ./modules/clowder
cd sections/ui && npm run test:native-im
cd sections/ui && npm run test:smoke
cd sections/ui && npm run build:h5
```

结果：

- `go test ./modules/clowder`：通过。
- `npm run test:native-im`：77/77 通过。
- `npm run test:smoke`：通过。
- `npm run build:h5`：通过，仅有既有 uni-app / Sass deprecation warning。

### 浏览器证据

证据目录：`sections/ui/.ai/tests/ISSUE-034-20260610041854/`

- `desktop-1440x900-my-skills.png`
- `desktop-1440x900-marketplace.png`
- `desktop-1440x900-assignment.png`
- `mobile-375x844-my-skills.png`
- `mobile-375x844-marketplace.png`
- `browser-console.json`
- `request-log.json`
- `result.json`
- `skill-management-visual.mjs`

Playwright 结果摘要：

- 桌面视口 `1440x900`：市场添加、元数据保存、智能体分配、上传 multipart、删除均触发真实 service/API 契约；无横向溢出、无文字溢出、无 console error、无失败请求。
- 移动视口 `375x844`：我的 Skill 与市场视图可读可操作；无横向溢出、无文字溢出、无 console error、无失败请求。

---

## 关闭备注

已完成用户级 Skill 管理、市场添加、上传、编辑、删除和分配闭环；后端隔离/幂等接口测试、前端单元测试、H5 build 和桌面/移动端 Playwright 视觉证据均已补齐。
