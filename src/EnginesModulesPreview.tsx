import { useState } from 'react';
import EnginesModules from './EnginesModules';
import type { ComponentEntry } from './EnginesModules';

// Design fixtures stay in the explicitly enabled preview chunk. These observations
// and editable display labels are not claims about live management API support.
const initial: ComponentEntry[] = [
  { id: 'state', kind: 'engine', name: 'State', subtitle: '状态引擎', description: '保存键值状态与版本，为配置、缓存等模块提供共享的状态读写能力。', icon: 'cache', state: 'healthy', capabilities: ['键值读写', '版本控制', '条件更新'], engines: [], metrics: { requests: '128', latency: '12', errors: '0.00' }, settings: [{ label: '单值上限', value: '64 KiB' }, { label: 'Key 上限', value: '2 KiB' }, { label: '设置方式', value: '当前为内置限制' }] },
  { id: 'record', kind: 'engine', name: 'Record', subtitle: '记录引擎', description: '按序追加与读取记录，为消息、日志和时序数据提供基础能力。', icon: 'archive', state: 'development', capabilities: ['顺序追加', 'Offset', '记录重放'], engines: [], settings: [] },
  { id: 'blob', kind: 'engine', name: 'Blob', subtitle: '大内容引擎', description: '保存文件与大字节内容，提供分块写入和按范围读取能力。', icon: 'volume', state: 'planned', capabilities: ['大内容存储', '分块写入', '范围读取'], engines: [], settings: [] },
  { id: 'index', kind: 'engine', name: 'Index', subtitle: '索引引擎', description: '提供通用的文本分析、索引构建与查询能力，支撑搜索类业务。', icon: 'search', state: 'planned', capabilities: ['文本分析', '倒排索引', '索引查询'], engines: [], settings: [] },
  { id: 'config', kind: 'module', name: '配置中心', subtitle: 'Config', description: '集中管理应用配置，支持版本读取与条件更新，按租户独立隔离。', icon: 'config', state: 'healthy', capabilities: ['配置读写', '版本控制', '租户隔离'], engines: ['state'], metrics: { requests: '128', latency: '14', errors: '0.00', tenants: 6 }, settings: [{ label: '单项大小上限', value: '64 KiB（由 State 限制）' }, { label: '访问方式', value: 'HTTP 业务 API' }] },
  { id: 'cache', kind: 'module', name: '分布式缓存', subtitle: 'Cache', description: '提供共享缓存与过期管理，为应用减少重复计算与数据访问。', icon: 'cache', state: 'planned', capabilities: ['键值缓存', '过期管理', '租户隔离'], engines: ['state'], settings: [] },
  { id: 'bus', kind: 'module', name: '消息总线', subtitle: 'Bus', description: '统一请求应答、发布订阅与队列，支持服务之间的消息协作。', icon: 'gateway', state: 'planned', capabilities: ['请求应答', '发布订阅', '消息队列'], engines: ['record', 'state'], settings: [] },
  { id: 'file', kind: 'module', name: '文件存储', subtitle: 'File', description: '管理文件内容与元数据，提供文件上传、读取和访问控制。', icon: 'volume', state: 'planned', capabilities: ['文件上传', '文件读取', '元数据'], engines: ['blob', 'state'], settings: [] },
  { id: 'search', kind: 'module', name: '全文搜索', subtitle: 'Search', description: '管理原始文档及其索引，提供全文检索与结果查询。', icon: 'search', state: 'planned', capabilities: ['文档管理', '全文检索', '索引更新'], engines: ['index', 'state', 'blob'], settings: [] },
  { id: 'log', kind: 'module', name: '日志服务', subtitle: 'Log', description: '汇集日志记录，支持按时间读取与日志内容搜索。', icon: 'archive', state: 'planned', capabilities: ['日志采集', '时间查询', '内容搜索'], engines: ['record', 'index', 'state'], settings: [] },
  { id: 'trace', kind: 'module', name: '链路追踪', subtitle: 'Trace', description: '关联服务调用中的追踪记录，帮助分析请求路径与耗时。', icon: 'activity', state: 'planned', capabilities: ['追踪记录', '链路查询', '耗时分析'], engines: ['record', 'state', 'index'], settings: [] },
  { id: 'timeseries', kind: 'module', name: '时序数据', subtitle: 'TimeSeries', description: '管理带时间戳的数据，提供时间窗口查询与聚合。', icon: 'clock', state: 'planned', capabilities: ['时间点写入', '窗口查询', '数据聚合'], engines: ['record', 'state', 'index'], settings: [] },
];
export default function EnginesModulesPreview() {
  const [entries, setEntries] = useState(initial);
  return <EnginesModules preview entries={entries} onUpdate={entry => setEntries(items => items.map(item => item.id === entry.id ? entry : item))}/>;
}
