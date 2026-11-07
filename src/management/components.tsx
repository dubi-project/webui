import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { APIError } from '../api';
import Select from '../components/Select';
import type { Resource } from './resource';
import type { Capacity, Observation, ManagementMeta, Activity } from './types';

export const statusOptions = [{ value: '', label: '全部状态' }, { value: 'healthy', label: '正常' }, { value: 'degraded', label: '降级' }, { value: 'unavailable', label: '不可达' }, { value: 'unknown', label: '未知' }];
const labels: Record<string, string> = { healthy: '正常', degraded: '降级', unavailable: '不可达', unknown: '未知', ok: '健康' };
export function Badge({ status, count }: { status: string; count?: number }) {
  const tone = status === 'healthy' || status === 'ok' ? 'healthy' : status === 'degraded' ? 'warning' : status === 'unavailable' ? 'unavailable' : 'unknown';
  return <span className={`status state-${tone}`}><i/>{labels[status] ?? status}{count !== undefined && <strong className="status-count">{count}</strong>}</span>;
}
export function dateTime(value: number | null | undefined) { return value == null || value === 0 ? '未知' : new Date(value * 1000).toLocaleString(); }
export function bytes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '未知';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let number = value, index = 0;
  while (number >= 1024 && index < units.length - 1) { number /= 1024; index++; }
  return `${number.toLocaleString(undefined, { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}
export function CapacityView({ capacity }: { capacity: Capacity | null }) {
  if (!capacity) return <span className="unknown-value">未知</span>;
  const total = capacity.filesystem_total_bytes;
  const used = Math.max(0, total - capacity.filesystem_available_bytes);
  const percent = total > 0 ? Math.min(100, used / total * 100) : null;
  return <div className="capacity-cell"><div><span className="mono">{bytes(used)} <small>/ {bytes(total)}</small></span><span>{percent === null ? '—' : `${percent.toFixed(1)}%`}</span></div>{percent !== null && <div className="meter"><span style={{ width: `${percent}%` }}/></div>}</div>;
}
export function ObservationView({ observation }: { observation: Observation }) {
  return <span className={`observation-label ${observation.stale || !observation.complete ? 'observation-warning' : ''}`}>{observation.stale ? '历史状态 · ' : ''}{observation.complete ? '状态已获取' : '部分状态缺失'}<small>{dateTime(observation.observed_unix)}</small></span>;
}
export function MetaView({ meta, stale = false }: { meta: ManagementMeta; stale?: boolean }) {
  return <div className={`response-meta ${!meta.complete || stale ? 'response-partial' : ''}`}><span>{stale ? '保留上次结果 · ' : ''}{meta.complete ? '更新于' : '部分状态缺失 · 更新于'} · {dateTime(meta.generated_unix)}</span>{(meta.errors?.length || meta.errors_truncated) ? <details><summary>查看缺失原因</summary><ul>{(meta.errors ?? []).map((error, index) => <li key={index}>{error.node_id && <code>{error.node_id} · </code>}{error.message || error.code}</li>)}</ul>{meta.errors_truncated && <p>原因列表已截断，未展示全部错误。</p>}<small>请求 ID：{meta.request_id}</small></details> : null}</div>;
}
export function ResourceView<T>({ resource, children }: { resource: Resource<T>; children: (data: T) => ReactNode }) {
  const { response, error, loading } = resource;
  const status = error instanceof APIError ? error.status : null;
  return <div aria-busy={loading}>
    {error && <div className="request-error" role="alert"><div><strong>{status === 403 ? '没有访问权限' : status === 404 ? '目标不存在或已被移除' : status === 503 ? '暂时无法获取状态' : '读取失败'}</strong><p>{error.message}{response ? ' 当前显示上次获取的结果。' : ''}</p>{error instanceof APIError && error.requestId && <small>请求 ID：{error.requestId}</small>}</div><button className="outline-button" onClick={resource.reload} disabled={loading}>重试</button></div>}
    {loading && !response && <p className="loading-line" role="status">正在读取…</p>}
    {response && <><MetaView meta={response.meta} stale={!!error}/>{children(response.data)}</>}
  </div>;
}
export function usePager(scope: string) {
  const [state, setState] = useState({ scope, cursors: [''] });
  useEffect(() => { setState(previous => previous.scope === scope ? previous : { scope, cursors: [''] }); }, [scope]);
  const cursors = state.scope === scope ? state.cursors : [''];
  return {
    cursor: cursors[cursors.length - 1], page: cursors.length,
    previous: () => setState({ scope, cursors: cursors.slice(0, -1) }),
    next: (cursor: string) => setState({ scope, cursors: [...cursors, cursor] }),
    reset: () => setState({ scope, cursors: [''] }),
  };
}
export function Pager({ pager, next, count, limit, setLimit, disabled }: { pager: ReturnType<typeof usePager>; next: string; count: number; limit: string; setLimit: (value: string) => void; disabled: boolean }) {
  return <div className="pagination"><span>第 {pager.page} 页 · 本页 {count} 条</span><Select label="每页条数" value={limit} onChange={setLimit} options={['20', '50', '100'].map(value => ({ value, label: `每页 ${value} 条` }))}/><button className="outline-button" disabled={disabled || pager.page === 1} onClick={pager.previous}>上一页</button><button className="outline-button" disabled={disabled || !next} onClick={() => pager.next(next)}>下一页</button></div>;
}
export const kinds: Record<string, string> = { repair: '数据修复', rebalance: '数据再平衡', geo_sync: '跨区域同步', volume_migration: 'Volume 迁移' };
const phases: Record<string, string> = { observed: '已观测', disabled: '已停用', pending: '待处理', repairing: '修复中', confirming: '确认中', waiting_root: '等待集群状态确认', waiting_owner: '等待数据状态确认', scan: '扫描中', unknown: '未知', idle: '空闲', running: '进行中', checking: '检查中', prepared: '已准备', dropped: '已移交', canceling: '取消中', multiple: '多个阶段', no_active_handoff: '无活动交接' };
export function ActivityList({ items }: { items: Activity[] | null }) {
  if (!items?.length) return <p className="empty-copy">暂无维护状态信息。</p>;
  return <div className="activity-list">{items.map((item, index) => <section key={`${item.kind}-${index}`}><h3>{kinds[item.kind] ?? item.kind}<span>{!item.supported ? '暂未提供状态' : phases[item.phase] ?? item.phase}</span></h3><dl className="detail-fields"><dt>已处理</dt><dd>{item.processed ?? '未知'} {item.processed != null ? ({ records_scanned: '条记录', records: '条记录' } as Record<string, string>)[item.unit ?? ''] ?? item.unit ?? '' : ''}</dd><dt>待处理</dt><dd>{item.pending ?? '未知'}</dd><dt>总量</dt><dd>{item.total ?? '未知'}</dd><dt>最近进展</dt><dd>{dateTime(item.last_progress_unix)}</dd>{item.needs_full_scan != null && <><dt>需要全量扫描</dt><dd>{item.needs_full_scan ? '是' : '否'}</dd></>}{item.source_volume_id && <><dt>源 Volume</dt><dd><code>{item.source_volume_id}</code></dd></>}{item.target_volume_id && <><dt>目标 Volume</dt><dd><code>{item.target_volume_id}</code></dd></>}</dl>{!!item.errors?.length && <ul className="inline-errors">{item.errors.map((error, i) => <li key={i}>{error}</li>)}</ul>}</section>)}</div>;
}
