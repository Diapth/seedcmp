import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('LeadAgentSelector', () => {
  test('routes no-mention messages to coordinator when available', async () => {
    const { selectLeadAgent, targetCatsForLeadSelection } = await import(
      '../dist/domains/cats/services/agents/routing/lead-agent-selector.js'
    );
    const selection = selectLeadAgent({
      resolvedCatIds: ['opus'],
      explicitMentionCatIds: [],
      coordinatorAvailable: true,
    });

    assert.equal(selection.mode, 'coordinator');
    assert.equal(selection.reason, 'no_mention');
    assert.deepEqual(targetCatsForLeadSelection(selection, ['opus']), ['coordinator']);
  });

  test('keeps a single non-coordinator mention direct', async () => {
    const { selectLeadAgent, targetCatsForLeadSelection } = await import(
      '../dist/domains/cats/services/agents/routing/lead-agent-selector.js'
    );
    const selection = selectLeadAgent({
      resolvedCatIds: ['codex'],
      explicitMentionCatIds: ['codex'],
      coordinatorAvailable: true,
    });

    assert.equal(selection.mode, 'direct');
    assert.equal(selection.reason, 'direct_mention');
    assert.deepEqual(targetCatsForLeadSelection(selection, ['codex']), ['codex']);
  });

  test('routes complex single-mention work to coordinator with participant', async () => {
    const { selectLeadAgent, targetCatsForLeadSelection } = await import(
      '../dist/domains/cats/services/agents/routing/lead-agent-selector.js'
    );
    const selection = selectLeadAgent({
      resolvedCatIds: ['codex'],
      explicitMentionCatIds: ['codex'],
      coordinatorAvailable: true,
      message: '@codex 请实现并测试一个页面，然后部署到 preview 环境。',
    });

    assert.equal(selection.mode, 'coordinator');
    assert.equal(selection.reason, 'complex_task');
    assert.deepEqual(selection.participantCatIds, ['codex']);
    assert.deepEqual(targetCatsForLeadSelection(selection, ['codex']), ['coordinator']);
  });

  test('routes multi-mention messages to coordinator with participants', async () => {
    const { selectLeadAgent, targetCatsForLeadSelection } = await import(
      '../dist/domains/cats/services/agents/routing/lead-agent-selector.js'
    );
    const selection = selectLeadAgent({
      resolvedCatIds: ['opus', 'codex'],
      explicitMentionCatIds: ['opus', 'codex'],
      coordinatorAvailable: true,
    });

    assert.equal(selection.mode, 'coordinator');
    assert.equal(selection.reason, 'multi_mention');
    assert.deepEqual(selection.participantCatIds, ['opus', 'codex']);
    assert.deepEqual(targetCatsForLeadSelection(selection, ['opus', 'codex']), ['coordinator']);
  });

  test('routes explicit coordinator mentions to coordinator with mentioned participants', async () => {
    const { selectLeadAgent, targetCatsForLeadSelection } = await import(
      '../dist/domains/cats/services/agents/routing/lead-agent-selector.js'
    );
    const selection = selectLeadAgent({
      resolvedCatIds: ['coordinator', 'codex'],
      explicitMentionCatIds: ['coordinator', 'codex'],
      coordinatorAvailable: true,
    });

    assert.equal(selection.mode, 'coordinator');
    assert.equal(selection.reason, 'explicit_coordinator');
    assert.equal(selection.leadCatId, 'coordinator');
    assert.deepEqual(selection.participantCatIds, ['codex']);
    assert.deepEqual(targetCatsForLeadSelection(selection, ['coordinator', 'codex']), ['coordinator']);
  });

  test('falls back to legacy targets when coordinator is unavailable', async () => {
    const { selectLeadAgent, targetCatsForLeadSelection } = await import(
      '../dist/domains/cats/services/agents/routing/lead-agent-selector.js'
    );
    const selection = selectLeadAgent({
      resolvedCatIds: ['opus', 'codex'],
      explicitMentionCatIds: ['opus', 'codex'],
      coordinatorAvailable: false,
    });

    assert.equal(selection.mode, 'direct');
    assert.equal(selection.reason, 'coordinator_unavailable');
    assert.deepEqual(targetCatsForLeadSelection(selection, ['opus', 'codex']), ['opus', 'codex']);
  });
});
