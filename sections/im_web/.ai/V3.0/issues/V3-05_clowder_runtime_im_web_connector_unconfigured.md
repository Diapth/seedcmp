# V3-05: Clowder Runtime IM Web Connector Is Not Enabled For Full Live Routing

## Status

Open

## Severity

Medium

## Finding

The IM Web side now exposes the fixed `Clowder AI` contact, opens the `clowder_ai` direct conversation, and renders the unified right dock. However, the live Clowder runtime currently reports the `im-web` connector as disabled/unconfigured, so full live agent directory and multi-agent routing cannot complete yet.

## Evidence

```bash
curl -sS http://localhost:3003/api/connectors/im-web/status
```

Returned:

```json
{
  "connectorId": "im-web",
  "enabled": false,
  "configured": false,
  "reachable": false,
  "version": "3.0",
  "featureFlags": { "imWebConnector": false },
  "registered": false,
  "state": "unconfigured"
}
```

```bash
curl -i 'http://localhost:3003/api/connectors/im-web/agents?externalChatId=1:clowder_ai' -H 'x-cat-cafe-user: 18337488675'
```

Returned `404 {"error":"Binding not found"}`.

## Impact

- The Clowder panel can open in IM Web, but live agent directory data depends on a configured Clowder connector and an existing connector-thread binding.
- Sending normal messages to `Clowder AI` will only reach Clowder after both TangSeng and Clowder use matching connector settings.

## Expected Configuration

Clowder API runtime should be started with compatible connector settings, for example:

```bash
IM_WEB_CLOWDER_ENABLED=true
CLOWDER_CONNECTOR_SECRET=<shared-secret>
CLOWDER_OUTBOUND_CALLBACK_URL=http://127.0.0.1:8090/api/im-web/clowder/outbound
DEFAULT_OWNER_USER_ID=<clowder-owner-user-id>
```

TangSeng should use the same secret and Clowder API base URL:

```bash
IM_WEB_CLOWDER_ENABLED=true
CLOWDER_API_BASE_URL=http://127.0.0.1:3004
CLOWDER_CONNECTOR_ID=im-web
CLOWDER_CONNECTOR_SECRET=<shared-secret>
CLOWDER_DEFAULT_OWNER_USER_ID=<clowder-owner-user-id>
```

## Acceptance

- `GET /api/connectors/im-web/status` returns `enabled: true`, `configured: true`, `state: "ready"`.
- Sending a first message in `clowder_ai` creates or resolves a binding for `externalChatId=1:clowder_ai`.
- `GET /api/connectors/im-web/agents?externalChatId=1:clowder_ai` returns agent data instead of `Binding not found`.
- IM Web Clowder panel shows agent rows without an agent-directory unavailable state.
