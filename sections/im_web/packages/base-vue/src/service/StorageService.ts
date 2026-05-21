let cachedSid = '';

export function getSID(): string {
  if (cachedSid) return cachedSid;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    cachedSid = params.get('sid') || '';
  }
  return cachedSid;
}

export const StorageService = {
  get(key: string): string | null {
    const sid = getSID();
    return localStorage.getItem(key + sid);
  },
  set(key: string, value: string): void {
    const sid = getSID();
    localStorage.setItem(key + sid, value);
  },
  remove(key: string): void {
    const sid = getSID();
    localStorage.removeItem(key + sid);
  },
  clear(): void {
    const sid = getSID();
    localStorage.removeItem('token' + sid);
    localStorage.removeItem('uid' + sid);
    localStorage.removeItem('name' + sid);
    localStorage.removeItem('avatar' + sid);
    localStorage.removeItem('loginInfo' + sid);
  }
};
