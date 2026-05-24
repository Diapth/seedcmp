# Quickstart: IM Web V2.0 Completion

## Prerequisites
- Node and pnpm installed
- Backend services for TangSengDaoDaoServer and WuKongIM available for the scenarios you want to verify

## Common commands
```bash
cd sections/im_web
pnpm type-check
pnpm build
pnpm test:unit
pnpm test:e2e
```

## Recommended workflow
1. Finish the remaining V1.0 issue list first.
2. Run the build gate and the matching regression checks after each fix.
3. When the V1.0 backlog is clear, start V2.0 by user story priority.
4. For every V2.0 story, record build evidence, test evidence, smoke evidence, and review approval before marking it done.

## Smoke checks to keep repeating
- Send a message, refresh, and confirm state is stable.
- Reconnect after a disconnect and confirm pending work is recovered.
- Open group settings and confirm permissions, avatar, and announcement controls match the current user role.
- Run the relevant Playwright flow for the story being closed.
