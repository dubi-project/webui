export interface ObservationError { node_id?: string; code: string; message: string }
export interface ManagementMeta { request_id: string; generated_unix: number; complete: boolean; errors?: ObservationError[] | null; errors_truncated?: boolean }
export interface ManagementList<T> { items: T[] | null; next_cursor: string }
export interface Observation { observed_unix: number | null; stale: boolean; complete: boolean }
export interface Health { status: string; reasons: ObservationError[] | null }
export interface Capacity { filesystem_total_bytes: number; filesystem_available_bytes: number; writable_bytes?: number }
export interface Summary extends Observation, Health {
  node_count: number; node_states: Record<string, number>; observed_nodes: number;
  capacity_observed_nodes: number; capacity: Capacity | null; capacity_scope: string;
  maintenance_observed_nodes: number; maintenance_pending: Record<string, number>;
}
export interface Region extends Summary { region_id: string }
export interface Cluster extends Summary { cluster_id: string; regions: Region[] | null }
export interface ManagedNode extends Observation, Health {
  node_id: string; name: string; region_id: string; membership: string;
  capacity: Capacity | null; volume_count: number | null; capacity_observed_volumes: number | null;
  maintenance: NodeMaintenance | null;
}
export interface Activity {
  kind: string; supported: boolean; phase: string; processed: number | null; unit?: string;
  total: number | null; pending: number | null; last_progress_unix: number | null;
  needs_full_scan?: boolean | null; source_volume_id?: string; target_volume_id?: string; errors: string[] | null;
}
export interface NodeMaintenance extends Observation { node_id: string; region_id: string; items: Activity[] | null }
export interface Volume extends Observation {
  volume_id: string; path: string; state: string; health: string; error?: string;
  write_isolated: boolean; write_error?: string; capacity: Capacity | null; migration?: Activity;
}
export interface ClusterVolume extends Volume { node_id: string; node_name: string; region_id: string }
