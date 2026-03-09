export interface TenantSettings {
  tenant_id?: string;
  max_chat_input_chars: number;
  max_agent_input_chars: number;
  max_content_jobs_per_month?: number | null;
  auto_approve_sequences?: boolean | null;
  theme?: 'dark' | 'light' | null;
  content_jobs_limit_monthly?: number | null;
  content_jobs_used_month?: number | null;
  updated_at?: string | null;
}
