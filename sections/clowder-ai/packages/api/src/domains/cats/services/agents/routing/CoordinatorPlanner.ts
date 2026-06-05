import type { CatId } from '@cat-cafe/shared';
import type {
  CoordinationDispatchMode,
  CoordinationSubtask,
} from '../../stores/ports/CoordinatorStore.js';

export interface CoordinatorPlanInput {
  goal: string;
  requestedCatIds?: readonly CatId[] | undefined;
  availableCatIds?: readonly CatId[] | undefined;
  recentArtifacts?: readonly string[] | undefined;
  activeWorkspace?: string | undefined;
}

export interface CoordinatorPlan {
  goal: string;
  assumptions: string[];
  targetCatIds: string[];
  dispatchMode: CoordinationDispatchMode;
  subtasks: Array<Partial<CoordinationSubtask> & { title: string }>;
}

const DEPLOYMENT_RE = /(部署|发布|预览|preview|deploy|release|打包|下载源码)/i;
const QA_RE = /(测试|验收|可访问性|accessibility|风险|review|检查|qa)/i;

function uniqueStrings(values: readonly unknown[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values ?? []) {
    const text = String(value ?? '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function includesCat(cats: readonly string[], candidate: string): boolean {
  return cats.some((cat) => cat.toLowerCase() === candidate.toLowerCase());
}

export function buildDeterministicCoordinatorPlan(input: CoordinatorPlanInput): CoordinatorPlan {
  const available = uniqueStrings(input.availableCatIds);
  const requested = uniqueStrings(input.requestedCatIds);
  const targetCatIds = requested.length > 0 ? requested : chooseFallbackCats(input.goal, available);
  const deployRequested = DEPLOYMENT_RE.test(input.goal);
  const qaRequested = QA_RE.test(input.goal) || deployRequested;

  const assumptions = [
    'deterministic_fallback_plan',
    targetCatIds.length > 1 ? 'multi_agent_dispatch' : 'single_agent_dispatch',
    ...(input.activeWorkspace ? [`activeWorkspace:${input.activeWorkspace}`] : []),
    ...(input.recentArtifacts?.length ? [`recentArtifacts:${input.recentArtifacts.slice(0, 5).join(',')}`] : []),
  ];

  const primaryCatId = targetCatIds[0];
  const qaCatId = targetCatIds.find((cat) => /codex|qa|test|review/i.test(cat)) ?? targetCatIds[1] ?? primaryCatId;
  const dispatchMode: CoordinationDispatchMode =
    targetCatIds.length > 1 ? (deployRequested ? 'mixed' : 'parallel') : 'serial';

  const subtasks: Array<Partial<CoordinationSubtask> & { title: string }> = [
    {
      title: '需求拆解与验收标准',
      description: '确认目标、范围、交付物和验收口径。',
      targetCatId: primaryCatId,
      status: 'todo',
    },
    {
      title: '实现主要产物',
      description: '按需求产出页面、代码或文档，并声明 artifact。',
      targetCatId: primaryCatId,
      status: 'todo',
    },
  ];

  if (qaRequested) {
    subtasks.push({
      title: deployRequested ? '部署风险与可访问性检查' : '测试与风险检查',
      description: '检查可访问性、部署前置条件、冲突路径和失败降级方案。',
      targetCatId: qaCatId,
      status: 'todo',
    });
  }

  if (deployRequested) {
    subtasks.push({
      title: '部署准备与发布确认',
      description: '确认 target/environment，准备 preview 或源码包发布。',
      targetCatId: qaCatId,
      status: 'todo',
    });
  }

  return {
    goal: input.goal.trim(),
    assumptions,
    targetCatIds,
    dispatchMode,
    subtasks,
  };
}

function chooseFallbackCats(goal: string, available: readonly string[]): string[] {
  if (available.length === 0) return [];
  const preferred: string[] = [];
  if (/实现|代码|页面|html|frontend|前端|deploy|部署/i.test(goal)) {
    if (includesCat(available, 'claude')) preferred.push('claude');
    if (includesCat(available, 'codex')) preferred.push('codex');
  }
  if (/测试|检查|review|qa|风险|可访问性/i.test(goal) && includesCat(available, 'codex')) {
    preferred.push('codex');
  }
  return uniqueStrings([...preferred, ...available]).slice(0, 3);
}

