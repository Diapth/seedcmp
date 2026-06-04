# V3-36: Deployment Card Has No Way To Choose Target Or Environment

## Status

Open. Reported from the live IM Web V3.0 Clowder deployment flow on 2026-06-04. The deployment confirmation card asks the user to complete target and environment, but the UI provides no field, selector, or guided reply path to do that.

## Created

2026-06-04

## Labels

bug, clowder, deployment, interactive-card, form, target, environment, ux, regression

## Priority

P0

## User Report

The chat shows deployment confirmation cards with:

- `Deployment`
- `需求补充信息`
- `确认部署`
- `目标: 待确认目标`
- `环境: 待确认环境`
- warning text: `请先补充部署目标、部署环境`
- disabled-looking `确认` button and `取消` button

The user tried to provide missing information in normal chat:

```text
部署婚礼，环境是本地
```

and later:

```text
你来部署吧，给我网页
```

but the deployment card still renders `待确认目标` / `待确认环境`, and there is no obvious UI entry to select or edit these fields.

The user-visible problem is: "这个部署，用户怎么选择名字和环境呢，很奇怪，没有入口啊".

## Impact

- Deployment is blocked before confirmation because required fields cannot be completed from the card.
- Users do not know whether they should type a reply, click the floating `部署` button, use `@`, or edit the card.
- Natural-language follow-up appears to create another incomplete card instead of filling the pending one.
- The same deployment intent can duplicate cards with conflicting incomplete state.
- The safety flow becomes frustrating: it asks for explicit target/environment but gives no explicit way to provide them.

## Relationship To Existing Issues

- Related to `V3-29_deployment_confirmation_button_unusable.md`, but distinct.
- V3-29 is about clicking `确认` / `取消` and routing card actions.
- This issue is about collecting required deployment fields before confirmation: target/name and environment.

## Expected Behavior

- A deployment card that needs `目标` or `环境` should expose clear inputs or choices inside the card.
- The environment field should be selectable, for example `本地`, `预览`, `测试`, `生产`, or configured environments.
- The target field should be selectable or editable, with sensible candidates from current conversation context such as project name, route, artifact, task title, or latest generated page.
- A user follow-up like `部署婚礼，环境是本地` should update the existing pending deployment request instead of creating a new incomplete card.
- Once both fields are present, the confirm button should become enabled and the card should display the resolved target/environment.
- If the user-provided text is ambiguous, the card should ask one specific follow-up question instead of repeating the generic incomplete card.

## Acceptance Criteria

- Deployment cards with missing required fields render explicit field controls or quick-reply options.
- Users can set environment to `本地` from the UI without guessing a command syntax.
- Users can set target/name to `婚礼` from the UI or by natural-language follow-up.
- Follow-up text updates the existing pending deployment card and does not create a duplicate card unless it is clearly a new deployment request.
- `确认` remains disabled until required fields are resolved, with a visible reason.
- After target and environment are resolved, `确认` becomes actionable and sends the resolved values to Clowder.
- Refreshing the page preserves pending deployment fields and their resolved values.
- Browser evidence covers: missing fields -> choose target/env -> confirm enabled.

## Suspected Areas

```text
sections/im_web/apps/chat/src/utils/deploymentIntent.ts
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/packages/base-vue/src/components/messages/CardCell.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/api/clowder.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/clowder-ai/packages/api/src/routes/connector-deployment-action.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorRouter.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts
```

## Investigation Checklist

- Inspect the deployment rich block payload and confirm whether it contains editable field definitions or only static labels.
- Check whether `deploymentIntent.ts` can parse follow-up messages into an existing pending deployment request.
- Check whether there is a stable `deploymentRequestId` connecting follow-up messages to the original card.
- Check whether the floating blue `部署` button can set target/environment or only creates another intent.
- Check whether card state is stored in Clowder, TangSeng message extra, local IM Web store, or only rendered from message text.
- Check whether target candidates are available from current artifacts, tasks, generated routes, or active thread metadata.
- Check whether environment choices are hardcoded, configured, or absent.
- Verify whether duplicated incomplete cards are caused by treating every deployment-like message as a new request.

## Regression Coverage Required

- Parser test: `部署婚礼，环境是本地` resolves `target=婚礼` and `environment=本地`.
- State-machine test: a follow-up fills the existing pending request instead of creating a duplicate.
- Component test: deployment card renders target/environment inputs or quick replies when fields are missing.
- Component test: confirm button is disabled with reason while fields are missing and enabled after they are filled.
- API/proxy test: confirm action includes resolved target and environment.
- Browser smoke: user starts with `你来部署吧`, chooses/fills target and environment, then sees one updated card ready to confirm.

## Notes

Do not solve this by only improving copy. The core issue is missing interaction/state: the user needs an actual path to choose or fill deployment target and environment, and the pending deployment card must update when those values are provided.
