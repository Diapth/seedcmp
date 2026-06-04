# V3-34: Clowder Cat Contacts Should Show Existing Contacts Only

## Status

Open. Reported from the live IM Web V3.0 Clowder cat console on 2026-06-04. The `Clowder 猫猫联系人` list shows catalog candidates with `添加到联系人`, but this area should only show cats that are already contacts.

## Created

2026-06-04

## Labels

bug, clowder, cats, contacts, directory, onboarding, ux, regression

## Priority

P1

## User Report

The right side of the `新增猫猫` page is named `Clowder 猫猫联系人`, so it should list existing connected cat contacts only. It should not show unconnected catalog/template candidates and should not display `添加到联系人`.

## Impact

- The page mixes two concepts: existing contacts and catalog templates/candidates.
- Users may think every role template is already a contact.
- `添加到联系人` duplicates the left-side create/connect flow and makes cat lifecycle confusing.
- Group invite and @ routing expectations become unclear because unconnected candidates appear beside real contacts.

## Expected Behavior

- `Clowder 猫猫联系人` lists only existing connected cat contacts.
- Connected contacts can be opened or deleted.
- Unconnected role templates remain available only as role templates for creating a new cat, not as contact rows.
- The list should not render `添加到联系人`.
- Empty state should say there are no existing cat contacts, not that there are no connectable candidates.

## Acceptance Criteria

- The cat contacts list filters out entries where `connected !== true`.
- The page no longer renders an `添加到联系人` button in the contact list.
- The create-cat role template dropdown can still use role templates/catalog data.
- Search on the contact side searches existing contacts only.
- Existing connected contacts still render `打开会话` and `删除`.
- Tests assert that the console no longer calls `connectExistingCat` from this page.

## Suspected Areas

```text
sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/im/TangSengDaoDaoServer/modules/clowder/proxy_test.go
```

## Investigation Checklist

- Confirm whether `clowder/cats` returns both connected agents and disconnected role-template candidates.
- Confirm whether `catContactDirectory` merges disconnected candidates with connected contacts.
- Filter the page-level list to connected contacts without breaking role template dropdown population.
- Remove the page-level `connectExistingCat` action if no longer used.
- Update tests that still expect `添加到联系人`.

## Regression Coverage Required

- Component/raw test proving `添加到联系人` is absent.
- Component/raw test proving the contacts list uses connected contacts only.
- Store test or UI smoke proving role templates still appear in the create form.
- Browser smoke with a mixed directory response: connected cats appear; disconnected candidates do not.

## Notes

This issue is about the contact list surface. It does not forbid using catalog templates for the left-side `新增猫猫` form.
