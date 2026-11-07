import { useState } from 'react';
import type { ReactNode } from 'react';
import { NotificationContext } from './Notifications';
import type { Notice } from './Notifications';
export { default, NotificationBell } from './Notifications';
const noop = () => {};
function seed(now: number): Notice[] {
  const items: Omit<Notice, 'id' | 'at'>[] = [
    { title: 'sg03 存储空间不足', summary: 'Volume 使用率达到 86%，请关注剩余容量。', detail: '新加坡区域 sg03 的数据卷已使用 51.6 GiB，总容量 60 GiB。节点目前仍可写入，建议尽快检查容量增长情况。', advice: '检查磁盘占用，按需要增加 Volume 或释放不再需要的数据。', source: 'sg03 · 数据卷', region: '新加坡', level: 'warning', read: false, target: 'volume', action: '查看存储与容量' },
    { title: 'ff02 暂时不可达', summary: '连续未取得节点响应，法兰克福区域处于降级状态。', detail: '集群暂时无法取得 ff02 的最新状态。节点成员身份保留，其他节点仍在提供服务。', advice: '检查节点进程与网络。节点恢复后会沿原身份追赶数据，无需重新加入。', source: 'ff02 · 节点', region: '法兰克福', level: 'error', read: false, target: 'globe', action: '查看区域与节点' },
    { title: '业务凭证将在 7 天后到期', summary: '「生产应用」凭证即将到期，请及时更新使用方。', detail: '租户 acme 使用的「生产应用」访问凭证即将到期。到期后，使用该凭证的业务请求将被拒绝。', advice: '创建新凭证并更新应用配置，确认切换完成后撤销旧凭证。', source: 'acme · 访问凭证', region: '集群', level: 'warning', read: false, target: 'key', action: '查看访问与凭证' },
    { title: '集群备份已完成', summary: 'primary 仓库新增恢复点，9 个节点全部完成。', detail: '本次增量备份已完成，所有参与节点均确认成功。恢复点已保存到 primary 仓库。', advice: '可在备份记录中查看恢复点及各节点执行结果。', source: 'primary · 备份仓库', region: '集群', level: 'success', read: false, target: 'archive', action: '查看仓库与备份' },
    { title: '租户 acme 用量接近配额', summary: '已使用 8.4 GiB，占 10 GiB 存储配额的 84%。', detail: '租户 acme 的逻辑数据用量接近配额上限。达到限额后，新增数据写入可能被拒绝。', advice: '检查租户数据用量，按需要调整配额或清理不再使用的数据。', source: 'acme · 租户', region: '集群', level: 'warning', read: false, target: 'tenant', action: '查看租户与配额' },
    { title: 'tt02 已恢复正常', summary: '节点恢复连接，落后数据已追赶完成。', detail: '多伦多区域 tt02 已重新取得联系，当前运行状态正常。此消息记录本次恢复事件。', advice: '可查看监控趋势，确认后续运行情况。', source: 'tt02 · 节点', region: '多伦多', level: 'success', read: true, target: 'tool', action: '查看监控与诊断' },
    { title: '新节点 sg04 已加入集群', summary: '节点已加入新加坡区域，数据平衡正在后台进行。', detail: 'sg04 使用新身份加入集群。Runtime 正在逐步补齐数据并调整分布。', advice: '在区域与节点页面查看节点状态及数据平衡进展。', source: 'sg04 · 节点', region: '新加坡', level: 'info', read: true, target: 'globe', action: '查看区域与节点' },
    { title: '数据再平衡已完成', summary: '多伦多区域数据分布恢复平衡。', detail: '本次后台数据再平衡已完成，相关节点的存储分布已调整到目标状态。', advice: '可在监控与诊断页面查看当前后台维护状态。', source: '多伦多 · 后台维护', region: '多伦多', level: 'success', read: true, target: 'tool', action: '查看监控与诊断' },
    { title: '管理员凭证已创建', summary: '新管理凭证「运维控制台」已生效。', detail: '集群创建了一条管理员访问凭证。本消息不包含 Token 或任何密钥信息。', advice: '如非预期操作，请检查凭证并及时撤销。', source: '集群 · 访问凭证', region: '集群', level: 'info', read: true, target: 'key', action: '查看访问与凭证' },
  ];
  return items.map((item, index) => ({ ...item, id: `notice_${index + 1}`, at: now - [2, 8, 21, 36, 70, 112, 180, 290, 1500][index] * 60000 }));
}
export function NotificationPreviewProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState(() => seed(Date.now()));
  const [selected, setSelected] = useState<string | null>(null);
  function mark(id: string, read: boolean) { setItems(items => items.map(item => item.id === id ? { ...item, read } : item)); }
  return <NotificationContext.Provider value={{ items, unread: items.filter(n => !n.read).length, total: items.length, ready: true, summaryReady: true, error: "", busy: false, retry: noop, refresh: noop, setActive: noop, mark, markAll: () => setItems(items => items.map(item => ({ ...item, read: true }))), selected, open: id => { mark(id, true); setSelected(id); }, close: () => setSelected(null) }}>{children}</NotificationContext.Provider>;
}
