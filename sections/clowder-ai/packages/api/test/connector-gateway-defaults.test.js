import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveConnectorGatewayDefaultCatId } from '../dist/infrastructure/connectors/connector-gateway-defaults.js';

describe('connector gateway defaults', () => {
  it('uses the configured default cat instead of a hardcoded opus fallback', () => {
    const configured = resolveConnectorGatewayDefaultCatId('ragdoll-kn9a');

    assert.equal(configured, 'ragdoll-kn9a');
  });
});
