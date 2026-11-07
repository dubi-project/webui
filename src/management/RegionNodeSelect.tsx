import { shortResourceID } from '../components/ResourceID';
import { useEffect, useState } from 'react';
import Select from '../components/Select';
import { adminPath, segment, useResource } from './resource';
import type { ManagedNode, ManagementList } from './types';

export default function RegionNodeSelect({ region, value, onChange, revision, label = '筛选 Volume 所属节点' }: { label?: string; region: string; value: string; onChange: (value: string) => void; revision: number }) {
  const [cursor, setCursor] = useState('');
  const [items, setItems] = useState<ManagedNode[]>([]);
  const nodes = useResource<ManagementList<ManagedNode>>(region ? adminPath(`regions/${segment(region)}/nodes`, { limit: '50', cursor }) : null, revision);
  useEffect(() => {
    if (!nodes.response) return;
    const rows = nodes.response.data.items ?? [];
    setItems(previous => [...new Map((cursor ? [...previous, ...rows] : rows).map(node => [node.node_id, node])).values()]);
  }, [nodes.response, cursor]);
  const options = [{ value: '', label: !region ? '请先选择区域' : nodes.loading && !items.length ? '正在加载节点…' : '全部节点' }, ...items.map(node => ({ value: node.node_id, label: node.name || shortResourceID(node.node_id) }))];
  if (value && !options.some(option => option.value === value)) options.push({ value, label: shortResourceID(value) });
  const next = nodes.response?.data.next_cursor;
  return <div className="node-filter">
    <Select label={label} value={value} onChange={onChange} options={options} disabled={!region || (nodes.loading && !items.length)} onLoadMore={next && !nodes.error ? () => { if (!nodes.loading) setCursor(next); } : undefined} loadingMore={nodes.loading}/>
    {nodes.error && <span className="filter-error" role="status">节点列表加载失败<button type="button" className="text-button" onClick={nodes.reload}>重试</button></span>}
  </div>;
}
