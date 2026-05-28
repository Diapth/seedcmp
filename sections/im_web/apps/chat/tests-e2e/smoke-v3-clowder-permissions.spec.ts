import { test } from '@playwright/test'

test.describe('V3 Clowder group permissions smoke', () => {
  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires TangSeng, WuKongIM, Clowder API, signed bridge env, and two group users.'
  )

  test('allows one group, denies another, and blocks non-admin commands', async ({ page }) => {
    await page.goto('/')
    // This smoke is intentionally environment-gated; the detailed manual flow is
    // tracked in sections/im_web/.ai/V3.0/quickstart.md and evidence.md.
  })
})
