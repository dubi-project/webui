import ResourceID, { shortResourceID } from '../components/ResourceID';
import { useState } from 'react';
import Icon from '../Icon';
import Select from '../components/Select';
import { adminPath, useResource } from './resource';
import { bytes, CapacityView, Pager, ResourceView, usePager } from './components';
import type { Cluster, ClusterVolume, ManagementList } from './types';
import type { Resource } from './resource';
import VolumeDetails, { VolumeStatus, volumeStatusOptions } from './VolumeDetails';
import RegionNodeSelect from './RegionNodeSelect';

export default function Storage({ cluster, revision }: { cluster: Resource<Cluster>; revision: number }) {
  const [region, setRegion] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState('20');
  const [selected, setSelected] = useState<ClusterVolume | null>(null);
  const pager = usePager(`${region}:${nodeId}:${status}:${limit}`);
  const volumes = useResource<ManagementList<ClusterVolume>>(adminPath('volumes', { region, node_id: nodeId, status, limit, cursor: pager.cursor }), revision);
  const regionOptions = [{ value: '', label: '全部区域' }, ...(cluster.response?.data.regions ?? []).map(item => ({ value: item.region_id, label: item.region_id }))];
  if (region && !regionOptions.some(item => item.value === region)) regionOptions.push({ value: region, label: region });
  function selectRegion(value: string) { setRegion(value); setNodeId(''); pager.reset(); }
  function clear() { setRegion(''); setNodeId(''); setStatus(''); pager.reset(); }
  return <>
    <ResourceView resource={cluster}>{value => {
      const capacity = value.capacity;
      const used = capacity ? Math.max(0, capacity.filesystem_total_bytes - capacity.filesystem_available_bytes) : null;
      const percent = capacity && capacity.filesystem_total_bytes > 0 ? Math.min(100, used! / capacity.filesystem_total_bytes * 100) : null;
      return <div className="volume-summary"><div><span>集群文件系统总容量</span><strong>{bytes(capacity?.filesystem_total_bytes)}</strong><p>已统计 {value.capacity_observed_nodes} / {value.node_count} 个节点</p></div><div><span>已用容量</span><strong>{bytes(used)}</strong><p>使用率 {percent === null ? '未知' : `${percent.toFixed(1)}%`}</p></div><div><span>可用容量</span><strong>{bytes(capacity?.filesystem_available_bytes)}</strong><p>同一节点的文件系统去重统计</p></div></div>;
    }}</ResourceView>
    <section className="panel"><div className="panel-heading"><h2>Volume 列表</h2></div>
      <div className="list-toolbar"><Select label="筛选 Volume 所属区域" value={region} onChange={selectRegion} options={regionOptions}/><RegionNodeSelect key={`${region}:${revision}`} region={region} value={nodeId} onChange={setNodeId} revision={revision}/><Select label="筛选 Volume 状态" value={status} onChange={setStatus} options={volumeStatusOptions}/>{(region || nodeId || status) && <button type="button" className="text-button" onClick={clear}>清除筛选</button>}</div>
      {volumes.error && pager.page > 1 && <button className="outline-button" onClick={pager.reset}>Volume 列表返回第一页</button>}
      <ResourceView resource={volumes}>{list => <><div className="table-scroll"><table className="dense-table"><thead><tr><th>Volume / 路径</th><th>节点 / 区域</th><th>容量 / 使用</th><th>写入隔离</th><th>状态</th><th>操作</th></tr></thead><tbody>{(list.items ?? []).map(volume => <tr key={`${volume.node_id}:${volume.volume_id}`}><td><button className="resource-link" onClick={() => setSelected(volume)}><Icon name="volume" size={17}/><ResourceID value={volume.volume_id}/></button><code className="cell-secondary volume-path" title={volume.path}>{volume.path}</code></td><td><strong title={volume.node_id}>{volume.node_name || shortResourceID(volume.node_id)}</strong><span className="cell-secondary">{volume.region_id}</span></td><td><CapacityView capacity={volume.capacity}/></td><td>{volume.stale ? '未知' : volume.write_isolated ? '已隔离' : '未隔离'}</td><td><VolumeStatus volume={volume}/>{volume.stale && <small className="cell-secondary">历史状态</small>}</td><td><button className="text-button" onClick={() => setSelected(volume)} aria-label={`查看 Volume ${volume.volume_id} 详情`}>详情<Icon name="arrow" size={13}/></button></td></tr>)}</tbody></table></div>{!list.items?.length && <div className="list-empty"><h3>{volumes.response?.meta.complete ? '未找到匹配的 Volume' : '暂未获取到 Volume 信息'}</h3><p>{volumes.response?.meta.complete ? '可调整区域、节点或状态筛选条件。' : '部分节点信息无法获取，请查看上方提示并重试。'}</p></div>}<Pager pager={pager} next={list.next_cursor} count={list.items?.length ?? 0} limit={limit} setLimit={setLimit} disabled={volumes.loading || !!volumes.error}/></>}</ResourceView>
    </section>
    {selected && <VolumeDetails key={`${selected.node_id}:${selected.volume_id}`} volume={selected} revision={revision} onClose={() => setSelected(null)}/>}
  </>;
}
