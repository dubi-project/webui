// Design fixtures only. No connection to the live acceptance cluster.
export const regions = [
  { name: 'Singapore', code: 'SG', label: '新加坡', id: 'singapore' },
  { name: 'Frankfurt', code: 'FF', label: '法兰克福', id: 'frankfurt' },
  { name: 'Toronto', code: 'TT', label: '多伦多', id: 'toronto' },
];
export type NodeState = 'healthy' | 'warning' | 'unavailable';
export interface PreviewNode {
  id: string;
  region: typeof regions[number];
  address: string;
  state: NodeState;
  used: number | null;
  capacity: number | null;
  volumeId: string;
}
export function previewNodes(incident: boolean): PreviewNode[] {
  return regions.flatMap((region, regionIndex) => [1, 2, 3].map(index => {
    const id = `${region.code.toLowerCase()}0${index}`;
    const offline = incident && id === 'ff02';
    const warning = incident && id === 'sg03';
    return {
      id, region, address: `10.0.${regionIndex + 1}.${10 + index}:17443`,
      state: offline ? 'unavailable' : warning ? 'warning' : 'healthy',
      used: offline ? null : warning ? 52.8 : [28.2, 26.4, 27][regionIndex] + (index - 2) * 0.3,
      capacity: offline ? null : 60,
      volumeId: `vol-${id}-01`,
    };
  }));
}
export const stateLabels = { healthy: '在线', warning: '容量预警', unavailable: '不可达' };
