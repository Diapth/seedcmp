import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  clowderReplyCount,
  env,
  expectCommandResponse,
  login,
  openClowderAiConversation,
  runId,
  sendChatMessage,
  waitForNewClowderReply,
} from './helpers/v3-clowder';

test.describe('V3 Clowder ragdoll matplotlib image smoke', () => {
  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires runnable IM Web, TangSeng bridge, Clowder API, a DeepSeek-backed 布偶猫 cat, Python, and matplotlib.',
  );

  test.setTimeout(240000);

  test('asks 布偶猫 to generate and send a y = sin(x) matplotlib image', async ({ page }) => {
    const id = runId('v3-ragdoll-sinx');
    const outputDir = path.resolve(process.cwd(), '../../.ai/V3.0/tests-e2e', id);
    await mkdir(outputDir, { recursive: true });

    const ragdollMention = env('TEST_RAGDOLL_AGENT', '@布偶猫');
    const focusTarget = env('TEST_RAGDOLL_FOCUS', 'ragdoll-kn9a');
    const prompt = env(
      'TEST_RAGDOLL_MATPLOTLIB_PROMPT',
      `${ragdollMention} ${id} 请使用 Python 的 matplotlib 生成 y = sin(x) 的函数图像，保存为 PNG 图片，并通过聊天框发送出来。图片标题包含 "y = sin(x)"，横轴标注 x，纵轴标注 y。不要只给代码。`,
    );

    const failures: string[] = [];
    page.on('pageerror', err => failures.push(`pageerror: ${err.message}`));
    page.on('requestfailed', req => {
      const failureText = req.failure()?.errorText ?? 'unknown';
      if (failureText !== 'net::ERR_ABORTED') {
        failures.push(`requestfailed: ${req.method()} ${req.url()} ${failureText}`);
      }
    });

    await login(page);
    await openClowderAiConversation(page);
    await page.screenshot({ path: path.join(outputDir, '01-clowder-ai-open.png'), fullPage: true });

    await sendChatMessage(page, `/new ${id} matplotlib-sine`);
    await expectCommandResponse(page, /new|created|thread|创建|已创建|已切换/i);
    await page.screenshot({ path: path.join(outputDir, '02-thread-created.png'), fullPage: true });

    await sendChatMessage(page, `/focus ${focusTarget}`);
    await expectCommandResponse(page, /focus|preferred|current|已聚焦|已设置|切换|布偶|ragdoll/i);
    await page.screenshot({ path: path.join(outputDir, '03-ragdoll-focused.png'), fullPage: true });

    const nativeImageEvidence = page.locator(
      '.message-list .image-cell img.bubble-image, .message-list .file-cell, .message-list a[href*=".png"], .message-list a[href*="file/preview"]',
    );
    const richImageEvidence = page.locator('.message-list').getByText(/富内容|rich content|y = sin\(x\) 函数图像/i);
    const evidenceCount = async () => (await nativeImageEvidence.count()) + (await richImageEvidence.count());
    const beforeReplyCount = await clowderReplyCount(page);
    const imageLoadPromise = page.waitForResponse(response => {
      if (response.status() !== 200) return false;
      const url = response.url();
      return /\/uploads\/.*\.(png|jpe?g|gif|webp)(?:[?#].*)?$/i.test(url);
    }, { timeout: 180000 }).catch(() => null);
    await sendChatMessage(page, prompt);
    await expect(page.locator('.message-list').getByText(prompt, { exact: true }).last()).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({ path: path.join(outputDir, '04-prompt-visible.png'), fullPage: true });

    await waitForNewClowderReply(page, beforeReplyCount, 180000);
    const imageResponse = await imageLoadPromise;
    expect(imageResponse, 'generated matplotlib PNG should load through /uploads in the remote browser').not.toBeNull();
    await expect(page.locator('.message-list')).toContainText(/sin|正弦|matplotlib|png|图片|图像/i, {
      timeout: 60000,
    });

    const imageCell = page.locator('.message-list .image-cell button[title="预览图片"]').last();
    if (await imageCell.isVisible().catch(() => false)) {
      await imageCell.click();
      await expect(page.locator('.image-lightbox').first()).toBeVisible({
        timeout: 15000,
      });
    }

    await page.screenshot({ path: path.join(outputDir, '05-sinx-image-delivered.png'), fullPage: true });
    const result = {
      runId: id,
      prompt,
      ragdollMention,
      focusTarget,
      clowderReplies: await clowderReplyCount(page),
      imageEvidenceCount: await evidenceCount(),
      nativeImageEvidenceCount: await nativeImageEvidence.count(),
      richImageEvidenceCount: await richImageEvidence.count(),
      loadedImageUrl: imageResponse?.url() ?? null,
      failures,
      url: page.url(),
      recordedAt: new Date().toISOString(),
    };
    await writeFile(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
  });
});
