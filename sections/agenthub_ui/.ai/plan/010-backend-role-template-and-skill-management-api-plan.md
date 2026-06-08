# Backend Role Template and Skill Management API Gap Implementation Plan

**Feature:** Issue 010 - `sections/agenthub_ui/.ai/issue/010-backend-role-template-and-skill-management-api.md`
**Goal:** Users can create role templates and import packaged Skills from AgentHub UI without manually editing server files or restarting Clowder API.
**Acceptance Criteria:**
1. 用户可以通过后端 API 新增角色模板，刷新创建猫猫页面后无需重启即可在角色模板下拉框看到新模板。
2. 用户可以编辑 / 删除自己创建的角色模板；删除被已有猫猫引用的模板时，后端返回明确错误或降级策略。
3. 前端调用 `POST clowder/skills` 上传 `.skill.zip` 后，后端完成解包、校验、安装、同步和 catalog refresh。
4. 上传成功的 Skill 会出现在技能库列表和 `skillCatalog` 中，并带有触发词、文件清单、文档摘要、挂载状态。
5. 非 owner 用户调用模板写入或 Skill 上传接口会被 401 / 403 拒绝。
6. 恶意 zip path traversal、重复 skillName、缺失 `SKILL.md`、非法 manifest、超大包都有明确 4xx 错误和前端可展示 message。
7. 新增模板后创建猫猫时，`roleTemplateId` 可以正确传入 `POST /api/cats` 并创建可用 cat。
8. 新增 Skill 后触发 agent invocation 时，相关 provider 能看到已同步的 Skill；不需要重启 Clowder API。
9. 单元测试覆盖 catalog write、template validation、skill zip validation、import rollback、reload/sync；H5 smoke 覆盖上传成功和失败主路径。
**Architecture cell:** `identity-session` + `action-plane` + `transport`
**Map delta:** none
**Map delta why:** This extends existing cat catalog identity configuration, existing skill sync/action routes, and the TangSeng Clowder bridge; it does not introduce a new ownership boundary.
**Architecture:** Add owner-only write services in Clowder API for project-scoped role templates and packaged Skill imports, then proxy the AgentHub-facing `/v1/clowder/*` routes through TangSeng. Keep runtime config writes atomic and project-scoped; Skill imports use temp extraction, validation, rollback, sync, and catalog refresh.
**Tech Stack:** Node 20, Fastify, zod, `node:test`, YAML parser, zip extraction library or `jszip`, existing `cat-catalog-store.ts`, existing `skillsRoutes`, Go TangSeng bridge, Vue 3 / uni-app / Pinia.
**前端验证:** Yes - H5 AgentHub smoke with network evidence for template create and Skill import.

---

## Finish Line

B state: from AgentHub, an owner imports a `.skill.zip`, sees it appear in the Skill library and `skillCatalog`, creates a role template, sees it appear in the create-cat role picker, then creates a cat with that `roleTemplateId` without restarting Clowder API.

Not building:

- Full browser-based Skill source editor.
- Direct modification of built-in `cat-template.json`.
- Arbitrary install scripts inside uploaded packages.
- Multi-node distributed config storage.
- Public non-owner Skill or template writes.

## Terminal Schema

Role template write schema:

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

type RoleTemplateResponse = {
  roleTemplateId: string;
  logicalKey: string;
  displayName: string;
  description?: string;
  personalitySummary?: string;
  capabilitySummary?: string;
  capabilityTags: string[];
  cloneable: boolean;
  source: 'runtime';
};
```

Skill import schema:

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

AgentHub route mapping:

```text
AgentHub UI request('clowder/skills')
  -> TangSeng /v1/clowder/skills
  -> Clowder API /api/skills/import

AgentHub UI request('clowder/cat-templates')
  -> TangSeng /v1/clowder/cat-templates
  -> Clowder API /api/cat-templates
```

## Source References

- `sections/agenthub_ui/.ai/issue/010-backend-role-template-and-skill-management-api.md`
- `sections/agenthub_ui/api/clowder.js`
- `sections/agenthub_ui/stores/agent.js`
- `sections/agenthub_ui/stores/settings.js`
- `sections/agenthub_ui/pages/agents/new.vue`
- `sections/agenthub_ui/pages/agents/skills.vue`
- `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
- `sections/clowder-ai/packages/api/src/config/cat-catalog-store.ts`
- `sections/clowder-ai/packages/api/src/config/runtime-cat-catalog.ts`
- `sections/clowder-ai/packages/api/src/routes/cats.ts`
- `sections/clowder-ai/packages/api/src/routes/skills.ts`
- `sections/clowder-ai/packages/api/test/cats-routes-runtime-crud.test.js`
- `sections/clowder-ai/packages/api/test/skills-route.test.js`

---

## Task 0: Contract Spike - Pin Route Ownership and Runtime Write Layer

**Files:**
- Read: `sections/agenthub_ui/api/clowder.js`
- Read: `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
- Read: `sections/clowder-ai/packages/api/src/routes/cats.ts`
- Read: `sections/clowder-ai/packages/api/src/routes/skills.ts`
- Read: `sections/clowder-ai/docs/architecture/ownership/README.md`
- Update if needed: `sections/agenthub_ui/.ai/issue/010-backend-role-template-and-skill-management-api.md`

**Step 1: Confirm final route map**

Run:

```bash
rg -n "clowder/skills|cat-templates|/api/skills|/api/cat-templates|proxyToClowder" \
  sections/agenthub_ui sections/im/TangSengDaoDaoServer/modules/clowder sections/clowder-ai/packages/api/src/routes
```

Expected: `clowder/skills` currently exists only in AgentHub UI, `/api/skills/import` and `/v1/clowder/skills` do not exist.

**Step 2: Confirm write location**

Decision:

- Runtime role templates are stored in `.cat-cafe/cat-catalog.json` under a `roleTemplates` runtime overlay field.
- Built-in `cat-template.json` remains read-only seed data.
- Existing `GET /api/cat-templates` returns merged built-in templates plus runtime templates, with runtime templates marked `source: "runtime"`.

**Step 3: Record any contract correction**

If current code uses a different canonical field than `roleTemplates`, update the issue and this plan before implementation.

**Commit checkpoint:**

```bash
git commit -m "010 阶段0：确认模板与 skill 管理接口契约"
```

---

## Task 1: Add Runtime Role Template Store Helpers

**Files:**
- Modify: `sections/clowder-ai/packages/api/src/config/cat-catalog-store.ts`
- Create: `sections/clowder-ai/packages/api/test/cat-role-templates-store.test.js`

**Step 1: Write failing store tests**

Cover:

- `listRuntimeRoleTemplates(projectRoot)` returns `[]` when no runtime templates exist.
- `upsertRuntimeRoleTemplate(projectRoot, input)` writes `.cat-cafe/cat-catalog.json` atomically and preserves existing `breeds`, `roster`, and `reviewPolicy`.
- Duplicate `logicalKey` / `roleTemplateId` is rejected unless updating the same template.
- `deleteRuntimeRoleTemplate(projectRoot, id)` removes runtime templates only.

Test skeleton:

```js
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

const tempDirs = [];

function createProject() {
  const root = mkdtempSync(join(tmpdir(), 'role-template-store-'));
  tempDirs.push(root);
  writeFileSync(join(root, 'cat-template.json'), JSON.stringify({ version: 2, breeds: [], roster: {}, reviewPolicy: {} }));
  return root;
}

describe('runtime role template store', () => {
  after(() => tempDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  it('upserts runtime role templates without rewriting built-in template', async () => {
    const root = createProject();
    const {
      upsertRuntimeRoleTemplate,
      listRuntimeRoleTemplates
    } = await import('../dist/config/cat-catalog-store.js');

    const created = upsertRuntimeRoleTemplate(root, {
      logicalKey: 'incident-lead',
      displayName: 'Incident Lead',
      capabilitySummary: 'Triage production incidents'
    });

    assert.equal(created.roleTemplateId, 'incident-lead');
    assert.equal(listRuntimeRoleTemplates(root).length, 1);
    const raw = JSON.parse(readFileSync(join(root, '.cat-cafe', 'cat-catalog.json'), 'utf-8'));
    assert.equal(raw.roleTemplates[0].logicalKey, 'incident-lead');
  });
});
```

**Step 2: Run failing test**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/cat-role-templates-store.test.js
```

Expected: FAIL because helper exports do not exist.

**Step 3: Implement minimal helpers**

Add exported functions:

```ts
export interface RuntimeRoleTemplate {
  roleTemplateId: string;
  logicalKey: string;
  displayName: string;
  description?: string;
  personalitySummary?: string;
  capabilitySummary?: string;
  systemPrompt?: string;
  capabilityTags: string[];
  cloneable: boolean;
  source: 'runtime';
}

export function listRuntimeRoleTemplates(projectRoot: string): RuntimeRoleTemplate[];
export function upsertRuntimeRoleTemplate(projectRoot: string, input: UpsertRuntimeRoleTemplateInput): RuntimeRoleTemplate;
export function deleteRuntimeRoleTemplate(projectRoot: string, templateId: string): boolean;
```

Implementation notes:

- Reuse `readCatCatalog(projectRoot)` and `writeCatCatalog(projectRoot, catalog)`.
- Normalize ids to lowercase slug format.
- Preserve all existing catalog fields.
- Store runtime templates in `catalog.roleTemplates`.
- Reject path traversal implicitly by using existing `resolveCatCatalogPath()`.

**Step 4: Run green test**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/cat-role-templates-store.test.js
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "010 阶段1：新增运行时角色模板存储"
```

---

## Task 2: Add Owner-Only Role Template Routes

**Files:**
- Modify: `sections/clowder-ai/packages/api/src/routes/cats.ts`
- Test: `sections/clowder-ai/packages/api/test/cats-routes-runtime-catalog.test.js`
- Test: `sections/clowder-ai/packages/api/test/cats-routes-runtime-crud.test.js`

**Step 1: Write failing route tests**

Add tests for:

- `POST /api/cat-templates` returns 401/403 without owner identity.
- `POST /api/cat-templates` creates a runtime template.
- `GET /api/cat-templates` returns created runtime templates without restart.
- `PUT /api/cat-templates/:templateId` updates runtime template fields.
- `DELETE /api/cat-templates/:templateId` deletes only runtime templates.
- `DELETE` returns 409 when a runtime cat references the template.

Use headers:

```js
const OWNER_HEADERS = { 'x-cat-cafe-user': 'owner-user' };
process.env.DEFAULT_OWNER_USER_ID = 'owner-user';
```

**Step 2: Run failing tests**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test \
  test/cats-routes-runtime-catalog.test.js test/cats-routes-runtime-crud.test.js
```

Expected: FAIL because write routes do not exist.

**Step 3: Implement route handlers**

Add:

```http
POST   /api/cat-templates
PUT    /api/cat-templates/:templateId
DELETE /api/cat-templates/:templateId
POST   /api/cat-templates/reload
```

Route behavior:

- Require owner identity using the same owner semantics as `skillsRoutes`.
- Validate request body with zod.
- On create/update/delete, call store helpers from Task 1.
- On change, call `opts.onCatalogChanged?.(await reconcileCatRegistry(projectRoot, managedIdsBefore))` when the route can affect runtime availability.
- Keep `POST /api/cat-templates/reload` as a no-op refresh hook that reloads templates and returns the merged response.

**Step 4: Verify route tests**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test \
  test/cats-routes-runtime-catalog.test.js test/cats-routes-runtime-crud.test.js
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "010 阶段2：暴露角色模板管理 API"
```

---

## Task 3: Make `POST /api/cats` Validate Runtime Role Templates

**Files:**
- Modify: `sections/clowder-ai/packages/api/src/routes/cats.ts`
- Modify if needed: `sections/clowder-ai/packages/api/src/config/runtime-cat-catalog.ts`
- Test: `sections/clowder-ai/packages/api/test/cats-routes-runtime-crud.test.js`

**Step 1: Write failing create-cat test**

Flow:

1. `POST /api/cat-templates` creates `incident-lead`.
2. `POST /api/cats` with `roleTemplateId: "incident-lead"` creates a cat.
3. `GET /api/cats` shows the cat with role metadata copied from the template.
4. `POST /api/cats` with unknown `roleTemplateId` returns 400.

**Step 2: Run failing test**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/cats-routes-runtime-crud.test.js
```

Expected: FAIL on unknown runtime template resolution or missing validation.

**Step 3: Implement runtime template lookup**

Implementation notes:

- Build a merged template lookup from built-in templates plus `listRuntimeRoleTemplates(projectRoot)`.
- Reject unknown `roleTemplateId` early with 400 and a user-facing message.
- Do not require role template for existing flows that already omit it.
- If a template has `systemPrompt`, map it to the runtime cat personality/system prompt field already used by `createRuntimeCat()`.

**Step 4: Verify**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/cats-routes-runtime-crud.test.js
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "010 阶段3：创建猫猫支持运行时角色模板"
```

---

## Task 4: Add Skill Package Validation and Import Service

**Files:**
- Create: `sections/clowder-ai/packages/api/src/config/governance/skill-import.ts`
- Modify if needed: `sections/clowder-ai/packages/api/src/utils/skill-parse.ts`
- Test: `sections/clowder-ai/packages/api/test/skill-import.test.js`

**Step 1: Write failing validation tests**

Cover:

- Valid package with `SKILL.md` imports into a temp skills directory.
- Package with `../escape.txt` is rejected.
- Package missing `SKILL.md` is rejected.
- Duplicate skill name is rejected unless explicit overwrite is later added.
- Invalid skill name is rejected using existing `validateSkillName()`.
- Import failure leaves no partial target directory.

Test package creation can use `jszip`:

```js
import JSZip from 'jszip';

async function makeSkillZip(files) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}
```

**Step 2: Run failing test**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/skill-import.test.js
```

Expected: FAIL because import service does not exist.

**Step 3: Implement import service**

Export:

```ts
export interface ImportSkillPackageOptions {
  skillsSrc: string;
  packageBuffer: Buffer;
  fileName?: string;
  maxBytes?: number;
}

export async function importSkillPackage(options: ImportSkillPackageOptions): Promise<SkillImportResult>;
```

Implementation notes:

- Use temp directory under the same parent filesystem as `skillsSrc`.
- Reject absolute paths and parent traversal before writing.
- Allow only regular files and directories.
- Determine skill name from package root directory or `manifest.yaml`; require it to match `validateSkillName()`.
- Require `SKILL.md`.
- Read existing `manifest.yaml` metadata if provided; do not execute scripts.
- Atomic install: write temp target, rename into `skillsSrc/{skillName}` only after validation.
- On error, remove temp directories.

**Step 4: Verify**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/skill-import.test.js
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "010 阶段4：新增 Skill 包导入校验服务"
```

---

## Task 5: Add Owner-Only Skill Import and Reload Routes

**Files:**
- Modify: `sections/clowder-ai/packages/api/src/routes/skills.ts`
- Modify if needed: `sections/clowder-ai/packages/api/src/routes/parse-multipart.ts`
- Test: `sections/clowder-ai/packages/api/test/skills-route.test.js`

**Step 1: Write failing route tests**

Cover:

- `POST /api/skills/import` returns 401/403 without owner identity.
- Valid upload returns `ok: true`, imported skill metadata, and mount sync status.
- Missing file returns 400.
- Path traversal package returns 400.
- `POST /api/skills/reload` returns current catalog including newly imported skill.

Use Fastify injection with multipart if existing parser supports it; otherwise accept JSON `{ fileName, contentBase64 }` for first backend contract and let TangSeng forward JSON.

**Step 2: Run failing tests**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/skills-route.test.js
```

Expected: FAIL because import/reload routes do not exist.

**Step 3: Implement routes**

Add:

```http
POST /api/skills/import
POST /api/skills/reload
DELETE /api/skills/:skillName
```

Route behavior:

- Reuse `requireSkillsOwner()`.
- Parse multipart or JSON upload.
- Call `importSkillPackage()`.
- Call `syncSkills(projectRoot, skillsSrc)` after successful import.
- Return `SkillImportResponse`.
- `reload` returns the same structure as `GET /api/skills`.
- `DELETE` is owner-only, rejects unmanaged built-ins unless explicitly imported by the user.

**Step 4: Verify**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/skills-route.test.js
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "010 阶段5：暴露 Skill 导入与刷新 API"
```

---

## Task 6: Ensure Skill Catalog Refreshes in Cat Directory Responses

**Files:**
- Modify: `sections/clowder-ai/packages/api/src/routes/cats.ts`
- Modify if needed: `sections/clowder-ai/packages/api/src/utils/skill-catalog.ts`
- Test: `sections/clowder-ai/packages/api/test/skills-route.test.js`
- Test: `sections/clowder-ai/packages/api/test/cats-routes-runtime-catalog.test.js`

**Step 1: Write failing integration test**

Flow:

1. Import a test skill.
2. Call `GET /api/cat-templates`.
3. Assert `skillCatalog` includes the imported skill.
4. Call `GET /api/cats` if it is the AgentHub metadata source; assert the response used by TangSeng still contains `skillCatalog`.

**Step 2: Run failing tests**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test \
  test/skills-route.test.js test/cats-routes-runtime-catalog.test.js
```

Expected: FAIL if `skillCatalog` remains cached or is not included on the route used by AgentHub.

**Step 3: Implement fresh catalog read**

Implementation notes:

- Keep `buildProviderSkillCatalog(projectRoot)` fresh per request unless a safe invalidation cache already exists.
- After import, no server restart should be needed.
- Preserve existing provider grouping: `claude`, `codex`, `gemini`, `kimi`.

**Step 4: Verify**

```bash
cd sections/clowder-ai/packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test \
  test/skills-route.test.js test/cats-routes-runtime-catalog.test.js
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "010 阶段6：刷新猫目录中的 Skill catalog"
```

---

## Task 7: Proxy New Routes Through TangSeng Clowder Bridge

**Files:**
- Modify: `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
- Test: `sections/im/TangSengDaoDaoServer/modules/clowder/api_test.go` or create `sections/im/TangSengDaoDaoServer/modules/clowder/skill_template_proxy_test.go`

**Step 1: Write failing bridge tests**

Cover route mapping:

```text
POST /v1/clowder/skills             -> POST /api/skills/import
POST /v1/clowder/skills/reload      -> POST /api/skills/reload
POST /v1/clowder/cat-templates      -> POST /api/cat-templates
PUT  /v1/clowder/cat-templates/:id  -> PUT /api/cat-templates/:id
DELETE /v1/clowder/cat-templates/:id -> DELETE /api/cat-templates/:id
POST /v1/clowder/cat-templates/reload -> POST /api/cat-templates/reload
```

Assert:

- Request body is forwarded.
- Query and owner/user headers are preserved consistently with existing directory calls.
- Upstream 4xx/5xx responses pass through with body.

**Step 2: Run failing Go test**

```bash
cd sections/im/TangSengDaoDaoServer
GOFLAGS=-buildvcs=false go test ./modules/clowder
```

Expected: FAIL because bridge routes do not exist.

**Step 3: Implement proxy handlers**

Implementation notes:

- Add routes under `Route()`.
- Use existing `proxyToClowder()` and `readJSONBody()`.
- For JSON/base64 upload first version, proxy body directly.
- If multipart is required, preserve `Content-Type` and stream the raw body; do not JSON decode it.
- Use error codes like `skill_import_unavailable` and `cat_template_write_unavailable`.

**Step 4: Verify**

```bash
cd sections/im/TangSengDaoDaoServer
GOFLAGS=-buildvcs=false go test ./modules/clowder
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "010 阶段7：桥接 AgentHub 模板与 Skill 写入接口"
```

---

## Task 8: Wire AgentHub API and Stores to the Real Backend

**Files:**
- Modify: `sections/agenthub_ui/api/clowder.js`
- Modify: `sections/agenthub_ui/stores/agent.js`
- Modify: `sections/agenthub_ui/stores/settings.js`
- Test: `sections/agenthub_ui/tests/unit/clowder-agent.spec.js`
- Test: `sections/agenthub_ui/tests/unit/request.spec.js`

**Step 1: Write failing unit tests**

Cover:

- `clowderApi.createRoleTemplate(data)` uses `POST clowder/cat-templates`.
- `clowderApi.updateRoleTemplate(id, data)` uses `PUT clowder/cat-templates/:id`.
- `clowderApi.deleteRoleTemplate(id)` uses `DELETE clowder/cat-templates/:id`.
- `settingsStore.uploadSkill(payload)` refreshes `agentStore.fetchSkills()` or returns import response for the UI to merge.
- `agentStore.applyDirectoryMetadata()` normalizes runtime template fields from the backend.

**Step 2: Run failing tests**

```bash
cd sections/agenthub_ui
node scripts/run-vitest.mjs
```

Expected: FAIL on missing API/store methods.

**Step 3: Implement API methods and store actions**

Add API:

```js
createRoleTemplate(data) {
  return request('clowder/cat-templates', { method: 'POST', data });
},
updateRoleTemplate(templateId, data) {
  return request(`clowder/cat-templates/${encodeURIComponent(templateId)}`, { method: 'PUT', data });
},
deleteRoleTemplate(templateId) {
  return request(`clowder/cat-templates/${encodeURIComponent(templateId)}`, { method: 'DELETE' });
},
reloadRoleTemplates() {
  return request('clowder/cat-templates/reload', { method: 'POST' });
},
reloadSkills() {
  return request('clowder/skills/reload', { method: 'POST' });
}
```

Store behavior:

- `agentStore.createRoleTemplate(payload)` calls API, merges the returned template, then refreshes directory metadata.
- `agentStore.updateRoleTemplate(id, payload)` updates local `roleTemplates`.
- `agentStore.deleteRoleTemplate(id)` removes local runtime template on success.
- `settingsStore.uploadSkill(payload)` returns import details and triggers a skill list refresh.

**Step 4: Verify**

```bash
cd sections/agenthub_ui
node scripts/run-vitest.mjs
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "010 阶段8：接入 AgentHub 模板与 Skill API"
```

---

## Task 9: Enable Minimal UI Entry Points

**Files:**
- Modify: `sections/agenthub_ui/pages/agents/new.vue`
- Modify: `sections/agenthub_ui/pages/agents/skills.vue`
- Test: `sections/agenthub_ui/tests/unit/clowder-agent.spec.js`

**Step 1: Write failing UI/store smoke tests**

Cover:

- New-agent page can call `agentStore.createRoleTemplate()` from a minimal modal or inline action.
- Skills page calls `settingsStore.uploadSkill()` instead of always showing unavailable.
- Failure toast uses backend `message` / `error`.

**Step 2: Run failing tests**

```bash
cd sections/agenthub_ui
node scripts/run-vitest.mjs
```

Expected: FAIL because UI handlers still show unavailable only.

**Step 3: Implement minimal UI**

Role template:

- Add a compact “新增角色模板” action near the role picker.
- Modal fields: display name, logical key, capability summary, personality summary.
- On save, call `agentStore.createRoleTemplate()`, select returned template.

Skill upload:

- Replace unavailable-only handler with real picker/upload path supported by uni-app H5.
- If file picker remains platform-limited, support a developer JSON/base64 test path behind the existing upload buttons and keep clear disabled states for unsupported runtimes.
- On success, show imported skill and refresh the list.

**Step 4: Verify**

```bash
cd sections/agenthub_ui
node scripts/run-vitest.mjs
node scripts/run-uni.mjs build -p h5
```

Expected: PASS and H5 build completes.

**Commit checkpoint:**

```bash
git commit -m "010 阶段9：开放角色模板与 Skill 导入入口"
```

---

## Task 10: End-to-End Live Validation

**Files:**
- Create: `sections/agenthub_ui/.ai/tests/issue-010-role-template-skill-import.mjs`
- Output: `sections/agenthub_ui/.ai/tests/issue-010-YYYYMMDD-HHMMSS/report.md`
- Output: screenshots under `sections/agenthub_ui/.ai/tests/issue-010-YYYYMMDD-HHMMSS/`

**Step 1: Start services**

Use the existing project startup path already used by AgentHub V1-3 validation. If a port is occupied, use the project script's supported alternate port mechanism.

```bash
cd sections/clowder-ai
pnpm start
```

```bash
cd sections/agenthub_ui
pnpm run dev:h5
```

**Step 2: Run API smoke**

Script should:

1. Login or reuse `TEST_PASSWORD` flow used by `tests-e2e/agenthub-v1-3-clowder.mjs`.
2. Call `POST /v1/clowder/cat-templates`.
3. Call `GET /v1/clowder/cats`.
4. Assert returned `templates` contains the new runtime template.
5. Call `POST /v1/clowder/cats` with `roleTemplateId`.
6. Call `POST /v1/clowder/skills` with a tiny test `.skill.zip` payload.
7. Call `GET /v1/clowder/cats` and assert `skillCatalog` contains imported skill.

Run:

```bash
cd sections/agenthub_ui
TEST_PASSWORD=<redacted> node .ai/tests/issue-010-role-template-skill-import.mjs
```

Expected: PASS with API evidence JSON.

**Step 3: Run browser smoke**

Use Playwright to capture:

- Create cat page with runtime template visible.
- Skill page with imported skill visible.
- Network record showing `POST /v1/clowder/skills` status < 500.

**Step 4: Stop dev servers**

Do not leave long-running sessions active after validation.

**Commit checkpoint:**

```bash
git add sections/agenthub_ui/.ai/tests/issue-010-*/report.md
git commit -m "010 阶段10：补充模板与 Skill 导入验收证据"
```

---

## Final Verification

Run backend checks:

```bash
cd sections/clowder-ai
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm --filter @cat-cafe/api run test -- \
  test/cat-role-templates-store.test.js \
  test/skill-import.test.js \
  test/skills-route.test.js \
  test/cats-routes-runtime-catalog.test.js \
  test/cats-routes-runtime-crud.test.js
```

Run bridge checks:

```bash
cd sections/im/TangSengDaoDaoServer
GOFLAGS=-buildvcs=false go test ./modules/clowder
```

Run AgentHub checks:

```bash
cd sections/agenthub_ui
node scripts/run-vitest.mjs
node scripts/run-uni.mjs build -p h5
TEST_PASSWORD=<redacted> node .ai/tests/issue-010-role-template-skill-import.mjs
```

Expected:

- All targeted backend tests pass.
- Go bridge tests pass.
- AgentHub unit tests and H5 build pass.
- E2E report proves no-restart template refresh and Skill catalog refresh.

## Rollback Plan

- Disable UI entry points by restoring unavailable status in `pages/agents/skills.vue` and hiding role-template write action.
- Remove TangSeng bridge routes for `/v1/clowder/skills` and `/v1/clowder/cat-templates`.
- Keep read-only `GET /api/cat-templates` and `GET /api/skills` unchanged.
- Runtime catalog rollback is file-level: remove runtime `roleTemplates` entries from `.cat-cafe/cat-catalog.json`.
- Imported Skill rollback is directory-level: delete the imported skill directory and re-run `POST /api/skills/sync`.

## Open Questions

### Technical OQ: Multipart vs JSON/base64 upload

Default to multipart if current uni-app H5 picker and TangSeng proxy can preserve `Content-Type` and stream body. If bridge complexity is high, ship JSON/base64 first for `.skill.zip` and leave multipart as a follow-up.

### Technical OQ: Where to mark user-created Skill ownership

Prefer `.cat-cafe/skills-state.json` or existing managed skills state so `DELETE /api/skills/:skillName` can distinguish imported user skills from built-in repo skills.

### Value OQ: Should role template creation be in the create-cat page or a separate settings page?

Reversible and low-risk. Implement minimal create-cat inline modal first because it directly removes the blocker in Issue 010; a richer settings page can follow later.
