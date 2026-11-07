import ConfigCenter from './management/ConfigCenter';
import BusinessTenants from './management/BusinessTenants';
import ComponentsManagement from './management/ComponentCatalog';
import useConsoleRoute from './useConsoleRoute';
import { AdminAccounts } from './Accounts';
import ResourceID from './components/ResourceID';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GatewayInfo, Identity } from './api';
import { createPortal } from 'react-dom';

import Icon from './Icon';
import LogoutConfirmation from './components/LogoutConfirmation';
import Workspace from './management/Workspace';
import Tenants from './management/Tenants';
import AccessManagement, { PersonalSettings } from './Accounts';
import Backups from './management/Backups';
import Monitoring from './management/Monitoring';
import { SessionExpired } from './management/resource';
import type { IconName } from './Icon';
// Keep design fixtures out of production bundles.
import Notifications, { NotificationBell, useNotices } from './Notifications';
const BusinessDataPreview = import.meta.env.DEV ? lazy(() => import('./BusinessDataPreview')) : null;
const BusinessTenantPreview = import.meta.env.DEV ? lazy(() => import('./BusinessDataPreview').then(module => ({ default: module.BusinessTenantPreview }))) : null;
const EnginesModulesPreview = import.meta.env.DEV ? lazy(() => import('./EnginesModulesPreview')) : null;
const MonitoringPreview = import.meta.env.DEV ? lazy(() => import('./MonitoringPreview')) : null;
const BackupPreview = import.meta.env.DEV ? lazy(() => import('./BackupPreview')) : null;
const CredentialsPreview = import.meta.env.DEV ? lazy(() => import('./CredentialsPreview')) : null;
const TenantPreview = import.meta.env.DEV ? lazy(() => import('./TenantPreview')) : null;
const PreviewWorkspace = import.meta.env.DEV ? lazy(() => import('./PreviewWorkspace')) : null;
interface MenuItem { id: IconName; label: string; sub: string; module?: string }
const coreMenus: MenuItem[] = [
  { id: 'grid', label: '集群概览', sub: '集群运行状态与资源分布，一目了然。' },
  { id: 'globe', label: '区域与节点', sub: '查看区域分布、节点状态与存储资源。' },
  { id: 'volume', label: '存储与容量', sub: '查看存储容量、Volume 健康状态与数据分布。' },
  { id: 'engines', label: '引擎与模块', sub: '查看引擎与模块的运行情况、依赖关系和全局配置。' },
  { id: 'tenant', label: '租户与配额', sub: '管理租户、模块权限、存储配额与应用访问凭证。' },
  { id: 'key', label: '访问与凭证', sub: '管理访问权限，以及管理、业务和监控凭证。' },
  { id: 'archive', label: '仓库与备份', sub: '管理备份仓库，查看集群备份与恢复点。' },
  { id: 'tool', label: '监控与诊断', sub: '查看运行指标、后台任务与诊断结果。' },
];
const moduleMenus: MenuItem[] = [
  { id: 'config', label: '配置中心', sub: '查看与管理租户配置。', module: 'config' },
  { id: 'cache', label: '分布式缓存', sub: '查看与管理租户缓存。', module: 'cache' },
];
const gatewayMenu: MenuItem = { id: 'gateway', label: '当前入口', sub: '当前访问节点提供的 HTTP 服务信息。' };
const menus = [...coreMenus, ...moduleMenus, gatewayMenu, { id: 'bell' as IconName, label: '消息与通知', sub: '查看集群事件、资源提醒与任务结果。' }];
const previewPages: IconName[] = ['grid', 'globe', 'volume', 'tool'];
interface Props { preview?: boolean; identity?: Identity | null; gateway?: GatewayInfo | null; busy?: boolean; message?: string; onRefresh?: () => void; onLogout?: () => void; onSessionExpired?: () => void; onIdentityChange?: (me:Identity)=>void; onPasswordChanged?:()=>void }
export default function Console({ preview = false, identity, gateway, busy, message, onRefresh, onLogout, onSessionExpired, onIdentityChange, onPasswordChanged }: Props) {
  const notifications = useNotices();
  const [collapsed, setCollapsed] = useState(true);
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);
  function showMenuTooltip(element: HTMLButtonElement, label: string) {
    if (!collapsed && !window.matchMedia('(max-width: 800px)').matches) return;
    const rect = element.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 18 });
  }
  const { page, accessTab, path, navigate, tenant, selectTenant } = useConsoleRoute(preview);
  const setAccessTab = (tab: 'credentials' | 'accounts') => navigate('key', tab);
  const [popover, setPopover] = useState<'notifications' | 'account' | null>(null);
  const [personal,setPersonal] = useState<'profile'|'password'|null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const accountButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmLogout) return () => { window.requestAnimationFrame(() => accountButton.current?.focus()); };
  }, [confirmLogout]);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const toolsRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    function dismiss(event: PointerEvent) { if (!toolsRef.current?.contains(event.target as Node)) setPopover(null); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setPopover(null); setTooltip(null); } }
    function hideTooltip() { setTooltip(null); }
    window.addEventListener('resize', hideTooltip);
    document.addEventListener('scroll', hideTooltip, true);
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape);
    return () => { window.removeEventListener('resize', hideTooltip); document.removeEventListener('scroll', hideTooltip, true); document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); window.clearTimeout(timer.current); };
  }, []);
  useEffect(() => { setPopover(null); setTooltip(null); setPersonal(null); }, [path]);
  const active = menus.find(item => item.id === page) ?? coreMenus[0];
  const visibleModules = moduleMenus.filter(item => preview || gateway?.business_modules.includes(item.module!));
  const menuGroups = [{ label: '核心', items: coreMenus }, { label: '业务数据', items: visibleModules }];
  function refresh() {
    notifications.refresh();
    if (preview) { setRefreshing(true); timer.current = window.setTimeout(() => { setUpdated(new Date()); setRefreshing(false); }, 450); }
    else { setRevision(value => value + 1); onRefresh?.(); }
  }
  const clusterName = preview ? 'dubi-development' : gateway?.cluster_id || 'DUBI 集群';
  function closeLogoutConfirmation() { setConfirmLogout(false); }
  return <div className={`console ${collapsed ? 'is-collapsed' : ''}`}>
    {personal && identity && onIdentityChange && onPasswordChanged && onSessionExpired && <PersonalSettings mode={personal} identity={identity} onClose={()=>setPersonal(null)} onIdentityChange={onIdentityChange} onPasswordChanged={onPasswordChanged} onExpired={onSessionExpired} onAccounts={()=>{setPersonal(null);navigate('key','accounts')}}/>}
    {confirmLogout && <LogoutConfirmation onCancel={closeLogoutConfirmation} onConfirm={() => { closeLogoutConfirmation(); onLogout?.(); }}/>}
    {tooltip && createPortal(<div className="nav-tooltip" role="tooltip" style={{ top: tooltip.top, left: tooltip.left }}>{tooltip.label}</div>, document.body)}
    <aside className="sidebar">
      <a className="brand" href="#/cluster/overview" onClick={event => { event.preventDefault(); navigate('grid'); }} aria-label="DUBI 集群概览"><svg className="brand-mark" width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><path d="M7 5h11l9 7v10l-9 7H7V5Z" stroke="currentColor" strokeWidth="3"/><path d="M15 12h5v10h-5z" fill="currentColor"/></svg><span>DUBI<span className="brand-caption">CONSOLE</span></span></a>
      <nav className="sidebar-nav" aria-label="主菜单">{menuGroups.filter(group => group.items.length).map(group => <section className="nav-group" key={group.label} aria-label={group.label}>
        <div className="sidebar-label">{group.label}</div>
        {group.items.map(menu => <button key={menu.id} className={`nav-item ${page === menu.id ? 'active' : ''}`} onClick={() => { navigate(menu.id); setPopover(null); setTooltip(null); }} onMouseEnter={event => showMenuTooltip(event.currentTarget, menu.label)} onMouseLeave={() => setTooltip(null)} onFocus={event => showMenuTooltip(event.currentTarget, menu.label)} onBlur={() => setTooltip(null)} aria-current={page === menu.id ? 'page' : undefined} aria-label={menu.label}><Icon name={menu.id} size={18}/><span>{menu.label}</span>{page === menu.id && <span className="nav-dot"/>}</button>)}
      </section>)}</nav>
      <div className="sidebar-bottom"><button className="collapse-button" onClick={() => { setCollapsed(!collapsed); setTooltip(null); }} aria-label={collapsed ? '展开菜单' : '收起菜单'} aria-expanded={!collapsed} title={collapsed ? '展开菜单' : '收起菜单'}><Icon name="chevron"/><span>收起菜单</span></button></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb"><span className="topbar-cluster"><ResourceID value={clusterName} copy/></span><span className="crumb-divider">/</span><strong>{active.label}</strong></div><div className="topbar-actions" ref={toolsRef}>
      {preview && <span className="preview-chip">预览模式</span>}
      <button className={`icon-button ${refreshing || busy ? 'rotating' : ''}`} onClick={refresh} disabled={refreshing || busy} title="刷新当前页面" aria-label="刷新当前页面"><Icon name="refresh"/></button>
      <NotificationBell open={popover === 'notifications'} onToggle={() => setPopover(popover === 'notifications' ? null : 'notifications')} onClose={() => setPopover(null)} onShowAll={() => { navigate('bell'); setPopover(null); }}/>

      <div className="toolbar-divider"/>
      <button className="account-button" ref={accountButton} onClick={() => setPopover(popover === 'account' ? null : 'account')} aria-expanded={popover === 'account'}><span className="avatar">{identity?.name?.slice(0,1).toUpperCase()||'A'}</span><span className="account-copy"><strong>{preview ? '演示管理员' : identity?.name || '管理员'}</strong><small>{preview ? 'Preview account' : identity?.username || 'Token 登录'}</small></span><span className="account-chevron"><Icon name="chevron" size={15}/></span></button>

      {popover === 'account' && <section className="popover account-popover" aria-label="当前登录信息"><h3>{preview ? '演示管理员' : identity?.name || '管理员已登录'}</h3><p>{preview ? '这是界面预览，没有建立真实登录会话。' : `会话到期：${identity ? new Date(identity.expires_unix * 1000).toLocaleString() : '—'}`}</p>{!preview && <><button className="text-button account-entry" onClick={()=>{setPopover(null);setPersonal('profile')}}><Icon name="tenant" size={16}/>个人资料</button><button className="text-button account-entry" onClick={()=>{setPopover(null);setPersonal('password')}}><Icon name="key" size={16}/>修改密码</button></>}<button className="text-button account-entry" onClick={() => { navigate('gateway'); setPopover(null); }}><Icon name="gateway" size={16}/>当前入口信息</button>{!preview && <button className="text-button" disabled={busy} onClick={() => { setPopover(null); setConfirmLogout(true); }}><Icon name="logout" size={16}/>退出登录</button>}</section>}
    </div></header>
    <main className="page-content">{!preview && (page === 'config' || page === 'cache') && onSessionExpired && <SessionExpired.Provider value={onSessionExpired}><BusinessTenants key={page} tenantID={tenant} moduleID={page} onSelect={selectTenant} revision={revision}/></SessionExpired.Provider>}{preview && (page === 'config' || page === 'cache') && BusinessTenantPreview && <Suspense fallback={null}><BusinessTenantPreview key={`${tenant}:${page}`} tenantID={tenant} moduleID={page} onSelect={selectTenant}/></Suspense>}<div className="page-heading"><div><h1>{active.label}</h1><p>{active.sub}</p></div>{preview && <span className="updated" role="status">{updated ? `预览已刷新 ${updated.toLocaleTimeString()}` : '演示数据 · 非实时状态'}</span>}</div>
      {preview && <div className="preview-notice"><span className="notice-dot"/><span>当前为界面预览，数据和操作均为演示，不影响真实集群。</span><span className="notice-tail">DUBI WEB UI</span></div>}
      {message && <p className="message" role="status">{message}</p>}
      {preview && PreviewWorkspace && page !== 'tool' && previewPages.includes(page) && <Suspense fallback={<p className="empty-copy">正在加载界面预览…</p>}><PreviewWorkspace page={page} onNavigate={navigate} /></Suspense>}
      {preview && page === 'tool' && MonitoringPreview && <Suspense fallback={<p className="empty-copy">正在加载…</p>}><MonitoringPreview onNavigate={navigate}/></Suspense>}
      {page === 'engines' && (preview && EnginesModulesPreview ? <Suspense fallback={<p className="empty-copy">正在加载…</p>}><EnginesModulesPreview/></Suspense> : <SessionExpired.Provider value={onSessionExpired ?? (() => {})}><ComponentsManagement revision={revision}/></SessionExpired.Provider>)}
      {!preview && (page === 'config' || page === 'cache') && identity?.csrf_token && onSessionExpired && <SessionExpired.Provider value={onSessionExpired}><ConfigCenter key={`${page}:${tenant}`} moduleID={page} tenantID={tenant} csrf={identity.csrf_token} revision={revision}/></SessionExpired.Provider>}
      {preview && (page === 'config' || page === 'cache') && BusinessDataPreview && <Suspense fallback={<p className="empty-copy">正在加载…</p>}><BusinessDataPreview moduleID={page} tenantID={tenant}/></Suspense>}
      {page === 'bell' && <Notifications onNavigate={navigate}/>}
      {preview && page === 'tenant' && TenantPreview && <Suspense fallback={<p className="empty-copy">正在加载…</p>}><TenantPreview/></Suspense>}
      {preview && page === 'key' && <><div className="access-tabs" role="group" aria-label="访问管理类型"><button aria-pressed={accessTab==='credentials'} onClick={()=>setAccessTab('credentials')}>访问凭证</button><button aria-pressed={accessTab==='accounts'} onClick={()=>setAccessTab('accounts')}>管理账号</button></div>{accessTab==='accounts'?<AdminAccounts preview identity={{role:'admin',account_id:'account_01aabbccddee',expires_unix:0}} revision={revision} onExpired={()=>{}}/>:CredentialsPreview&&<Suspense fallback={<p className="empty-copy">正在加载…</p>}><CredentialsPreview/></Suspense>}</>}
      {preview && page === 'archive' && BackupPreview && <Suspense fallback={<p className="empty-copy">正在加载…</p>}><BackupPreview/></Suspense>}
      {page !== 'config' && page !== 'cache' && !previewPages.includes(page) && page !== 'engines' && !(preview && (page === 'key' || page === 'archive')) && page !== 'bell' && page !== 'gateway' && page !== 'tenant' && page !== 'key' && page !== 'archive' && <section className="panel planned-page"><Icon name={page} size={30}/><h2>{active.label}</h2><p>{active.sub}</p><span>功能暂未开放</span></section>}
      {!preview && identity?.csrf_token && onSessionExpired && (page === 'key' || page === 'archive') && <SessionExpired.Provider value={onSessionExpired}>{page === 'key' ? <AccessManagement identity={identity} revision={revision} onExpired={onSessionExpired} tab={accessTab} onTabChange={setAccessTab}/> : <Backups csrf={identity.csrf_token} revision={revision}/>}</SessionExpired.Provider>}
      {!preview && page === 'tenant' && identity?.csrf_token && onSessionExpired && <SessionExpired.Provider value={onSessionExpired}><Tenants csrf={identity.csrf_token} revision={revision}/></SessionExpired.Provider>}
      {!preview && page === 'tool' && identity?.csrf_token && onSessionExpired && <SessionExpired.Provider value={onSessionExpired}><Monitoring csrf={identity.csrf_token} revision={revision} onNavigate={navigate}/></SessionExpired.Provider>}
      {!preview && onSessionExpired && ((previewPages.includes(page) && page !== 'tool') || page === 'gateway') && <SessionExpired.Provider value={onSessionExpired}><Workspace page={page} revision={revision} onNavigate={navigate}/></SessionExpired.Provider>}
      {preview && page === 'gateway' && <section className="panel gateway-panel"><div className="panel-heading"><h2>{preview ? '当前入口' : '已连接入口'}</h2>{preview && <span className="preview-chip">演示</span>}</div>{gateway || preview ? <dl><dt>集群</dt><dd>{clusterName}</dd><dt>当前节点</dt><dd>{preview ? 'tt01' : gateway?.node_id}</dd><dt>API 版本</dt><dd>{preview ? 'v1' : gateway?.api_version}</dd><dt>已接入模块</dt><dd>{preview ? 'config' : gateway?.business_modules.join('、') || '暂无'}</dd></dl> : <p className="empty-copy">正在等待入口信息。</p>}{!preview && page !== 'gateway' && <p className="empty-copy">此页面的管理数据尚未接入，当前仅显示已获取的入口信息。</p>}</section>}
      <footer className="page-footer"><span>DUBI <span className="footer-divider">/</span> 分布式数据基础设施</span><span>{preview ? '设计预览' : '集群管理控制台'}</span></footer>
    </main></div>
  </div>;
}
