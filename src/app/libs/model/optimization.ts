export interface OptimizationRecord {
  tenant_id: string;
  crew_name: string;
  status: string;              // active | paused
  run_frequency: string;       // daily | weekly | monthly
  last_run_at: string | null;
  next_run_at: string | null;
  version_count: number;
  size_bytes: number;
  summary: string | null;
  updated_at: string | null;
  report_content?: string;     // populated by GET /optimization/{crew_name}
}

export interface OptimizationListResponse {
  items: OptimizationRecord[];
}

export interface OptimizationTriggerResponse {
  status: string;
  tenant_id: string;
  period_days: number;
}
