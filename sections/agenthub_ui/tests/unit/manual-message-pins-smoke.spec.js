import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const smokePath = path.resolve(__dirname, '../../.ai/tests/manual-message-pins-smoke.mjs');
const smokeSource = fs.readFileSync(smokePath, 'utf8');
const panelPath = path.resolve(__dirname, '../../components/chat/PinnedContextPanel.vue');
const panelSource = fs.readFileSync(panelPath, 'utf8');

describe('manual message pins smoke script contract', () => {
  it('captures every Task 7 evidence artifact and critical live step', () => {
    [
      '01-menu-pin.png',
      '02-badge-after-pin.png',
      '03-refresh-pin-list.png',
      '04-briefing-manual-pin.png',
      '05-unpin-removed.png',
      '06-degraded-source-deleted.png',
      'diagnostics.log',
      'network.json'
    ].forEach((artifact) => {
      expect(smokeSource).toContain(artifact);
    });

    [
      'loginApi',
      'createProjectGroup',
      'triggerCatInvocation',
      'assertBriefingIncludesManualPin',
      'assertBriefingOmitsManualPin',
      'markManualPinSourceDeleted',
      '来源已删除'
    ].forEach((step) => {
      expect(smokeSource).toContain(step);
    });
  });

  it('lets the pinned context panel surface Clowder degraded source status', () => {
    [
      'useClowderStore',
      'listManualContextPins(props.threadId, { includeInactive: true })',
      'clowderStore.manualContextPins[props.threadId]',
      'clowderPinFor',
      'pinStatus',
      'source_deleted',
      '来源已删除'
    ].forEach((contract) => {
      expect(panelSource).toContain(contract);
    });
  });
});
