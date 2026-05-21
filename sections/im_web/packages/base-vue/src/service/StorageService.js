let cachedSid = '';
export function getSID() {
    if (cachedSid)
        return cachedSid;
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        cachedSid = params.get('sid') || '';
    }
    return cachedSid;
}
export const StorageService = {
    get(key) {
        const sid = getSID();
        return localStorage.getItem(key + sid);
    },
    set(key, value) {
        const sid = getSID();
        localStorage.setItem(key + sid, value);
    },
    remove(key) {
        const sid = getSID();
        localStorage.removeItem(key + sid);
    },
    clear() {
        const sid = getSID();
        localStorage.removeItem('token' + sid);
        localStorage.removeItem('uid' + sid);
        localStorage.removeItem('name' + sid);
        localStorage.removeItem('avatar' + sid);
        localStorage.removeItem('loginInfo' + sid);
    }
};
