# V3-12: IM Web Runtime Hosts Were Hardcoded To One LAN Machine

## Status

Resolved on 2026-05-29

## Severity

Medium

## Finding

IM Web browser runtime code still defaulted the TangSeng HTTP API, media preview origin, object storage origin, and WuKongIM websocket fallback host to `100.79.157.76`. That made the current machine work, but made a fresh machine or CI environment depend on one local topology.

## Impact

- Browser login, media preview, voice playback, and websocket recovery could fail after moving the stack to another host.
- V3 Clowder smoke evidence could look environment-specific even when the code path was correct.
- Stale local generated JS sidecars could shadow TypeScript changes during tests.

## Resolution

- Added `resolveApiBaseUrl`, `resolveMediaOrigin`, and `resolveWebsocketFallbackHost` runtime helpers.
- API, media, object storage, and websocket fallback values now resolve from Vite environment variables before using portable defaults.
- Added `apps/chat/.env.example` and `scripts/dev-chat.sh` so local startup has one visible configuration path.
- Ignored and removed local package-level generated JS sidecars that can shadow TypeScript source.

## Verification

- `pnpm --filter chat test:unit -- runtimeEnvironmentConfig.test.ts mediaUrlNormalization.test.ts sdkAddress.test.ts` passes: 50 files, 142 tests.
- `pnpm --filter chat test:unit -- runtimeEnvironmentConfig.test.ts mediaUrlNormalization.test.ts sdkAddress.test.ts sourceTreeHygiene.test.ts` passes: 50 files, 143 tests.
- `pnpm --filter chat build` passes: `vue-tsc && vite build` completes successfully.
