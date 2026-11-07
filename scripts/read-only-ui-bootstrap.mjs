import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://209.200.246.159:18444/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLDialogElement', 'MutationObserver', 'localStorage', 'sessionStorage']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({ matches: false });
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
const nativeFetch = globalThis.fetch;
let cookie = '';
globalThis.livePaths = new Set();
globalThis.fetch = async (path, options = {}) => {
  const url = new URL(path, window.location.href);
  if (globalThis.interceptor) { const response = await globalThis.interceptor(url, options); if (response) return response; }
  const headers = new Headers(options.headers);
  if (cookie) headers.set('Cookie', cookie);
  if (options.method && options.method !== 'GET') headers.set('Origin', url.origin);
  const response = await nativeFetch(url, { ...options, headers });
  const session = response.headers.getSetCookie().find(value => value.startsWith('dubi_')) ?? response.headers.getSetCookie()[0];
  if (session) cookie = session.split(';')[0];
  globalThis.livePaths.add(url.pathname);
  if (url.pathname === '/api/v1/admin/nodes' && response.ok) globalThis.liveNode = (await response.clone().json()).data.items[0];
  if (url.pathname === '/api/v1/admin/volumes' && response.ok) globalThis.liveVolume = (await response.clone().json()).data.items[0];
  return response;
};
await import('./readonly-checks.bundle.mjs');
