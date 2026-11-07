import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { IconName } from './Icon';

// Only navigation state belongs in the URL. Tokens and form contents stay out.
const routes = {
  '/cluster/overview': 'grid',
  '/cluster/nodes': 'globe',
  '/storage/volumes': 'volume',
  '/engines-modules': 'engines',
  '/tenants': 'tenant',
  '/access/credentials': 'key',
  '/access/accounts': 'key',
  '/backups': 'archive',
  '/monitoring': 'tool',
  '/notifications': 'bell',
  '/gateway': 'gateway',
  '/modules/config': 'config',
  '/modules/cache': 'cache',
} as const satisfies Record<string, IconName>;
type Path = keyof typeof routes;
export type AccessTab = 'credentials' | 'accounts';
const defaultPath: Path = '/cluster/overview';
function subscribe(change: () => void) {
  window.addEventListener('hashchange', change);
  window.addEventListener('popstate', change);
  return () => {
    window.removeEventListener('hashchange', change);
    window.removeEventListener('popstate', change);
  };
}
function snapshot() { return window.location.hash; }
function resolve(hash: string, preview: boolean): Path {
  const path = hash.slice(1).split('?')[0].replace(/\/+$/, '');
  if (Object.hasOwn(routes, path)) return path as Path;
  // Existing design-preview links remain useful; a hash always takes priority.
  if (!hash && preview) {
    const legacy: Record<string, Path> = { tenant: '/tenants', credentials: '/access/credentials', backup: '/backups', monitoring: '/monitoring', notifications: '/notifications' };
    return legacy[new URLSearchParams(window.location.search).get('page') ?? ''] ?? defaultPath;
  }
  return defaultPath;
}
export default function useConsoleRoute(preview: boolean) {
  const hash = useSyncExternalStore(subscribe, snapshot);
  const path = resolve(hash, preview);
  const isBusiness = path.startsWith('/modules/');
  const explicitTenant = new URLSearchParams(hash.split('?')[1] ?? '').get('tenant');
  const remembered = useRef('');
  if (!remembered.current && preview) { try { remembered.current = sessionStorage.getItem('dubi.preview.business-tenant') ?? ''; } catch { /* Storage may be unavailable. */ } }
  const candidate = explicitTenant ?? remembered.current;
  const tenant = isBusiness && candidate.length <= 128 ? candidate : '';
  const targetHash = `#${path}${isBusiness && tenant ? `?${new URLSearchParams({ tenant })}` : ''}`;
  useEffect(() => {
    if (isBusiness && explicitTenant !== null) {
      remembered.current = tenant;
      if (preview) { try { sessionStorage.setItem('dubi.preview.business-tenant', tenant); } catch { /* Optional preview preference. */ } }
    }
    if (window.location.hash !== targetHash) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${targetHash}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [path, hash, targetHash, tenant, explicitTenant, isBusiness, preview]);
  function navigate(page: IconName, tab: AccessTab = 'credentials') {
    const next = page === 'key' ? `/access/${tab}` : (Object.keys(routes) as Path[]).find(key => routes[key] === page) ?? defaultPath;
    const selected = isBusiness ? tenant : remembered.current;
    const target = `${next}${next.startsWith('/modules/') && selected ? `?${new URLSearchParams({ tenant: selected })}` : ''}`;
    if (window.location.hash !== `#${target}`) window.location.hash = target;
  }
  function selectTenant(value: string) {
    if (!isBusiness || value.length > 128) return;
    const target = `#${path}?${new URLSearchParams({ tenant: value })}`;
    if (window.location.hash !== target) window.location.hash = target;
  }
  return { tenant, selectTenant, page: routes[path], accessTab: (path === '/access/accounts' ? 'accounts' : 'credentials') as AccessTab, path, navigate };
}
