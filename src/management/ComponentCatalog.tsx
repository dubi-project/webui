import EnginesModules from '../EnginesModules';
import type { ComponentEntry } from '../EnginesModules';
import type { IconName } from '../Icon';
import ResourceID from '../components/ResourceID';
import { ResourceView } from './components';
import { useResource } from './resource';

type RegisteredComponent = Omit<ComponentEntry, 'state' | 'icon' | 'metrics'> & { status: 'registered' };
type Catalog = { node_id: string; scope: 'entry_node'; items: RegisteredComponent[] };
const icons: Record<string, IconName> = { state: 'cache', config: 'config', record: 'archive', blob: 'volume', index: 'search' };
export default function ComponentsManagement({ revision }: { revision: number }) {
  const resource = useResource<Catalog>('/api/v1/admin/components', revision);
  return <ResourceView resource={resource}>{data => <>
    <p className="component-source">信息来源：<ResourceID value={data.node_id} copy/> · 当前入口已注册的组件；跨节点运行指标暂未采集。</p>
    <EnginesModules entries={data.items.map(item => ({ ...item, state: item.status, icon: icons[item.id] ?? (item.kind === 'engine' ? 'engines' : 'grid') }))}/>
  </>}</ResourceView>;
}
