import { createCatId } from '@cat-cafe/shared';
import type { CatId, CoordinationContext, LeadSelection } from '@cat-cafe/shared';

export const COORDINATOR_CAT_ID = createCatId('coordinator');

function uniqueCatIds(catIds: readonly CatId[]): CatId[] {
  const out: CatId[] = [];
  const seen = new Set<string>();
  for (const catId of catIds) {
    const key = catId as string;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(catId);
  }
  return out;
}

function firstOrCoordinator(catIds: readonly CatId[]): CatId {
  return catIds[0] ?? COORDINATOR_CAT_ID;
}

export function selectLeadAgent(input: {
  resolvedCatIds: readonly CatId[];
  explicitMentionCatIds: readonly CatId[];
  coordinatorAvailable: boolean;
}): LeadSelection {
  const resolved = uniqueCatIds(input.resolvedCatIds);
  const explicit = uniqueCatIds(input.explicitMentionCatIds);

  if (!input.coordinatorAvailable) {
    return {
      leadCatId: firstOrCoordinator(resolved),
      participantCatIds: resolved.slice(1),
      mode: 'direct',
      reason: 'coordinator_unavailable',
    };
  }

  const explicitMentionsCoordinator = explicit.some((catId) => catId === COORDINATOR_CAT_ID);
  if (explicit.length === 0) {
    return {
      leadCatId: COORDINATOR_CAT_ID,
      participantCatIds: [],
      mode: 'coordinator',
      reason: 'no_mention',
    };
  }

  if (explicitMentionsCoordinator) {
    return {
      leadCatId: COORDINATOR_CAT_ID,
      participantCatIds: explicit.filter((catId) => catId !== COORDINATOR_CAT_ID),
      mode: 'coordinator',
      reason: 'explicit_coordinator',
    };
  }

  if (explicit.length > 1) {
    return {
      leadCatId: COORDINATOR_CAT_ID,
      participantCatIds: explicit,
      mode: 'coordinator',
      reason: 'multi_mention',
    };
  }

  return {
    leadCatId: explicit[0]!,
    participantCatIds: [],
    mode: 'direct',
    reason: 'direct_mention',
  };
}

export function targetCatsForLeadSelection(selection: LeadSelection, resolvedCatIds: readonly CatId[]): CatId[] {
  if (selection.mode === 'coordinator') return [selection.leadCatId];
  return uniqueCatIds(resolvedCatIds);
}

export function createCoordinationContext(selection: LeadSelection, id: string): CoordinationContext {
  return {
    id,
    leadCatId: selection.leadCatId,
    participantCatIds: uniqueCatIds(selection.participantCatIds),
    phase: 'intake',
    artifactRefs: [],
  };
}

export function coordinationAuditCatIds(coordination: CoordinationContext): CatId[] {
  return uniqueCatIds([coordination.leadCatId, ...coordination.participantCatIds]);
}

export function buildCoordinatorDispatchMessage(message: string, coordination: CoordinationContext): string {
  const participantList =
    coordination.participantCatIds.length > 0
      ? coordination.participantCatIds.map((catId) => `@${catId}`).join(', ')
      : 'none';

  return [
    '<coordination_context>',
    `coordinationId: ${coordination.id}`,
    `leadCatId: @${coordination.leadCatId}`,
    `participantCatIds: ${participantList}`,
    '',
    '你是显性 PM 协调者。本轮职责：',
    '1. 先给出需求理解、任务拆解、计划和交付口径。',
    '2. 需要跨轮跟踪时，调用 cat_cafe_create_task 创建或更新毛线球，并携带 coordinationId；子任务用 dependsOn / artifactRefs 保留链路。',
    '3. 需要并行协作时，用 cat_cafe_multi_mention 拉 1-3 个最相关 Agent；优先考虑 participantCatIds，但不要超过安全上限。',
    '4. 高风险操作必须走 permission flow；冲突时汇总分歧、给出裁决依据，必要时请求用户确认。',
    '5. 聚合结果并给出产物入口；代码/网页走 Workspace 文件、Preview、Git/Changes，文档走 generate_document 或 rich block。',
    '6. **项目群聊推荐（首条 intake 回复时使用）**：如果你认为用户需求适合多人协作完成一个持续性项目,在回复末尾追加一个 JSON 块:',
    '   ```cat-recommendation',
    '   { "suggested_cats": ["<cat-id-1>", "<cat-id-2>"], "reason": "<用一句话告诉用户为什么叫这些猫>" }',
    '   ```',
    '   - suggested_cats 从 cat-catalog 里挑 1-3 只(系统硬上限 `MAX_MULTI_MENTION_TARGETS=3`),优先用其 strengths 匹配需求关键词;',
    '   - 如果只是闲聊 / 单猫可解,输出 `{ "suggested_cats": [] }`(空数组也算合规,前端不显示卡片);',
    '   - reason 用中文,简洁一句,例如 `需要 backend + frontend 一起协作`。',
    '7. **产物声明（任何产出文件时使用）**：猫产出文件后,必须用 cat_cafe_declare_artifact 工具声明(`path` 相对 thread.projectPath,`kind` ∈ code/doc/image/preview/other)。',
    '   写一段代码 → 立即声明、写一份文档 → 立即声明。未声明的文件不会出现在产物面板(用户看不到)。',
    '</coordination_context>',
    '',
    '用户原始需求：',
    message,
  ].join('\n');
}
