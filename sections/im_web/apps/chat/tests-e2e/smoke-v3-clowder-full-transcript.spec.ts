import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  clowderReplyCount,
  env,
  login,
  runId,
  sendChatMessage,
  waitForNewClowderReply,
} from './helpers/v3-clowder';

async function openClowderAiConversation(page: import('@playwright/test').Page) {
  await page.goto('/chat/conversation/clowder_ai/1');
  await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.message-list')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.clowder-contact-panel')).toContainText(/Clowder AI|Clowder 联系人/i, {
    timeout: 10000,
  });
}

test.describe('V3 Clowder full transcript smoke', () => {
  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires runnable IM Web, TangSeng bridge, Clowder API, DeepSeek-backed Claude Code cat, and browser accounts.',
  );

  test.setTimeout(180000);

  test('shows user prompt, Clowder transcript parts, and final news summary', async ({ page }) => {
    const id = runId('v3-full-transcript');
    const outputDir = path.resolve(process.cwd(), '../../.ai/V3.0/tests-e2e', id);
    await mkdir(outputDir, { recursive: true });

    const agent = env('TEST_AGENT_A', 'codex').replace(/^@/, '');
    const optionalConfigCommand = env('TEST_CLOWDER_CONFIG_COMMAND');
    const focusCommand = env('TEST_CLOWDER_FOCUS_COMMAND', agent ? `/focus ${agent}` : '/status');
    const prompt = env('TEST_CLOWDER_NEWS_PROMPT', `@${agent} ${id} 整理一下今天的新闻`);

    const failures: string[] = [];
    page.on('pageerror', err => failures.push(`pageerror: ${err.message}`));
    page.on('requestfailed', req => failures.push(`requestfailed: ${req.method()} ${req.url()} ${req.failure()?.errorText}`));

    await login(page);
    await openClowderAiConversation(page);
    await page.screenshot({ path: path.join(outputDir, '01-clowder-ai-open.png'), fullPage: true });

    if (optionalConfigCommand) {
      await sendChatMessage(page, optionalConfigCommand.replace(/\{runId\}/g, id));
      await page.screenshot({ path: path.join(outputDir, '02-after-config-command.png'), fullPage: true });
    }

    await sendChatMessage(page, focusCommand.replace(/\{runId\}/g, id));
    await page.screenshot({ path: path.join(outputDir, '03-after-focus-command.png'), fullPage: true });

    const beforeReplyCount = await clowderReplyCount(page);
    await sendChatMessage(page, prompt);
    await expect(page.locator('.message-list').getByText(prompt, { exact: true }).last()).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({ path: path.join(outputDir, '04-news-prompt-visible.png'), fullPage: true });

    await waitForNewClowderReply(page, beforeReplyCount, 120000);
    await expect(page.locator('.message-list .clowder-meta').last()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.message-list')).toContainText(/新闻|今日|today|summary|整理/i, {
      timeout: 30000,
    });

    const transcriptLocator = page.locator(
      '.message-list .clowder-thought, .message-list .clowder-tool-call, .message-list .clowder-tool-result, .message-list .clowder-rich-block',
    );
    await expect(transcriptLocator.first()).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: path.join(outputDir, '05-full-transcript-reply.png'), fullPage: true });

    const result = {
      runId: id,
      prompt,
      agent,
      optionalConfigCommand,
      focusCommand,
      clowderReplies: await clowderReplyCount(page),
      transcriptParts: await transcriptLocator.count(),
      failures,
      url: page.url(),
      recordedAt: new Date().toISOString(),
    };
    await writeFile(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
  });
});
