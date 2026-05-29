import { expect, test } from '@playwright/test';
import {
  expectClowderApiPreflight,
  expectClowderPwaReady,
  expectNoPanelClipping,
  expectPanelReadyOrExplained,
  login,
  openClowderPanel,
  openDirectConversation,
} from './helpers/v3-clowder';

test.describe('V3 Clowder panel smoke', () => {
  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires runnable IM Web, TangSeng bridge, Clowder API, and seeded thread bindings.',
  );

  test('opens the Clowder panel and shows status, agents, focus, and delivery state', async ({ page, request }) => {
    const swState = await expectClowderPwaReady(page);
    expect(swState).toBeTruthy();
    await expectClowderApiPreflight(request);

    await login(page);
    await openDirectConversation(page);

    const panel = await openClowderPanel(page);
    await expect(panel).toContainText('Clowder');
    await expect(panel).toContainText('Thread');
    await expect(panel).toContainText('Focus');
    await expect(panel).toContainText('Agents');
    await expect(panel.locator('.thread-id').or(page.getByTestId('clowder-thread-id')).first()).toBeVisible();
    await expectPanelReadyOrExplained(page);
    await expectNoPanelClipping(page);

    await page.screenshot({ path: '/tmp/v3-clowder-panel-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panel).toBeVisible();
    await expectNoPanelClipping(page);
    await page.screenshot({ path: '/tmp/v3-clowder-panel-mobile.png', fullPage: true });
  });
});
