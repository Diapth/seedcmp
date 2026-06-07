const memoryMap = new Map();

export const memoryStorage = {
  get(key) {
    return memoryMap.has(key) ? memoryMap.get(key) : null;
  },
  set(key, value) {
    memoryMap.set(key, value);
  },
  remove(key) {
    memoryMap.delete(key);
  },
  clear() {
    memoryMap.clear();
  }
};

function getUni() {
  return typeof uni !== 'undefined' ? uni : null;
}

function canUseLocalStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function encode(value) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function decode(value) {
  if (value === null || value === undefined || value === '') return value || null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export const storage = {
  get(key) {
    const uniRuntime = getUni();
    if (uniRuntime?.getStorageSync) {
      try {
        const value = uniRuntime.getStorageSync(key);
        if (value !== '' && value !== undefined && value !== null) return decode(value);
      } catch {
        // Fall through to H5/local test storage.
      }
    }

    if (canUseLocalStorage()) {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) return decode(value);
      } catch {
        // Fall through to memory storage.
      }
    }

    return decode(memoryStorage.get(key));
  },

  set(key, value) {
    const encoded = encode(value);
    const uniRuntime = getUni();
    if (uniRuntime?.setStorageSync) {
      try {
        uniRuntime.setStorageSync(key, encoded);
      } catch {
        // Keep fallback writes below for non-standard runtimes.
      }
    }

    if (canUseLocalStorage()) {
      try {
        localStorage.setItem(key, encoded);
      } catch {
        // Ignore and keep memory copy.
      }
    }

    memoryStorage.set(key, encoded);
  },

  remove(key) {
    const uniRuntime = getUni();
    if (uniRuntime?.removeStorageSync) {
      try {
        uniRuntime.removeStorageSync(key);
      } catch {
        // Continue with fallback stores.
      }
    }

    if (canUseLocalStorage()) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore.
      }
    }

    memoryStorage.remove(key);
  },

  clear(keys = []) {
    const knownKeys = keys.length
      ? keys
      : [
          'auth.accessToken',
          'auth.refreshToken',
          'auth.expiresAt',
          'auth.uid',
          'auth.loginInfo',
          'app_token',
          'app_user',
          'im.token',
          'im.wsAddr'
        ];
    knownKeys.forEach((key) => this.remove(key));
  }
};

export function resetStorageForTests() {
  memoryStorage.clear();
}
