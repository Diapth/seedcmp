import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderAllRichBlocksPlaintext } from '../dist/infrastructure/connectors/rich-block-plaintext.js';

describe('rich block plaintext fallback', () => {
  it('renders supported and unsupported rich blocks into visible plaintext', () => {
    const text = renderAllRichBlocksPlaintext([
      { id: 'card-1', kind: 'card', v: 1, title: 'Plan', bodyMarkdown: 'Ship V3' },
      { id: 'diff-1', kind: 'diff', v: 1, filePath: 'app.ts', diff: '+done' },
      { id: 'unknown-1', kind: 'unknown-widget', v: 1 },
    ]);

    assert.match(text, /Plan/);
    assert.match(text, /Ship V3/);
    assert.match(text, /app\.ts/);
    assert.match(text, /\[unknown-widget\]/);
  });
});
