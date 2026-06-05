import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('CoordinatorPlanner', () => {
  test('builds deterministic deployment plan with QA and publish subtasks', async () => {
    const { buildDeterministicCoordinatorPlan } = await import(
      '../dist/domains/cats/services/agents/routing/CoordinatorPlanner.js'
    );

    const plan = buildDeterministicCoordinatorPlan({
      goal: '实现一个餐厅落地页，检查可访问性，然后部署到 preview 环境',
      requestedCatIds: ['claude-dev', 'codex-qa'],
      activeWorkspace: '/tmp/workspace',
      recentArtifacts: ['index.html'],
    });

    assert.equal(plan.dispatchMode, 'mixed');
    assert.deepEqual(plan.targetCatIds, ['claude-dev', 'codex-qa']);
    assert.ok(plan.assumptions.includes('multi_agent_dispatch'));
    assert.ok(plan.subtasks.some((task) => task.title.includes('部署准备')));
    assert.ok(plan.subtasks.some((task) => task.targetCatId === 'codex-qa'));
  });

  test('detects repeated response paths as potential conflicts', async () => {
    const { detectPotentialPathConflicts } = await import(
      '../dist/domains/cats/services/agents/routing/CoordinatorAggregator.js'
    );

    assert.deepEqual(
      detectPotentialPathConflicts(['我会修改 src/App.vue', '检查结果也涉及 src/App.vue 和 README.md']),
      ['src/App.vue'],
    );
  });
});
