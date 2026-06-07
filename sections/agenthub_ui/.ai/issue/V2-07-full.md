# [V2-07] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P1

---

## 问题描述

完整 V2 run `v2-full-20260607-041127` 执行到 V2-07 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-01/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-02/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-03/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-04/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-05/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-06/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-07/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-08/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-09/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-07-10/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-07
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
| V2-07-01 进入创建页 | FAIL | expectedFormVisible=true; realModelListOrCapabilities=false; text=新建智能体<br>基础信息<br>智能体名称 *<br>例如：QA 质量保证<br>0/40<br>@ 别名<br>@<br>QA<br>用于在会话中通过 @ 触发该智能体<br>一句话介绍<br>发布前再慌也保持冷静，负责自动化测试、回归验证与质量门禁。<br>0/200<br>角色与能力<br>角色模板<br>布偶猫（架构师）<br>架构设计、写代码一把好手<br>能力标签<br>添加标签后按回车<br>最多添加 8 个能力标签，便于在智能体库中检索<br>模型设置<br>运行平台<br>Codex<br>Claude Code<br>接入方式<br>API Key<br>OAuth<br>模型<br>自定义<br>账号引用<br>提示词模板<br>管理模板<br>代码审查官<br>严谨指出问题，给出可执行的修复建议<br>全栈工程师<br>聚焦代码生成、重构与单元测试<br>业务分析师<br>拆解需求、澄清问题、辅助决策<br>创意伙伴<br>头脑风暴、灵感发散、命名建议<br>产品需求拆解<br>将模糊需求拆解为可执行任务清单<br>选择一个模板以快速填充系统提示词，可继续编辑<br>系统提示词<br>0/2000<br>补充角色边界、输出格式或工具调用规则...<br>插入思维链<br>JSON 输出<br>工具调用<br>清空<br>创建并部署 |
| V2-07-02 平台选择 - Claude Code | FAIL | expectedFormVisible=true; realModelListOrCapabilities=false; text=新建智能体<br>基础信息<br>智能体名称 *<br>例如：QA 质量保证<br>0/40<br>@ 别名<br>@<br>QA<br>用于在会话中通过 @ 触发该智能体<br>一句话介绍<br>发布前再慌也保持冷静，负责自动化测试、回归验证与质量门禁。<br>0/200<br>角色与能力<br>角色模板<br>布偶猫（架构师）<br>架构设计、写代码一把好手<br>能力标签<br>添加标签后按回车<br>最多添加 8 个能力标签，便于在智能体库中检索<br>模型设置<br>运行平台<br>Codex<br>Claude Code<br>接入方式<br>API Key<br>OAuth<br>模型<br>自定义<br>账号引用<br>提示词模板<br>管理模板<br>代码审查官<br>严谨指出问题，给出可执行的修复建议<br>全栈工程师<br>聚焦代码生成、重构与单元测试<br>业务分析师<br>拆解需求、澄清问题、辅助决策<br>创意伙伴<br>头脑风暴、灵感发散、命名建议<br>产品需求拆解<br>将模糊需求拆解为可执行任务清单<br>选择一个模板以快速填充系统提示词，可继续编辑<br>系统提示词<br>0/2000<br>补充角色边界、输出格式或工具调用规则...<br>插入思维链<br>JSON 输出<br>工具调用<br>清空<br>创建并部署 |
| V2-07-03 OAuth 失败降级 | FAIL | expectedFormVisible=true; realModelListOrCapabilities=false; text=新建智能体<br>基础信息<br>智能体名称 *<br>例如：QA 质量保证<br>0/40<br>@ 别名<br>@<br>QA<br>用于在会话中通过 @ 触发该智能体<br>一句话介绍<br>发布前再慌也保持冷静，负责自动化测试、回归验证与质量门禁。<br>0/200<br>角色与能力<br>角色模板<br>布偶猫（架构师）<br>架构设计、写代码一把好手<br>能力标签<br>添加标签后按回车<br>最多添加 8 个能力标签，便于在智能体库中检索<br>模型设置<br>运行平台<br>Codex<br>Claude Code<br>接入方式<br>API Key<br>OAuth<br>模型<br>自定义<br>账号引用<br>提示词模板<br>管理模板<br>代码审查官<br>严谨指出问题，给出可执行的修复建议<br>全栈工程师<br>聚焦代码生成、重构与单元测试<br>业务分析师<br>拆解需求、澄清问题、辅助决策<br>创意伙伴<br>头脑风暴、灵感发散、命名建议<br>产品需求拆解<br>将模糊需求拆解为可执行任务清单<br>选择一个模板以快速填充系统提示词，可继续编辑<br>系统提示词<br>0/2000<br>补充角色边界、输出格式或工具调用规则...<br>插入思维链<br>JSON 输出<br>工具调用<br>清空<br>创建并部署 |
| V2-07-04 模型下拉 | FAIL | expectedFormVisible=true; realModelListOrCapabilities=false; text=新建智能体<br>基础信息<br>智能体名称 *<br>例如：QA 质量保证<br>0/40<br>@ 别名<br>@<br>QA<br>用于在会话中通过 @ 触发该智能体<br>一句话介绍<br>发布前再慌也保持冷静，负责自动化测试、回归验证与质量门禁。<br>0/200<br>角色与能力<br>角色模板<br>布偶猫（架构师）<br>架构设计、写代码一把好手<br>能力标签<br>添加标签后按回车<br>最多添加 8 个能力标签，便于在智能体库中检索<br>模型设置<br>运行平台<br>Codex<br>Claude Code<br>接入方式<br>API Key<br>OAuth<br>模型<br>自定义<br>账号引用<br>提示词模板<br>管理模板<br>代码审查官<br>严谨指出问题，给出可执行的修复建议<br>全栈工程师<br>聚焦代码生成、重构与单元测试<br>业务分析师<br>拆解需求、澄清问题、辅助决策<br>创意伙伴<br>头脑风暴、灵感发散、命名建议<br>产品需求拆解<br>将模糊需求拆解为可执行任务清单<br>选择一个模板以快速填充系统提示词，可继续编辑<br>系统提示词<br>0/2000<br>补充角色边界、输出格式或工具调用规则...<br>插入思维链<br>JSON 输出<br>工具调用<br>清空<br>创建并部署 |
| V2-07-05 API Key 创建 | FAIL | expectedFormVisible=false; realModelListOrCapabilities=false; text=智能体<br>管理并与 AI 协作<br>我的技能<br>已拥有 160 项技能<br>feat-lifecycle<br>Feature 立项、讨论、完成的全生命周期管理。 Use when: 开个新功能、new feature、F0xx、立项、feature 完成、验收通过、讨论新功能需求。 Not for: 代码实现、review、merge（那些有专门的 skill）。 Output: Feature 聚合文件 + BACKLOG 索引 + 真相源同步。<br>开发流程链<br>未绑定<br>guide-authoring<br>标准引导流程设计 SOP：场景识别 → YAML 编排 → 标签标注 → 注册发现 → 测试验证。 Use when: 新建引导流程、添加场景引导、维护 Guide Catalog、编写引导 YAML。 Not for: 使用引导（用户侧）、Guide Engine 代码实现（用 tdd）、视觉设计（用 pencil-design）。 Output: Flow YAML + tag-manifest 更新 + registry 注册 + CI 校验通过。<br>开发流程链<br>未绑定<br>guide-interaction<br>场景引导交互模式：用户明确在问某项功能怎么做时，先判断该直接解释还是进入交互引导； 系统注入了 Guide Matched / Guide Pending / Guide Selection / Guide Active / Guide Completed 时， 按状态驱动回复并使用对应 guide MCP 工具。 Use when: 系统注入了上述 guide 状态，或用户明确在问某项功能怎么操作。 Not for: 普通闲聊、代码实现、没有流程诉求的概念讨论。 Output: guide 目录判断 + 交互选择卡片 + 状态持久化 + 前端引导启动。<br>开发流程链<br>未绑定<br>collaborative-thinking<br>单人或多猫的创意探索、独立思考、讨论收敛。 Use when: brainstorm、多猫独立思考、讨论结束需要收敛、方向性问题需 |
| V2-07-06 OAuth 创建 | FAIL | expectedFormVisible=true; realModelListOrCapabilities=false; text=新建智能体<br>基础信息<br>智能体名称 *<br>例如：QA 质量保证<br>0/40<br>@ 别名<br>@<br>QA<br>用于在会话中通过 @ 触发该智能体<br>一句话介绍<br>发布前再慌也保持冷静，负责自动化测试、回归验证与质量门禁。<br>0/200<br>角色与能力<br>角色模板<br>布偶猫（架构师）<br>架构设计、写代码一把好手<br>能力标签<br>添加标签后按回车<br>最多添加 8 个能力标签，便于在智能体库中检索<br>模型设置<br>运行平台<br>Codex<br>Claude Code<br>接入方式<br>API Key<br>OAuth<br>模型<br>claude-sonnet-4-6<br>账号引用<br>提示词模板<br>管理模板<br>代码审查官<br>严谨指出问题，给出可执行的修复建议<br>全栈工程师<br>聚焦代码生成、重构与单元测试<br>业务分析师<br>拆解需求、澄清问题、辅助决策<br>创意伙伴<br>头脑风暴、灵感发散、命名建议<br>产品需求拆解<br>将模糊需求拆解为可执行任务清单<br>选择一个模板以快速填充系统提示词，可继续编辑<br>系统提示词<br>0/2000<br>补充角色边界、输出格式或工具调用规则...<br>插入思维链<br>JSON 输出<br>工具调用<br>清空<br>创建并部署 |
| V2-07-07 mention patterns | FAIL | expectedFormVisible=true; realModelListOrCapabilities=false; text=新建智能体<br>基础信息<br>智能体名称 *<br>例如：QA 质量保证<br>0/40<br>@ 别名<br>@<br>QA<br>用于在会话中通过 @ 触发该智能体<br>一句话介绍<br>发布前再慌也保持冷静，负责自动化测试、回归验证与质量门禁。<br>0/200<br>角色与能力<br>角色模板<br>布偶猫（架构师）<br>架构设计、写代码一把好手<br>能力标签<br>添加标签后按回车<br>最多添加 8 个能力标签，便于在智能体库中检索<br>模型设置<br>运行平台<br>Codex<br>Claude Code<br>接入方式<br>API Key<br>OAuth<br>模型<br>claude-sonnet-4-6<br>账号引用<br>提示词模板<br>管理模板<br>代码审查官<br>严谨指出问题，给出可执行的修复建议<br>全栈工程师<br>聚焦代码生成、重构与单元测试<br>业务分析师<br>拆解需求、澄清问题、辅助决策<br>创意伙伴<br>头脑风暴、灵感发散、命名建议<br>产品需求拆解<br>将模糊需求拆解为可执行任务清单<br>选择一个模板以快速填充系统提示词，可继续编辑<br>系统提示词<br>0/2000<br>补充角色边界、输出格式或工具调用规则...<br>插入思维链<br>JSON 输出<br>工具调用<br>清空<br>创建并部署 |
| V2-07-08 失败态 | FAIL | expectedFormVisible=false; realModelListOrCapabilities=false; text=智能体<br>管理并与 AI 协作<br>我的技能<br>已拥有 160 项技能<br>feat-lifecycle<br>Feature 立项、讨论、完成的全生命周期管理。 Use when: 开个新功能、new feature、F0xx、立项、feature 完成、验收通过、讨论新功能需求。 Not for: 代码实现、review、merge（那些有专门的 skill）。 Output: Feature 聚合文件 + BACKLOG 索引 + 真相源同步。<br>开发流程链<br>未绑定<br>guide-authoring<br>标准引导流程设计 SOP：场景识别 → YAML 编排 → 标签标注 → 注册发现 → 测试验证。 Use when: 新建引导流程、添加场景引导、维护 Guide Catalog、编写引导 YAML。 Not for: 使用引导（用户侧）、Guide Engine 代码实现（用 tdd）、视觉设计（用 pencil-design）。 Output: Flow YAML + tag-manifest 更新 + registry 注册 + CI 校验通过。<br>开发流程链<br>未绑定<br>guide-interaction<br>场景引导交互模式：用户明确在问某项功能怎么做时，先判断该直接解释还是进入交互引导； 系统注入了 Guide Matched / Guide Pending / Guide Selection / Guide Active / Guide Completed 时， 按状态驱动回复并使用对应 guide MCP 工具。 Use when: 系统注入了上述 guide 状态，或用户明确在问某项功能怎么操作。 Not for: 普通闲聊、代码实现、没有流程诉求的概念讨论。 Output: guide 目录判断 + 交互选择卡片 + 状态持久化 + 前端引导启动。<br>开发流程链<br>未绑定<br>collaborative-thinking<br>单人或多猫的创意探索、独立思考、讨论收敛。 Use when: brainstorm、多猫独立思考、讨论结束需要收敛、方向性问题需 |
| V2-07-09 skill 模板 | FAIL | expectedFormVisible=true; realModelListOrCapabilities=false; text=新建智能体<br>基础信息<br>智能体名称 *<br>例如：QA 质量保证<br>0/40<br>@ 别名<br>@<br>QA<br>用于在会话中通过 @ 触发该智能体<br>一句话介绍<br>发布前再慌也保持冷静，负责自动化测试、回归验证与质量门禁。<br>0/200<br>角色与能力<br>角色模板<br>布偶猫（架构师）<br>架构设计、写代码一把好手<br>能力标签<br>添加标签后按回车<br>最多添加 8 个能力标签，便于在智能体库中检索<br>模型设置<br>运行平台<br>Codex<br>Claude Code<br>接入方式<br>API Key<br>OAuth<br>模型<br>claude-sonnet-4-6<br>账号引用<br>提示词模板<br>管理模板<br>代码审查官<br>严谨指出问题，给出可执行的修复建议<br>全栈工程师<br>聚焦代码生成、重构与单元测试<br>业务分析师<br>拆解需求、澄清问题、辅助决策<br>创意伙伴<br>头脑风暴、灵感发散、命名建议<br>产品需求拆解<br>将模糊需求拆解为可执行任务清单<br>选择一个模板以快速填充系统提示词，可继续编辑<br>系统提示词<br>0/2000<br>补充角色边界、输出格式或工具调用规则...<br>插入思维链<br>JSON 输出<br>工具调用<br>清空<br>创建并部署<br><br>智能体已部署 |
| V2-07-10 avatar 上传 | FAIL | expectedFormVisible=true; realModelListOrCapabilities=false; text=新建智能体<br>基础信息<br>智能体名称 *<br>例如：QA 质量保证<br>0/40<br>@ 别名<br>@<br>QA<br>用于在会话中通过 @ 触发该智能体<br>一句话介绍<br>发布前再慌也保持冷静，负责自动化测试、回归验证与质量门禁。<br>0/200<br>角色与能力<br>角色模板<br>布偶猫（架构师）<br>架构设计、写代码一把好手<br>能力标签<br>添加标签后按回车<br>最多添加 8 个能力标签，便于在智能体库中检索<br>模型设置<br>运行平台<br>Codex<br>Claude Code<br>接入方式<br>API Key<br>OAuth<br>模型<br>claude-sonnet-4-6<br>账号引用<br>提示词模板<br>管理模板<br>代码审查官<br>严谨指出问题，给出可执行的修复建议<br>全栈工程师<br>聚焦代码生成、重构与单元测试<br>业务分析师<br>拆解需求、澄清问题、辅助决策<br>创意伙伴<br>头脑风暴、灵感发散、命名建议<br>产品需求拆解<br>将模糊需求拆解为可执行任务清单<br>选择一个模板以快速填充系统提示词，可继续编辑<br>系统提示词<br>0/2000<br>补充角色边界、输出格式或工具调用规则...<br>插入思维链<br>JSON 输出<br>工具调用<br>清空<br>创建并部署 |

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
