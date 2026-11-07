import { useState } from 'react';
import Icon from '../Icon';

// Display only: API parameters, keys and clipboard always use the full identity.
export function shortResourceID(value: string) {
  const match = /^(cluster_|node_|store_|volume_)([a-f0-9]{32})$/.exec(value);
  return match ? `${match[1]}${match[2].slice(0, 12)}…` : value;
}
export default function ResourceID({ value, copy = false }: { value: string; copy?: boolean }) {
  const [message, setMessage] = useState('');
  async function copyID() {
    try { await navigator.clipboard.writeText(value); setMessage('已复制'); }
    catch { setMessage('复制失败，请展开完整 ID'); }
  }
  return <span className="resource-identity" title={value} data-resource-id={value}><span>{shortResourceID(value)}</span>{copy && <><button type="button" className="icon-button resource-identity-copy" aria-label={`复制完整 ID ${value}`} onClick={() => void copyID()}><Icon name="copy" size={13}/></button>{message && <small role="status">{message}</small>}{message.startsWith('复制失败') && <details><summary>完整 ID</summary><code>{value}</code></details>}</>}</span>;
}
