import { expect, test } from '@playwright/test';
import {
  clowderThreadId,
  expectCommandResponse,
  login,
  openClowderPanel,
  openGroupConversation,
  runId,
  sendChatMessage,
} from './helpers/v3-clowder';

test.describe('V3 Clowder thread lifecycle command smoke', () => {
  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires runnable IM Web, Clowder bridge, and a group conversation with command permission.',
  );

  test('exercises /where, /new, /threads, /use, and /thread with visible command feedback', async ({ page }) => {
    const id = runId('v3-thread');
    await login(page);
    await openGroupConversation(page);

    await openClowderPanel(page);
    const initialThread = await clowderThreadId(page);

    await sendChatMessage(page, '/where');
    await expectCommandResponse(page, /where|current|thread|当前|绑定|Not bound/i);

    await sendChatMessage(page, `/new ${id} lifecycle`);
    await expectCommandResponse(page, /new|created|thread|创建|已创建|已切换/i);
    await openClowderPanel(page);
    const createdThread = await clowderThreadId(page);
    expect(createdThread).toBeTruthy();

    await sendChatMessage(page, '/threads');
    await expectCommandResponse(page, /threads|recent|available|线程|列表/i);

    const useRef = process.env.TEST_CLOWDER_THREAD_REF || createdThread || initialThread;
    test.skip(!useRef || useRef === 'Not bound', 'No usable thread ref is available for /use and /thread smoke.');

    await sendChatMessage(page, `/use ${useRef}`);
    await expectCommandResponse(page, /use|switched|active|thread|切换|当前/i);
    await openClowderPanel(page);
    await expect(page.locator('.clowder-panel .thread-id')).not.toContainText('Not bound');

    await sendChatMessage(page, `/thread ${useRef} ${id} routed lifecycle`);
    await expectCommandResponse(page, /thread|routed|sent|已发送|已路由|Clowder/i);
  });
});
