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

test('internal upload URLs default to the API entrypoint for remote IM browsers', async () => {
  const restore = [
    setEnv('CAT_CAFE_PUBLIC_URL', undefined),
    setEnv('CAT_CAFE_WEB_URL', undefined),
    setEnv('FRONTEND_URL', undefined),
    setEnv('NEXT_PUBLIC_FRONTEND_URL', undefined),
    setEnv('NEXT_PUBLIC_APP_URL', undefined),
    setEnv('CAT_CAFE_API_URL', undefined),
    setEnv('NEXT_PUBLIC_API_URL', undefined),
    setEnv('FRONTEND_PORT', undefined),
    setEnv('API_SERVER_PORT', undefined),
  ];
  try {
    const { resolveInternalRouteUrl } = await import('../dist/utils/upload-paths.js');
    assert.equal(resolveInternalRouteUrl('/uploads/sinx.png'), 'http://localhost:3004/uploads/sinx.png');
    assert.equal(
      resolveInternalRouteUrl('/api/connector-media/sinx.png'),
      'http://localhost:3004/api/connector-media/sinx.png',
    );
  } finally {
    restore.reverse().forEach((fn) => fn());
  }
});

test('internal upload URLs prefer the explicit API URL over frontend port settings', async () => {
  const restore = [
    setEnv('CAT_CAFE_PUBLIC_URL', 'http://100.79.157.76:3003/'),
    setEnv('CAT_CAFE_API_URL', 'http://100.79.157.76:3004/'),
    setEnv('FRONTEND_PORT', '3003'),
  ];
  try {
    const { resolveInternalRouteUrl } = await import('../dist/utils/upload-paths.js');
    assert.equal(resolveInternalRouteUrl('/uploads/sinx.png'), 'http://100.79.157.76:3004/uploads/sinx.png');
  } finally {
    restore.reverse().forEach((fn) => fn());
  }
});
