# V3 Contact, Copy, and Dock Browser Smoke

- Target: `http://localhost:3000`
- Final URL: `http://localhost:3000/chat/conversation/clowder_ai/1`
- Date: 2026-05-29 00:09 Asia/Shanghai

## Passed

- IM Web loaded through the external Tailscale URL.
- Existing session opened without a blank screen.
- Fixed `Clowder AI` contact was visible from Contacts.
- Clicking `Clowder AI` opened the direct `clowder_ai` conversation.
- Clowder right dock opened from the chat header.
- Right dock resized horizontally from `420px` to `502px`.
- Clipboard textarea fallback executed successfully in browser context.

## Evidence

- `01-initial.png`
- `02-after-login.png`
- `03-contact-list.png`
- `04-clowder-dock.png`
- `05-resized-dock.png`
- `summary.json`

## Notes

- Console had resource-level 400/404 entries during page load, but no failed Playwright network requests and no smoke assertion failures.
- Clowder runtime reported `im-web` connector as `unconfigured`; full live multi-agent directory/routing requires the Clowder API process to run with `IM_WEB_CLOWDER_ENABLED=true` and a matching `CLOWDER_CONNECTOR_SECRET`.
