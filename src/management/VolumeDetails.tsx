import ResourceID, { shortResourceID } from '../components/ResourceID';
import { useState } from 'react';
import Icon from '../Icon';
import useDrawer from '../components/useDrawer';
import { adminPath, segment, useResource } from './resource';
import { ActivityList, CapacityView, ObservationView, ResourceView } from './components';
import type { ClusterVolume, Volume } from './types';

const healthLabels: Record<string, string> = { healthy: '正常', missing: '不可访问', invalid: '无效', pending: '待就绪', removed: '已移除', unknown: '未知', error: '异常' };
export const volumeStatusOptions = [{ value: '', label: '全部状态' }, ...Object.entries(healthLabels).map(([value, label]) => ({ value, label }))];
const stateLabels: Record<string, string> = { active: '使用中', draining: '迁移中', removed: '已移除', disabled: '已停用' };
export function VolumeStatus({ volume }: { volume: Volume }) {
  const unknown = volume.stale || volume.observed_unix == null || !healthLabels[volume.health];
  const label = unknown ? '未知' : healthLabels[volume.health] ?? volume.health ?? '未知';
  const tone = unknown ? 'unknown' : volume.health === 'healthy' ? 'healthy' : volume.health === 'missing' || volume.health === 'invalid' ? 'unavailable' : volume.health === 'removed' ? 'unknown' : 'warning';
  return <span className={`status state-${tone}`} title={volume.error || undefined}><i/>{label || '未知'}</span>;
}

export default function VolumeDetails({ volume: owner, revision, onClose }: { volume: ClusterVolume; revision: number; onClose: () => void }) {
  const { dialog, closing, requestClose, onAnimationEnd } = useDrawer(onClose);
  const [refresh, setRefresh] = useState(0);
  const resource = useResource<Volume>(adminPath(`nodes/${segment(owner.node_id)}/volumes/${segment(owner.volume_id)}`), revision + refresh);
  return <dialog ref={dialog} className={`inspect-drawer${closing ? ' is-closing' : ''}`} aria-labelledby="volume-title" onAnimationEnd={onAnimationEnd} onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => {
    if (event.target === event.currentTarget && event.clientX < event.currentTarget.getBoundingClientRect().left) requestClose();
  }}>
    <header className="drawer-header"><div><div className="eyebrow">Volume 详情</div><h2 id="volume-title"><ResourceID value={owner.volume_id}/></h2><p>{owner.node_name || shortResourceID(owner.node_id)} / {owner.region_id}</p></div><div className="drawer-actions"><button className="icon-button" aria-label="刷新 Volume 详情" onClick={() => setRefresh(value => value + 1)}><Icon name="refresh" size={18}/></button><button className="icon-button" aria-label="关闭 Volume 详情" onClick={requestClose} autoFocus><Icon name="close"/></button></div></header>
    <div className="drawer-body"><ResourceView resource={resource}>{volume => <>
      <div className="detail-health"><VolumeStatus volume={volume}/><ObservationView observation={volume}/></div>
      <h3>容量与使用</h3><div className="drawer-capacity"><CapacityView capacity={volume.capacity}/></div>
      <h3 className="volume-section-title">基本信息</h3><dl className="detail-fields"><dt>Volume ID</dt><dd><code><ResourceID value={volume.volume_id} copy/></code></dd><dt>路径</dt><dd><code>{volume.path}</code></dd><dt>所属节点</dt><dd>{owner.node_name || '未命名节点'}<code className="cell-secondary"><ResourceID value={owner.node_id} copy/></code></dd><dt>所属区域</dt><dd>{owner.region_id}</dd><dt>使用状态</dt><dd>{stateLabels[volume.state] ?? (volume.state || '未知')}</dd><dt>写入隔离</dt><dd>{volume.stale ? '未知（上次状态：' + (volume.write_isolated ? '已隔离' : '未隔离') + '）' : volume.write_isolated ? '已隔离' : '未隔离'}</dd></dl>
      {(volume.error || volume.write_error) && <div className="request-error" role="status"><div><strong>异常信息</strong>{volume.error && <p>{volume.error}</p>}{volume.write_error && <p>{volume.write_error}</p>}</div></div>}
      {volume.migration && <><h3>数据迁移</h3><ActivityList items={[volume.migration]}/></>}
    </>}</ResourceView></div>
  </dialog>;
}
