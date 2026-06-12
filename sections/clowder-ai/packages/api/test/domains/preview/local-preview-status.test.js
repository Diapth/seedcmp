import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyLocalPreviewAttempt,
  classifyLocalPreviewFailure,
  formatLocalPreviewHandoff,
} from '../../../dist/domains/preview/local-preview-status.js';

describe('local preview status classification', () => {
  it('classifies listen EPERM as port_binding_forbidden without a working url', () => {
    const status = classifyLocalPreviewAttempt({
      host: '127.0.0.1',
      port: 4301,
      route: '/showcase/wedding-invite',
      stderr: 'Error: listen EPERM: operation not permitted 127.0.0.1:4301',
      exitCode: 1,
      sourcePath: 'packages/web/src/app/showcase/wedding-invite/page.tsx',
    });

    assert.equal(status.status, 'failed');
    assert.equal(status.reason, 'port_binding_forbidden');
    assert.equal(status.attemptedUrl, 'http://127.0.0.1:4301/showcase/wedding-invite');
    assert.equal('url' in status, false);
    assert.match(formatLocalPreviewHandoff(status), /listen EPERM/);
  });

  it('does not mark a localhost url as started until health check succeeds', () => {
    const status = classifyLocalPreviewAttempt({
      host: '127.0.0.1',
      port: 4301,
      route: '/showcase/wedding-invite',
      stdout: 'ready - started server on 127.0.0.1:4301',
      healthCheckError: 'health check failed: ECONNREFUSED',
      exitCode: null,
    });

    assert.equal(status.status, 'failed');
    assert.equal(status.reason, 'route_unreachable');
    assert.equal('url' in status, false);
  });

  it('marks preview as started only when reachability is proven', () => {
    const status = classifyLocalPreviewAttempt({
      host: '127.0.0.1',
      port: 4301,
      route: '/showcase/wedding-invite',
      healthCheckOk: true,
      pid: 1234,
    });

    assert.equal(status.status, 'started');
    assert.equal(status.url, 'http://127.0.0.1:4301/showcase/wedding-invite');
    assert.equal(status.pid, 1234);
  });

  it('keeps common startup failures distinct', () => {
    assert.equal(classifyLocalPreviewFailure('Error: listen EADDRINUSE: address already in use'), 'port_in_use');
    assert.equal(classifyLocalPreviewFailure('timed out waiting for ready', { timedOut: true }), 'timeout');
    assert.equal(classifyLocalPreviewFailure('script failed', { exitCode: 1 }), 'command_failed');
  });
});
