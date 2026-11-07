export default function ResourceUsage({ label, percent, detail, title }: { label: string; percent: number | null; detail?: string; title?: string }) {
  const known = percent != null && Number.isFinite(percent) && percent >= 0;
  const value = known ? `${Number(percent.toFixed(1))}%` : '—';
  const width = known ? Math.min(100, percent) : 0;
  return <div className={`monitor-resource-usage${known && percent >= 75 ? ' is-high' : ''}`} title={title}>
    <div className="monitor-resource-value"><strong>{value}</strong>{detail && <span>{detail}</span>}</div>
    {known && <div className="monitor-resource-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(width.toFixed(1))} aria-valuetext={value}><i style={{ width: `${width}%` }}/></div>}
  </div>;
}
