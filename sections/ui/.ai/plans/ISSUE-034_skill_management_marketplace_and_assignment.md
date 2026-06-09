# ISSUE-034 Skill 管理、市场与用户级分配实施计划

**Issue**：`sections/ui/.ai/issues/ISSUE-034_skill_management_marketplace_and_assignment.md`
**Goal**：把 `sections/ui` 的 Skill 页面从 UI-only/catalog-only 升级为用户级“我的 Skill + 市场 + 分配给智能体”功能，并在后端保证用户隔离、上传安全和幂等。
**AI修复模式**：Plan First
**前端验证**：Yes，必须覆盖桌面 Web viewport 和移动端 viewport。
**非目标**：不直接把 IM 用户开关写进 Clowder 共享 `capabilities.json`；不把所有 catalog skill 默认分配给所有 agents。

---

## 现象与根因

当前 `agentStore.userSkills/localSkills` 主要是静态示例和 Clowder `skillCatalog` 扁平化结果，上传、启用、绑定按钮只是 toast。后端 bridge 没有用户级 skill ownership / assignment 表和接口，导致无法表达用户 A/B 隔离。

## 受影响模块

Backend:

- `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
- `sections/im/TangSengDaoDaoServer/modules/clowder/*skill*.go`（新增）
- `sections/im/TangSengDaoDaoServer/modules/clowder/*skill*_test.go`（新增或扩展）
- 后端 DB migration / model 文件，按现有 TangSeng 迁移结构落位。

Frontend:

- `sections/ui/services/native-im/service.js`
- `sections/ui/stores/agent.js`
- `sections/ui/pages/agents/index.vue`
- `sections/ui/pages/agents/skills.vue`
- `sections/ui/tests/native-im.test.mjs`

参考：

- `sections/clowder-ai/packages/api/src/routes/skills.ts`
- `sections/clowder-ai/packages/api/src/utils/skill-catalog.ts`
- `sections/clowder-ai/packages/shared/src/types/capability.ts`
- `sections/clowder-ai/packages/web/src/components/settings/SkillsContent.tsx`

## 推荐设计

分三层数据：

1. 市场目录：本机可用 skill source，来自 official/project/user_home/uploaded。
2. 用户拥有关系：当前 IM 用户添加了哪些 skill。
3. 用户对智能体分配：当前 IM 用户将自己的 skill 分配给哪些自己的 cat。

Backend P0 表：

- `clowder_skill_source`
- `clowder_user_skill`
- `clowder_user_skill_assignment`
- `clowder_skill_file`
- `clowder_skill_audit_log`

Frontend 页面分为 `我的 Skill` 和 `Skill 市场` 两个 tab。首页横条只读 `/v1/clowder/skills/summary`，管理页读 `/v1/clowder/skills` 与 `/v1/clowder/skills/marketplace`。

落表时优先兼容 TangSengDaoDaoServer 当前 DB/测试环境；如果 JSON 字段兼容性不稳，先使用 TEXT 存储 JSON 字符串并在 model 层统一 marshal/unmarshal。Clowder AI 的 `/api/skills` 和 `buildProviderSkillCatalog` 只作为市场源与挂载健康参考，不作为 IM 用户级 assignment 的真相源。

## 阶段计划

### Phase 1：后端接口和权限测试

**Files**

- Modify/Create backend clowder skill module files.
- Test backend skill API tests.

**TDD**

1. 先补后端失败测试：
   - 用户 A 添加市场 skill 后，用户 B 的 `GET /skills` 不可见。
   - `POST /skills/:sourceId/add` 幂等。
   - `PUT /skills/:userSkillId/assignments` 只能分配给当前用户可见 cat。
   - 删除 user skill 只软删当前用户关系。
   - 上传 zip 拒绝 `..`、绝对路径、symlink、缺失 `SKILL.md`。
2. 实现 API：
   - `GET /v1/clowder/skills/summary`
   - `GET /v1/clowder/skills`
   - `GET /v1/clowder/skills/marketplace`
   - `POST /v1/clowder/skills/:sourceId/add`
   - `PATCH /v1/clowder/skills/:userSkillId`
   - `DELETE /v1/clowder/skills/:userSkillId`
   - `PUT /v1/clowder/skills/:userSkillId/assignments`
   - `POST /v1/clowder/skills/upload`
3. 运行后端对应 Go tests。

如果完整上传/编辑实现影响阶段过大，必须至少先实现安全校验测试和拒绝不安全 zip 的后端路径；不能把上传按钮继续留成 UI-only toast 后关闭 issue。

**阶段提交示例**：`增加用户级 Skill 后端接口`

### Phase 2：前端 service/store 红绿测试

**Files**

- Modify: `sections/ui/services/native-im/service.js`
- Modify: `sections/ui/stores/agent.js`
- Test: `sections/ui/tests/native-im.test.mjs`

**TDD**

1. 新增失败测试：
   - `fetches current user skill summary`
   - `fetches marketplace separately from my skills`
   - `adds marketplace skill without assigning to every agent`
   - `updates skill assignments by userSkillId`
2. 实现 service wrapper 和 store action：
   - `fetchSkillSummary`
   - `fetchUserSkills`
   - `fetchSkillMarketplace`
   - `addMarketplaceSkill`
   - `updateUserSkill`
   - `deleteUserSkill`
   - `updateSkillAssignments`
   - `uploadSkillPackage`
3. 修改 `applyNativeSkills`：只保留 catalog preview，不再默认挂到所有 agents。

**阶段提交示例**：`接入 Skill 管理前端数据层`

### Phase 3：Skill UI 功能化

**Files**

- Modify: `sections/ui/pages/agents/index.vue`
- Modify: `sections/ui/pages/agents/skills.vue`

**Implementation**

1. 首页顶部横条只显示 `userSkills` 轻量 summary；空态只保留“技能管理”入口。
2. 管理页拆成：
   - `我的 Skill`
   - `Skill 市场`
3. 上传、添加、编辑、删除、启用、分配智能体按钮接真实 action。
4. 绑定面板只展示当前用户可见 agents。
5. 失败/空态/加载态完整。
6. 移动端 375px 下 tab、按钮、长 skill 名称不溢出。

**阶段提交示例**：`实现 Skill 管理与市场交互`

### Phase 4：自动化与浏览器证据

**Verification**

```bash
cd sections/ui && npm run test:native-im
cd sections/ui && npm run build:h5
PATH=/home/yunyi/go1.22/go/bin:$PATH bash scripts/start-im-clowder.sh start
```

后端测试按实际新增包执行，例如：

```bash
cd sections/im/TangSengDaoDaoServer && /home/yunyi/go1.22/go/bin/go test ./modules/clowder/...
```

证据目录：

```text
sections/ui/.ai/tests/ISSUE-034-<timestamp>/
```

必须保存：

- `desktop-1440x900-my-skills.png`
- `desktop-1440x900-marketplace.png`
- `desktop-1440x900-assignment.png`
- `mobile-375x844-my-skills.png`
- `mobile-375x844-marketplace.png`
- `browser-console.json`
- `request-log.json`
- `result.json`

**阶段提交示例**：`完成 Skill 管理浏览器验收`

## 风险与回滚

- 上传必须安全校验，禁止路径穿越和半成品记录。
- 用户级 assignment 不写入共享 Clowder capabilities，避免多用户互相影响。
- 若后端 P0 过大，可先完成 summary/list/add/assignment/delete，上传编辑作为同 issue 后续 phase，但 issue 关闭前必须全部验收。

## Done

- 用户 A/B Skill ownership 和 assignment 隔离。
- 市场和我的 Skill 分层。
- 上传/删除/编辑/分配至少 P0 链路真实可用。
- ISSUE-034 文档更新为 `Resolved`，含后端测试和浏览器证据路径。
