import ResourceID from '../components/ResourceID';
import { useState } from 'react';
import Icon from '../Icon';
import type { IconName } from '../Icon';
import Select from '../components/Select';
import { adminPath, segment, useResource } from './resource';
import { ActivityList, Badge, CapacityView, ObservationView, Pager, ResourceView, bytes, kinds, statusOptions, usePager } from './components';
import NodeDetails from './NodeDetails';
import Storage from './Storage';
import type { Cluster, ManagedNode, ManagementList, NodeMaintenance, Region } from './types';
import type { GatewayInfo } from '../api';
import './management.css';

function RegionCards({ regions, onSelect }: { regions: Region[]; onSelect: (id: string) => void }) {
  return <div className="region-grid live-regions">{regions.map(region => <article className="region-card" key={region.region_id}><div className="region-top"><Icon name="globe"/><Badge status={region.status}/></div><h3 title={region.region_id}>{region.region_id}</h3><p className="subtle">{region.node_count} 个节点 · 已获取 {region.observed_nodes} 个节点状态</p><div className="region-state-counts">{(['healthy', 'degraded', 'unavailable', 'unknown'] as const).map(status => <Badge key={status} status={status} count={region.node_states?.[status] ?? 0}/>)}</div><CapacityView capacity={region.capacity}/><p className="detail-help">容量统计 {region.capacity_observed_nodes} / {region.node_count} 节点</p><ObservationView observation={region}/><button className="region-link" onClick={() => onSelect(region.region_id)}>查看区域内节点<Icon name="arrow" size={13}/></button></article>)}</div>;
}
function ClusterSummary({ value }: { value: Cluster }) {
  const capacity = value.capacity;
  return <section className="health-summary"><div className="health-summary-heading"><span className="cluster-symbol"><Icon name="grid" size={24}/></span><div><h2><ResourceID value={value.cluster_id} copy/></h2><p>节点状态与存储容量</p></div><Badge status={value.status}/></div><div className="summary-metrics"><div><span>节点总数</span><strong>{value.node_count}<small>个节点</small></strong></div><div><span>区域</span><strong>{value.regions?.length ?? 0}<small>个</small></strong></div><div><span>文件系统已用容量</span><strong className="bytes-stat">{capacity ? bytes(Math.max(0, capacity.filesystem_total_bytes - capacity.filesystem_available_bytes)) : '未知'}</strong><p>容量统计 {value.capacity_observed_nodes} / {value.node_count} 节点</p></div><div><span>文件系统总容量</span><strong className="bytes-stat">{bytes(capacity?.filesystem_total_bytes)}</strong><p>统计 {value.capacity_observed_nodes} / {value.node_count} 个节点</p></div></div></section>;
}
export default function Workspace({ page, revision, onNavigate }: { page: IconName; revision: number; onNavigate: (page: IconName) => void }) {
  const [region, setRegion] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [limit, setLimit] = useState('20');
  const [selection, setSelection] = useState<{ id: string; tab: string } | null>(null);
  const cluster = useResource<Cluster>(page !== 'gateway' ? adminPath('cluster') : null, revision);
  const regionPager = usePager('regions');
  const regions = useResource<ManagementList<Region>>(page === 'globe' ? adminPath('regions', { limit: '20', cursor: regionPager.cursor }) : null, revision);
  const nodeBase = region ? `regions/${segment(region)}/nodes` : 'nodes';
  const nodePager = usePager(`${nodeBase}:${name}:${status}:${limit}`);
  const nodes = useResource<ManagementList<ManagedNode>>(page === 'globe' ? adminPath(nodeBase, { name, status, limit, cursor: nodePager.cursor }) : null, revision);
  const maintenancePager = usePager(`${region}:${kind}:${limit}`);
  const maintenance = useResource<ManagementList<NodeMaintenance>>(page === 'tool' ? adminPath('maintenance', { region, kind, limit, cursor: maintenancePager.cursor }) : null, revision);
  const gateway = useResource<GatewayInfo>(page === 'gateway' ? adminPath('gateway') : null, revision);
  const regionOptions = [{ value: '', label: '全部区域' }, ...(cluster.response?.data.regions ?? []).map(value => ({ value: value.region_id, label: value.region_id }))];
  // Retain the selected region even if a later directory observation no longer includes it.
  if (region && !regionOptions.some(option => option.value === region)) regionOptions.push({ value: region, label: `${region}（未在当前目录中）` });
  function inspect(id: string, tab = 'overview') { setSelection({ id, tab }); }
  function chooseRegion(id: string) { setRegion(id); setName(''); setNameInput(''); setStatus(''); onNavigate('globe'); }
  function clearFilters() { setRegion(''); setStatus(''); setName(''); setNameInput(''); nodePager.reset(); }
  function nodeToolbar() { return <form className="list-toolbar" onSubmit={event => { event.preventDefault(); setName(nameInput.trim()); nodePager.reset(); }}><label className="search-field"><Icon name="search" size={17}/><input aria-label="精确匹配节点名称" placeholder="节点名称（精确匹配）" value={nameInput} onChange={event => setNameInput(event.target.value)}/></label><button className="outline-button" type="submit">查询</button><Select label="筛选区域" value={region} onChange={setRegion} options={regionOptions}/><Select label="筛选节点状态" value={status} onChange={setStatus} options={statusOptions}/>{(region || status || name) && <button type="button" className="text-button" onClick={clearFilters}>清除筛选</button>}</form>; }
  function nodeTable(items: ManagedNode[]) { return <div className="table-scroll"><table className="dense-table"><thead><tr><th>节点 / ID</th><th>所属区域</th><th>Volume</th><th>文件系统使用</th><th>状态更新</th><th>状态</th><th>操作</th></tr></thead><tbody>{items.map(node => <tr key={node.node_id}><td><button className="resource-link" onClick={() => inspect(node.node_id, 'overview')}><Icon name="server" size={16}/>{node.name || '未命名节点'}</button><code className="cell-secondary resource-id" title={node.node_id}><ResourceID value={node.node_id}/></code></td><td>{node.region_id}</td><td>{node.volume_count ?? '未知'}<small className="cell-secondary">已获取容量 {node.capacity_observed_volumes ?? '未知'}</small></td><td><CapacityView capacity={node.capacity}/></td><td><ObservationView observation={node}/></td><td><Badge status={node.status}/></td><td><button className="text-button" onClick={() => inspect(node.node_id, 'overview')}>详情<Icon name="arrow" size={13}/></button></td></tr>)}</tbody></table></div>; }
  return <>
    {page === 'volume' && <Storage cluster={cluster} revision={revision}/>}
    {page === 'grid' && <ResourceView resource={cluster}>{value => <><ClusterSummary value={value}/>{page === 'grid' && <section className="section-block"><div className="section-heading"><h2>区域分布 <span>{value.regions?.length ?? 0}</span></h2><button className="text-button" onClick={() => { clearFilters(); onNavigate('globe'); }}>查看全部节点<Icon name="arrow" size={13}/></button></div><RegionCards regions={value.regions ?? []} onSelect={chooseRegion}/>{!value.regions?.length && <p className="empty-copy">暂无区域信息。</p>}</section>}</>}</ResourceView>}
    {page === 'globe' && <section className="section-block">{regions.error && regionPager.page > 1 && <button className="outline-button" onClick={regionPager.reset}>区域列表返回第一页</button>}<ResourceView resource={regions}>{list => <><RegionCards regions={list.items ?? []} onSelect={chooseRegion}/>{!list.items?.length && <p className="empty-copy">当前页没有区域。</p>}{(list.next_cursor || regionPager.page > 1) && <div className="pagination"><span>区域第 {regionPager.page} 页</span><button className="outline-button" disabled={regions.loading || !!regions.error || regionPager.page === 1} onClick={regionPager.previous}>上一页</button><button className="outline-button" disabled={regions.loading || !!regions.error || !list.next_cursor} onClick={() => regionPager.next(list.next_cursor)}>下一页</button></div>}</>}</ResourceView></section>}
    {page === 'globe' && <section className="panel"><div className="panel-heading"><h2>节点列表</h2></div>{nodeToolbar()}{nodes.error && nodePager.page > 1 && <button className="outline-button" onClick={nodePager.reset}>节点列表返回第一页</button>}<ResourceView resource={nodes}>{list => <>{nodeTable(list.items ?? [])}{!list.items?.length && <div className="list-empty"><h3>未找到匹配的节点</h3><p>请检查完整节点名称，或调整筛选条件。</p><button className="outline-button" onClick={clearFilters}>清除筛选并回到第一页</button></div>}<Pager pager={nodePager} next={list.next_cursor} count={list.items?.length ?? 0} limit={limit} setLimit={setLimit} disabled={nodes.loading || !!nodes.error}/></>}</ResourceView></section>}
    {page === 'tool' && <section className="panel"><div className="panel-heading"><h2>维护状态</h2></div><div className="list-toolbar"><Select label="筛选区域" value={region} onChange={setRegion} options={regionOptions}/><Select label="维护类型" value={kind} onChange={setKind} options={[{ value: '', label: '全部维护类型' }, ...Object.entries(kinds).map(([value, label]) => ({ value, label }))]}/></div>{maintenance.error && maintenancePager.page > 1 && <button className="outline-button" onClick={maintenancePager.reset}>维护列表返回第一页</button>}<ResourceView resource={maintenance}>{list => <>{(list.items ?? []).map(item => <details className="maintenance-node" key={item.node_id}><summary><span>{item.region_id} / <code><ResourceID value={item.node_id}/></code></span><ObservationView observation={item}/></summary><ActivityList items={item.items}/><button className="text-button" onClick={() => inspect(item.node_id, 'maintenance')}>查看节点维护详情<Icon name="arrow" size={13}/></button></details>)}{!list.items?.length && <p className="empty-copy">暂无维护状态信息。</p>}<Pager pager={maintenancePager} next={list.next_cursor} count={list.items?.length ?? 0} limit={limit} setLimit={setLimit} disabled={maintenance.loading || !!maintenance.error}/></>}</ResourceView></section>}
    {page === 'gateway' && <section className="panel gateway-panel"><div className="panel-heading"><h2>当前 HTTP 入口</h2></div><ResourceView resource={gateway}>{value => <><dl><dt>集群</dt><dd><ResourceID value={value.cluster_id} copy/></dd><dt>当前节点</dt><dd><ResourceID value={value.node_id} copy/></dd><dt>API 版本</dt><dd>{value.api_version}</dd><dt>已接入模块</dt><dd>{value.business_modules?.join('、') || '暂无'}</dd></dl><details className="technical-details gateway-raw"><summary>入口与证书详细信息</summary><pre>{JSON.stringify(value, null, 2)}</pre></details></>}</ResourceView></section>}
    {selection && <NodeDetails key={selection.id} nodeId={selection.id} initialTab={selection.tab} revision={revision} onClose={() => setSelection(null)}/>}
  </>;
}
