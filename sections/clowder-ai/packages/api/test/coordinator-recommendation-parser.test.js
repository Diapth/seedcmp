import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('parseCoordinatorRecommendation', () => {
  test('extracts a valid cat-recommendation block', async () => {
    const { parseCoordinatorRecommendation, hasCoordinatorRecommendation } = await import(
      '../dist/domains/cats/services/agents/routing/coordinator-recommendation-parser.js'
    );
    const text = [
      '好的,我来协调一下。',
      '```cat-recommendation',
      '{ "suggested_cats": ["opus", "codex"], "reason": "需要 backend + frontend 一起协作" }',
      '```',
      '下面我先拆任务。',
    ].join('\n');
    assert.equal(hasCoordinatorRecommendation(text), true);
    const rec = parseCoordinatorRecommendation(text);
    assert.deepEqual(rec.suggestedCats, ['opus', 'codex']);
    assert.equal(rec.reason, '需要 backend + frontend 一起协作');
  });

  test('returns empty suggestion when no block is present', async () => {
    const { parseCoordinatorRecommendation, hasCoordinatorRecommendation } = await import(
      '../dist/domains/cats/services/agents/routing/coordinator-recommendation-parser.js'
    );
    const text = '这只是一条普通消息,没有推荐块。';
    assert.equal(hasCoordinatorRecommendation(text), false);
    const rec = parseCoordinatorRecommendation(text);
    assert.deepEqual(rec.suggestedCats, []);
    assert.equal(rec.reason, undefined);
  });

  test('returns empty suggestion when JSON is malformed (no throw)', async () => {
    const { parseCoordinatorRecommendation, hasCoordinatorRecommendation } = await import(
      '../dist/domains/cats/services/agents/routing/coordinator-recommendation-parser.js'
    );
    const text = '```cat-recommendation\n{ this is not valid json }\n```';
    assert.equal(hasCoordinatorRecommendation(text), true);
    const rec = parseCoordinatorRecommendation(text);
    assert.deepEqual(rec.suggestedCats, []);
  });

  test('returns empty suggestion when suggested_cats is missing or not an array', async () => {
    const { parseCoordinatorRecommendation } = await import(
      '../dist/domains/cats/services/agents/routing/coordinator-recommendation-parser.js'
    );
    const text1 = '```cat-recommendation\n{ "reason": "no cats" }\n```';
    const text2 = '```cat-recommendation\n{ "suggested_cats": "opus" }\n```';
    assert.deepEqual(parseCoordinatorRecommendation(text1).suggestedCats, []);
    assert.deepEqual(parseCoordinatorRecommendation(text2).suggestedCats, []);
  });

  test('deduplicates and trims cat IDs', async () => {
    const { parseCoordinatorRecommendation } = await import(
      '../dist/domains/cats/services/agents/routing/coordinator-recommendation-parser.js'
    );
    const text = '```cat-recommendation\n{ "suggested_cats": ["opus", "opus", "  codex  ", "", 42] }\n```';
    const rec = parseCoordinatorRecommendation(text);
    assert.deepEqual(rec.suggestedCats, ['opus', 'codex']);
  });

  test('handles empty string input safely', async () => {
    const { parseCoordinatorRecommendation, hasCoordinatorRecommendation } = await import(
      '../dist/domains/cats/services/agents/routing/coordinator-recommendation-parser.js'
    );
    assert.equal(hasCoordinatorRecommendation(''), false);
    assert.deepEqual(parseCoordinatorRecommendation('').suggestedCats, []);
  });
});
