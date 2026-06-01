import assert from 'node:assert/strict';
import { test } from 'node:test';

function setEnv(name, value) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return () => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  };
}

test('internal upload URLs default to the web proxy entrypoint for remote IM browsers', async () => {
  const restore = [
    setEnv('CAT_CAFE_PUBLIC_URL', undefined),
    setEnv('CAT_CAFE_WEB_URL', undefined),
    setEnv('FRONTEND_URL', undefined),
    setEnv('NEXT_PUBLIC_FRONTEND_URL', undefined),
    setEnv('NEXT_PUBLIC_APP_URL', undefined),
    setEnv('CAT_CAFE_API_URL', undefined),
    setEnv('NEXT_PUBLIC_API_URL', undefined),
    setEnv('FRONTEND_PORT', undefined),
  ];
  try {
    const { resolveInternalRouteUrl } = await import('../dist/utils/upload-paths.js');
    assert.equal(resolveInternalRouteUrl('/uploads/sinx.png'), 'http://localhost:3003/uploads/sinx.png');
    assert.equal(
      resolveInternalRouteUrl('/api/connector-media/sinx.png'),
      'http://localhost:3003/api/connector-media/sinx.png',
    );
  } finally {
    restore.reverse().forEach((fn) => fn());
  }
});

test('internal upload URLs prefer explicit public frontend URLs over loopback API URLs', async () => {
  const restore = [
    setEnv('CAT_CAFE_PUBLIC_URL', 'http://100.79.157.76:3003/'),
    setEnv('CAT_CAFE_API_URL', 'http://localhost:3004'),
  ];
  try {
    const { resolveInternalRouteUrl } = await import('../dist/utils/upload-paths.js');
    assert.equal(resolveInternalRouteUrl('/uploads/sinx.png'), 'http://100.79.157.76:3003/uploads/sinx.png');
  } finally {
    restore.reverse().forEach((fn) => fn());
  }
});
