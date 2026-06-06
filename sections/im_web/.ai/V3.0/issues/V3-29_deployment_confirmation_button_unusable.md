# V3-29: Deployment Confirmation Card Cannot Be Actioned From IM Web

## Status

Open. Reported from the live IM Web V3.0 + Clowder flow on 2026-06-04. The browser screenshot shows a deployment confirmation card rendered in the chat, but the user cannot click through to deploy.

## Created

2026-06-04

## Labels

bug, clowder, deployment, rich-blocks, interactive-card, permissions, regression, ux

## Priority

P0

## User Report

After the user types a deployment request, IM Web renders deployment UI but deployment cannot be clicked/executed.

The live screenshot shows:

- a message card titled `Deployment` / `待确认`,
- card body `确认部署`,
- target shown as `待确认目标`,
- environment shown as `待确认环境`,
- `确认` and `取消` buttons inside the card,
- an additional blue `部署` action visible on the right side of the chat surface.

The user-visible result is: "用户输入部署后，无法点击部署".

## Impact

- The core safety flow for high-risk operations is blocked: Clowder detects deployment intent, but the user cannot approve it from IM Web.
- Users may believe deployment is authorized or queued when no confirmation reaches Clowder.
- If the target/environment remain `待确认`, the UI still exposes action buttons without giving the user a clear way to fill missing fields.
- The visible `部署` affordance becomes misleading if it is not connected to the card/action backend.

## Related Issues

- `V3-28_reply_context_identity_templates_and_model_selection_regressions.md` tracks nearby rich Clowder/coordinator interaction regressions.
- `V3-25_clowder_cat_onboarding_context_menus_and_group_auto_reply.md` defines the broader IM Web + Clowder interaction contract.

## Reproduction Notes

1. Open IM Web at the live V3 chat route.
2. Open a Clowder/cat/coordinator conversation.
3. Send a deployment request, for example:

   ```text
   帮我部署
   ```

   or:

   ```text
   猫猫，请部署到生产环境
   ```

4. Observe that a deployment confirmation card is inserted.
5. Try to click `确认`, `取消`, or the visible `部署` button.
6. Observe whether the card action reaches Clowder, whether the card state changes, and whether any user-visible error is shown.

## Expected Behavior

- Deployment intent should create exactly one clear confirmation surface.
- If target or environment is unknown, the card should ask for missing fields or disable the confirm/deploy action with a visible reason.
- If target/environment are known, `确认部署` should be keyboard/mouse accessible and should send an explicit approval message/event to Clowder.
- The card should transition from `pending_confirmation` to an actionable state such as `confirmed`, `running`, `succeeded`, `failed`, or `cancelled`.
- Failed confirmation should show a toast or inline error instead of silently doing nothing.
- The right-side or floating `部署` button should either trigger the same confirm path or be removed to avoid a dead duplicate action.
- IM Web should preserve the deployment decision after refresh so users can audit what was approved.

## Acceptance Criteria

- Clicking the deployment card confirm action sends exactly one confirmation request/message to the bound Clowder thread.
- Clicking cancel sends exactly one cancellation request/message and updates the card state.
- A card with `target: 待确认目标` or `environment: 待确认环境` cannot be accidentally approved without resolving those fields.
- Unknown target/environment states provide an editable prompt or a clear disabled reason.
- The visible `部署` action is clickable, accessible by keyboard, and routed to the same state machine as the card, or is removed.
- Button clicks are not swallowed by message-row overlays, `pointer-events`, disabled parent containers, or right-dock z-index layers.
- Confirmation failures from TangSeng/Clowder return a user-visible error and leave the card in a retryable state.
- Browser evidence covers both a fully specified deployment request and an underspecified `帮我部署` request.

## Suspected Areas

```text
sections/im_web/apps/chat/src/utils/deploymentIntent.ts
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/packages/base-vue/src/components/messages/CardCell.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/api/clowder.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/clowder-ai/packages/web/src/components/InteractiveBlock.tsx
sections/clowder-ai/packages/api/src/infrastructure/connectors/ImWebInboundHandler.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorRouter.ts
```

## Investigation Checklist

- Confirm whether the deployment card buttons emit an action from `CardCell.vue`.
- Confirm whether `MessageList.vue` receives the action and calls `handleDeploymentCardAction`.
- Check whether `handleDeploymentCardAction` sends a normal Clowder message, a connector command, or an interactive-block callback.
- Inspect whether the generated card is missing a stable `blockId`, `messageId`, `actionId`, or thread binding required by Clowder.
- Inspect whether the card or blue `部署` button is visually present but disabled by CSS, overlay, z-index, or event propagation.
- Verify whether deployment cards with `待确认目标` and `待确认环境` should be confirmable or should require a field-collection step first.
- Confirm whether Clowder treats the resulting confirmation as an approval, a plain user message, or an ignored duplicate.

## Regression Coverage Required

- Component test for `CardCell.vue` that clicks deployment confirm/cancel and asserts emitted action payloads.
- Component/store test for `MessageList.vue` proving deployment card actions call the Clowder route exactly once.
- Store/API test proving the confirmation request includes card id, target, environment, channel id, and thread id.
- Negative test where target/environment are unknown and the confirm action is disabled or prompts for missing fields.
- Browser smoke using the live account: send a deployment request, click confirm, observe card state and Clowder response.

## Required Verification

```bash
cd sections/im_web
pnpm type-check
pnpm test:unit
```

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/deploymentCard.test.ts tests/clowderCommandContracts.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd sections/clowder-ai/packages/api
pnpm test -- command-registry callback-routes
```

## Notes

Do not close this issue with static evidence only. The report is specifically about live clickability: verification must include a browser click on the rendered deployment UI and proof that Clowder receives the resulting confirmation.
