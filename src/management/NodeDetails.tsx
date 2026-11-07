import ResourceID, { shortResourceID } from '../components/ResourceID';
import { useState } from 'react';
import useDrawer from '../components/useDrawer';
import Icon from '../Icon';
import { adminPath, segment, useResource } from './resource';
import { ActivityList, Badge, CapacityView, ObservationView, Pager, ResourceView, bytes, usePager } from './components';
import type { ManagedNode, ManagementList, NodeMaintenance, Volume } from './types';

function VolumeDetails({ nodeId, volumeId, revision }: { nodeId: string; volumeId: string; revision: number }) {
  const resource = useResource<Volume>(adminPath(`nodes/${segment(nodeId)}/volumes/${segment(volumeId)}`), revision);
  return <ResourceView resource={resource}>{volume => <section className="volume-inspect"><h3>Volume 详情</h3><dl className="detail-fields"><dt>Volume ID</dt><dd><code><ResourceID value={volume.volume_id} copy/></code></dd><dt>路径</dt><dd><code>{volume.path}</code></dd><dt>登记状态</dt><dd>{volume.state}</dd><dt>健康状态</dt><dd>{volume.health}</dd><dt>写入隔离</dt><dd>{volume.write_isolated ? '已隔离' : '未隔离'}</dd></dl><ObservationView observation={volume}/><CapacityView capacity={volume.capacity}/>{(volume.error || volume.write_error) && <p className="inline-errors">{volume.error} {volume.write_error}</p>}{volume.migration && <ActivityList items={[volume.migration]}/>}</section>}</ResourceView>;
}
function Volumes({ nodeId, revision }: { nodeId: string; revision: number }) {
  const [limit, setLimit] = useState('20');
  const [selected, setSelected] = useState<string | null>(null);
  const pager = usePager(`${nodeId}:${limit}`);
  const path = adminPath(`nodes/${segment(nodeId)}/volumes`, { limit, cursor: pager.cursor });
  const resource = useResource<ManagementList<Volume>>(path, revision);
  return <>{resource.error && pager.page > 1 && <button className="outline-button" onClick={pager.reset}>Volume 列表返回第一页</button>}<ResourceView resource={resource}>{list => <><div className="volume-list">{(list.items ?? []).map(volume => <button className="volume-choice" key={volume.volume_id} onClick={() => setSelected(volume.volume_id)} aria-pressed={selected === volume.volume_id}><span><strong><ResourceID value={volume.volume_id}/></strong><small>{volume.path}</small></span><span>{volume.health}<small>{volume.write_isolated ? '写入已隔离' : '写入未隔离'}</small></span><CapacityView capacity={volume.capacity}/><ObservationView observation={volume}/></button>)}</div>{!list.items?.length && <p className="empty-copy">暂无 Volume 信息。</p>}<Pager pager={pager} next={list.next_cursor} count={list.items?.length ?? 0} limit={limit} setLimit={value => { setLimit(value); setSelected(null); }} disabled={resource.loading || !!resource.error}/></>}</ResourceView>{selected && <VolumeDetails key={selected} nodeId={nodeId} volumeId={selected} revision={revision}/>}</>;
}
export default function NodeDetails({ nodeId, initialTab, revision, onClose }: { nodeId: string; initialTab: string; revision: number; onClose: () => void }) {
  const { dialog, closing, requestClose, onAnimationEnd } = useDrawer(onClose);
  const [tab, setTab] = useState(initialTab);
  const [localRevision, setLocalRevision] = useState(0);
  const refresh = revision + localRevision;
  const node = useResource<ManagedNode>(adminPath(`nodes/${segment(nodeId)}`), refresh);
  const maintenance = useResource<NodeMaintenance>(tab === 'maintenance' ? adminPath(`nodes/${segment(nodeId)}/maintenance`) : null, refresh);

  return <dialog ref={dialog} className={`inspect-drawer${closing ? ' is-closing' : ''}`} onAnimationEnd={onAnimationEnd} aria-labelledby="live-node-title" onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => {
    if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right) requestClose(); }
  }}><header className="drawer-header"><div><div className="eyebrow">节点详情</div><h2 id="live-node-title">{node.response?.data.name || shortResourceID(nodeId)}</h2><p><code><ResourceID value={nodeId} copy/></code></p></div><div className="drawer-actions"><button className="icon-button" aria-label="刷新节点详情" onClick={() => setLocalRevision(value => value + 1)}><Icon name="refresh" size={18}/></button><button className="icon-button" aria-label="关闭节点详情" onClick={requestClose} autoFocus><Icon name="close"/></button></div></header>
    <div className="drawer-tabs" role="tablist" aria-label="节点详情分类">{[['overview', '概览'], ['volumes', 'Volume'], ['maintenance', '维护状态']].map(([id, label]) => <button key={id} id={`live-tab-${id}`} role="tab" aria-controls="live-node-panel" aria-selected={id === tab} tabIndex={id === tab ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => {
      const ids = ['overview', 'volumes', 'maintenance'];
      if (!['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (ids.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      setTab(ids[index]); document.getElementById(`live-tab-${ids[index]}`)?.focus();
    }}>{label}</button>)}</div>
    <div className="drawer-body" role="tabpanel" id="live-node-panel" aria-labelledby={`live-tab-${tab}`}>
      {tab === 'overview' && <ResourceView resource={node}>{value => <><div className="detail-health"><Badge status={value.status}/><ObservationView observation={value}/></div><dl className="detail-fields"><dt>节点名称</dt><dd>{value.name || '未命名'}</dd><dt>Node ID</dt><dd><code>{value.node_id}</code></dd><dt>所属区域</dt><dd>{value.region_id}</dd><dt>成员身份</dt><dd>{value.membership}</dd><dt>Volume 数量</dt><dd>{value.volume_count ?? '未知'}</dd><dt>已获取容量的 Volume</dt><dd>{value.capacity_observed_volumes ?? '未知'} / {value.volume_count ?? '未知'} 个 Volume</dd><dt>单次放置可写额度</dt><dd>{bytes(value.capacity?.writable_bytes)}</dd></dl><h3>节点文件系统容量</h3><CapacityView capacity={value.capacity}/><p className="detail-help">容量按文件系统统计；可写额度随可用空间变化。</p>{!!value.reasons?.length && <ul className="inline-errors">{value.reasons.map((reason, index) => <li key={index}>{reason.message || reason.code}</li>)}</ul>}</>}</ResourceView>}
      {tab === 'volumes' && <Volumes nodeId={nodeId} revision={refresh}/>}
      {tab === 'maintenance' && <ResourceView resource={maintenance}>{value => <><ObservationView observation={value}/><ActivityList items={value.items}/></>}</ResourceView>}
    </div></dialog>;
}
