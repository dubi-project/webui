export type IconName = 'engines' | 'shield' | 'activity' | 'copy' | 'check' | 'clock' | 'plus' | 'grid' | 'globe' | 'server' | 'tool' | 'gateway' | 'chevron' | 'bell' | 'refresh' | 'arrow' | 'logout' | 'volume' | 'search' | 'close' | 'alert' | 'tenant' | 'key' | 'archive' | 'config' | 'cache';
export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    engines: <><path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    tenant: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v3"/></>,
    key: <><circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-5-5 3-3m-6 0 3-3"/></>,
    archive: <><path d="M4 8v13h16V8M9 12h6"/><rect x="2" y="3" width="20" height="5" rx="1"/></>,
    config: <><path d="M3 6h6m4 0h8M3 18h10m4 0h4M3 12h2m4 0h12"/><circle cx="11" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="15" cy="18" r="2"/></>,
    cache: <><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4M9 9h6v6H9z"/></>,
    volume: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 14h18M7 17h.01M11 17h.01"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/></>,
    server: <><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M16 6.5h2M16 17.5h2"/></>,
    tool: <><path d="m14 6 4 4 3-3a6 6 0 0 1-8 7L6 21l-3-3 7-7a6 6 0 0 1 7-8Z"/></>,
    gateway: <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18M8 22h8M12 18v4M7 6h.01"/></>,
    chevron: <path d="m14 7-5 5 5 5"/>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    refresh: <><path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/></>,
    arrow: <path d="m9 5 7 7-7 7"/>, logout: <><path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
