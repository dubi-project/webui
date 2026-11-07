import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import Select from '../components/Select';
import PreviewDialog from '../components/PreviewDialog';
import useDrawer from '../components/useDrawer';
import { toast } from '../components/Toast';
import { APIError, request } from '../api';
import type { ManagementResponse } from '../api';
import { adminPath, SessionExpired, useResource } from './resource';
import { useBusinessTenant, tenantView } from './BusinessTenants';
import type { BusinessTenant } from '../components/BusinessTenantBar';
import '../business-data-preview.css';

type Item = { key: string; version: string; value_bytes: number | null; created_order: number; confirmed: boolean };
type Page = { items: Item[]; next_cursor?: string };
type Entry = { version: string; value: string | null };
type LoadedEntry = Entry & { key: string };
type Mutation = { request_id: string; value?: string; version?: string; if_absent?: boolean };
const bytes = (value: string) => new TextEncoder().encode(value).length;
const size = (n: number | null) => n === null ? '未知' : n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KiB`;
const ConfigScope = createContext({ tenant: false, readOnly: false });
function configPath(path:string, tenantMode:boolean, query:Record<string,string>) { const params={...query}; if(tenantMode)delete params.tenant;return adminPath(path,params).replace('/api/v1/admin/',tenantMode?'/api/v1/tenant/':'/api/v1/admin/'); }
const entryPath = (tenant: string, key: string, mode=false) => configPath('config/entry',mode,{tenant,key});
function encode(value: string) { return btoa(Array.from(new TextEncoder().encode(value), b => String.fromCharCode(b)).join('')); }
function decode(value: string | null): { text: string; binary: boolean; size: number } {
  const raw = Uint8Array.from(atob(value ?? ''), c => c.charCodeAt(0));
  try { const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw); if (text.includes('\0') || text.includes('\r')) return { text: value ?? '', binary: true, size: raw.length }; return { text, binary: false, size: raw.length }; }
  catch { return { text: value ?? '', binary: true, size: raw.length }; }
}
function message(error: unknown) {
  if (error instanceof APIError) {
    if (error.code === 'version_conflict' || error.code === 'conflict') return '配置已存在、已删除或版本已改变。请关闭此窗口，重新读取后再修改。';
    if (error.code.includes('quota')) return '租户配额不足，请减小内容或调整配额后重试。';
  }
  return error instanceof Error ? error.message : '请求失败，请重试。';
}
function TenantIdentity({ tenant }: { tenant: BusinessTenant }) { return <div className="config-tenant-identity"><Icon name="tenant" size={16}/><strong>{tenant.name}</strong><code>{tenant.id}</code></div>; }
function Editor({ entry, tenant, csrf, deleting, onClose, onSaved }: { entry?: LoadedEntry; tenant: BusinessTenant; csrf: string; deleting?: boolean; onClose: () => void; onSaved: () => void }) {
  const scope = useContext(ConfigScope);
 const initial = entry ? decode(entry.value) : { text: '', binary: false };
  const [key, setKey] = useState(entry?.key ?? ''); const [value, setValue] = useState(initial.text); const [mode, setMode] = useState('text');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [pending, setPending] = useState<Mutation | null>(null); const [ambiguous, setAmbiguous] = useState(false); const [conflict, setConflict] = useState(false);
  const inFlight = useRef(false); const expire = useContext(SessionExpired);
  function close() { if (busy) return; if (ambiguous && !window.confirm('操作可能已生效。关闭后请重新读取配置确认结果，确定关闭吗？')) return; onClose(); }
  useEffect(() => { if (!ambiguous && !busy) return; const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [ambiguous, busy]);
  function validJSON() { try { JSON.parse(value); return true; } catch { setError('内容不是有效的 JSON。'); return false; } }
  async function submit() {
    if (inFlight.current || conflict) return;
    if (!key || bytes(key) > 2048 || bytes(value) > 65536 && !deleting) { setError('Key 不能为空且最多 2 KiB，内容最多 64 KiB。'); return; }
    if (!deleting && initial.binary) return;
    if (!deleting && mode === 'json' && !validJSON()) return;
    const body = pending ?? { request_id: crypto.randomUUID(), ...(entry ? { version: entry.version } : { if_absent: true }), ...(!deleting ? { value: encode(value) } : {}) };
    setPending(body); inFlight.current = true; setBusy(true); setError('');
    try {
      await request<ManagementResponse<unknown>>(entryPath(tenant.id, key,scope.tenant), { method: deleting ? 'DELETE' : 'PUT', headers: { 'Content-Type': 'application/json', 'X-Dubi-CSRF': csrf }, body: JSON.stringify(body) });
      toast.success(deleting ? '配置已删除。' : entry ? '配置已更新。' : '配置已创建。'); onSaved();
    } catch (err) {
      if (err instanceof APIError && err.status === 401) expire();
      const uncertain = !(err instanceof APIError) || err.status >= 500 || err.code === 'outcome_unknown';
      setAmbiguous(uncertain); setConflict(err instanceof APIError && (err.code === 'conflict' || err.code === 'version_conflict' || err.code === 'request_id_reused'));
      setError(uncertain ? '操作结果暂未确认。请保持内容不变，点击“确认结果 / 重试”，将使用同一请求安全重试。' : message(err));
      if (!uncertain) setPending(null);
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <PreviewDialog title={deleting ? '删除配置' : entry ? '编辑配置' : '新增配置'} description={deleting ? '删除后，应用将无法再读取此配置。' : entry ? '保存时校验读取到的版本，避免覆盖其他修改。' : '在当前租户内创建唯一的配置 Key。'} busy={busy} onClose={close} footer={<><small>{ambiguous ? '结果待确认' : '单项内容上限 64 KiB'}</small><button className="outline-button" disabled={busy} onClick={close}>关闭</button><button className={deleting ? 'config-delete-button' : 'config-primary-button'} type="submit" form="live-config-editor" disabled={busy || conflict || (!deleting && initial.binary)}>{busy ? '正在提交…' : ambiguous ? '确认结果 / 重试' : deleting ? '确认删除' : entry ? '保存修改' : '创建配置'}</button></>}><form id="live-config-editor" onSubmit={e => { e.preventDefault(); void submit(); }}><TenantIdentity tenant={tenant}/><label htmlFor="config-key">配置 Key</label><input id="config-key" value={key} onChange={e => setKey(e.target.value)} readOnly={!!entry || ambiguous || busy} required autoComplete="off"/>{entry && <p className="detail-help">当前版本 <code className="config-full-version">{entry.version}</code></p>}{!deleting && <><div className="config-editor-toolbar"><label htmlFor="config-value">配置内容</label><Select label="编辑格式" value={mode} onChange={v => { if (!busy && !ambiguous) setMode(v); }} options={[{ value: 'text', label: '纯文本' }, { value: 'json', label: 'JSON' }]}/>{mode === 'json' && <button type="button" className="text-button" disabled={busy || ambiguous} onClick={() => { if (validJSON()) setValue(JSON.stringify(JSON.parse(value), null, 2)); }}>格式化</button>}</div><textarea id="config-value" className="config-editor-value" value={value} onChange={e => setValue(e.target.value)} readOnly={busy || ambiguous || initial.binary} spellCheck={false}/><div className="config-editor-caption"><span>文本按 UTF-8 保存。</span><span>{size(bytes(value))} / 64 KiB</span></div>{initial.binary && <p className="detail-help">此内容不适合文本编辑，请通过 SDK 修改，以保留原始字节。</p>}</>}{deleting && <p className="detail-help">仅删除此租户中的配置，删除前会再次校验版本。</p>}{error && <div className="preview-form-error" role="alert">{error}{pending && <small className="cell-secondary">请求标识：{pending.request_id}</small>}</div>}</form></PreviewDialog>;
}
function Details({ entryKey, tenant, onClose, onEdit, onDelete, revision }: { entryKey: string; tenant: BusinessTenant; onClose: () => void; onEdit: (e: LoadedEntry) => void; onDelete: (e: LoadedEntry) => void; revision: number }) {
  const scope = useContext(ConfigScope); const drawer = useDrawer(onClose); const resource = useResource<Entry>(entryPath(tenant.id, entryKey,scope.tenant), revision); const entry = resource.response?.data; const decoded = entry ? decode(entry.value) : null;
  return <dialog ref={drawer.dialog} className={`inspect-drawer config-drawer${drawer.closing ? ' is-closing' : ''}`} onAnimationEnd={drawer.onAnimationEnd} onClick={drawer.onBackdropClick} onCancel={e => { e.preventDefault(); drawer.requestClose(); }} aria-labelledby="config-detail-title"><header className="drawer-header"><div><div className="eyebrow">配置详情</div><h2 id="config-detail-title">{entryKey}</h2></div><button className="icon-button" aria-label="关闭配置详情" onClick={drawer.requestClose} autoFocus><Icon name="close"/></button></header><div className="drawer-body"><TenantIdentity tenant={tenant}/>{resource.loading && !entry && <p>正在读取配置…</p>}{resource.error && <p role="alert">{message(resource.error)} <button className="text-button" onClick={resource.reload}>重新读取</button></p>}{entry && decoded && <><dl className="detail-fields"><dt>内容大小</dt><dd>{size(decoded.size)}</dd><dt>当前版本</dt><dd><code className="config-full-version">{entry.version}</code></dd></dl><div className="config-value-heading"><h3>{decoded.binary ? '原始内容（Base64）' : '配置内容'}</h3><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(decoded.text); toast.success('内容已复制。'); } catch { toast.error('复制失败，请选中内容手动复制。'); } }}>复制内容</button></div><pre className="config-code">{decoded.text || '（空值）'}</pre>{decoded.binary && <p className="detail-help">此内容包含非文本字节或特殊换行，网页仅展示 Base64，避免编辑时改变原始内容。</p>}</>}</div><footer className="drawer-footer config-drawer-footer"><button className="config-danger-button" disabled={scope.readOnly || !entry || !!resource.error || resource.loading} onClick={() => entry && onDelete({ ...entry, key: entryKey })}>删除配置</button><button className="config-primary-button" disabled={scope.readOnly || !entry || !!resource.error || resource.loading || decoded?.binary} onClick={() => entry && onEdit({ ...entry, key: entryKey })}>编辑配置</button></footer></dialog>;
}
function Workspace({ tenant, csrf, revision }: { tenant: BusinessTenant; csrf: string; revision: number }) {
  const scope = useContext(ConfigScope);
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [cursors, setCursors] = useState(['']); const [limit, setLimit] = useState('20'); const [generation, setGeneration] = useState(0);
  const [detail, setDetail] = useState<string | null>(null); const [editor, setEditor] = useState<{ entry?: LoadedEntry; deleting?: boolean } | null>(null);
  useEffect(() => { const timer = setTimeout(() => { setSearch(query); setCursors(['']); }, 300); return () => clearTimeout(timer); }, [query]);
  const resource = useResource<Page>(configPath('config', scope.tenant, { tenant: tenant.id, q: search, limit, cursor: cursors[cursors.length - 1] }), revision + generation);
  const rows = resource.response?.data.items ?? []; const next = resource.response?.data.next_cursor;
  function saved() { setEditor(null); setDetail(null); setCursors(['']); setGeneration(n => n + 1); }
  return <><div className="config-summary"><span>本页配置 <strong>{rows.length}</strong></span><span>单项上限 <strong>64 KiB</strong></span><span>数据范围 <strong>当前租户</strong></span></div><section className="panel config-panel"><div className="panel-heading"><div><h2>配置列表</h2><p>按创建顺序倒序排列，点击详情读取完整内容。</p></div><button className="config-primary-button" disabled={scope.readOnly} title={scope.readOnly?'只读账号不能新增配置':undefined} onClick={() => setEditor({})}><Icon name="plus" size={15}/>新增配置</button></div><div className="config-list-toolbar"><label className="search-field"><Icon name="search" size={16}/><input aria-label="搜索配置 Key" value={query} maxLength={256} onChange={e => setQuery(e.target.value)} placeholder="搜索配置 Key…"/></label><button className="text-button" disabled={resource.loading} onClick={resource.reload}>刷新列表</button></div>{resource.error && <p className="preview-form-error" role="alert">{message(resource.error)} <button className="text-button" onClick={resource.reload}>重试</button></p>}<div className="table-scroll"><table className="dense-table config-table"><thead><tr><th>配置 Key</th><th>大小</th><th>版本</th><th>状态</th><th>操作</th></tr></thead><tbody>{rows.map(item => <tr key={item.key}><td><button className="resource-link" onClick={() => setDetail(item.key)}><Icon name="config" size={16}/><code>{item.key}</code></button></td><td>{size(item.value_bytes)}</td><td><code className="config-version" title={item.version}>{item.version.slice(0, 12)}</code></td><td><span className={`status state-${item.confirmed ? 'healthy' : 'warning'}`}><i/>{item.confirmed ? '已确认' : '确认中'}</span></td><td><div className="config-row-actions"><button className="text-button" aria-label={`查看配置 ${item.key}`} onClick={() => setDetail(item.key)}>详情<Icon name="arrow" size={12}/></button></div></td></tr>)}</tbody></table></div>{!rows.length && <div className="config-empty"><Icon name="config" size={28}/><h3>{resource.loading ? '正在读取配置…' : resource.error ? '配置暂不可用' : next ? '本段没有匹配项' : '没有配置项'}</h3><p>{next ? '可继续翻页查找匹配的配置。' : search ? '可调整 Key 搜索条件。' : '新增配置后，当前租户的应用即可读取。'}</p></div>}<div className="pagination"><span>第 {cursors.length} 页 · 本页 {rows.length} 项</span><Select label="每页配置条数" value={limit} onChange={v => { setLimit(v); setCursors(['']); }} options={['10', '20', '50'].map(v => ({ value: v, label: `每页 ${v} 条` }))}/><button className="outline-button" disabled={cursors.length === 1 || resource.loading} onClick={() => setCursors(old => old.slice(0, -1))}>上一页</button><button className="outline-button" disabled={!next || resource.loading || !!resource.error} onClick={() => next && setCursors(old => [...old, next])}>下一页</button></div></section>{detail !== null && <Details key={detail} entryKey={detail} tenant={tenant} revision={revision + generation} onClose={() => setDetail(null)} onEdit={entry => { setDetail(null); setEditor({ entry }); }} onDelete={entry => { setDetail(null); setEditor({ entry, deleting: true }); }}/>}{editor && <Editor entry={editor.entry} deleting={editor.deleting} tenant={tenant} csrf={csrf} onClose={() => setEditor(null)} onSaved={saved}/>}</>;
}
export default function ConfigCenter({ tenantID, csrf, revision, moduleID = 'config' }: { tenantID: string; csrf: string; revision: number; moduleID?: string }) {
  const tenant = useBusinessTenant(tenantID, revision);
  if (!tenantID) return <section className="panel config-empty"><Icon name="tenant" size={30}/><h3>先选择一个租户</h3><p>通过上方租户栏选择后，即可查看和管理业务数据。</p></section>;
  if (tenant.error || !tenant.response) return <section className="panel config-empty"><h3>{tenant.error ? '当前租户暂不可用' : '正在读取租户…'}</h3>{tenant.error && <><p role="alert">{message(tenant.error)}</p><button className="outline-button" onClick={tenant.reload}>重试</button></>}</section>;
  const current = tenantView(tenant.response.data);
  if (!current.modules.includes(moduleID)) return <section className="panel config-empty"><Icon name="shield" size={30}/><h3>此租户未开通{moduleID === 'config' ? '配置中心' : '分布式缓存'}</h3><p>可切换租户，或在“租户与配额”中调整模块权限。</p></section>;
  if (moduleID !== 'config') return <section className="panel config-empty"><h3>分布式缓存</h3><p>缓存数据页面暂未开放。</p></section>;
  return <Workspace key={tenantID} tenant={current} csrf={csrf} revision={revision}/>;
}

export function TenantConfig({tenant,csrf,revision,readOnly}:{tenant:BusinessTenant;csrf:string;revision:number;readOnly:boolean}){return <ConfigScope.Provider value={{tenant:true,readOnly}}><Workspace key={tenant.id} tenant={tenant} csrf={csrf} revision={revision}/></ConfigScope.Provider>;}
