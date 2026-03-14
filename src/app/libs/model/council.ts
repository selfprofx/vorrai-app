export interface CouncilSession {
  session_id: string;
  user_question: string;
  status: 'routing' | 'processing' | 'qa' | 'completed' | 'failed';
  selected_crews?: string[];
  selected_experts?: string[];
  routing_reasoning?: string | null;
  report_s3_key?: string | null;
  expert_responses?: Record<string, any> | null;
  qa_validation?: Record<string, any> | null;
  legal_disclaimer?: string | null;
  token_usage?: Record<string, any> | null;
  processing_time_ms?: number | null;
  created_at?: string | null;
}

export interface CouncilExpert {
  expert_id: string;
  display_name: string;
  domain_crew: string;
  domain_tags: string[];
  role?: string | null;
  goal?: string | null;
  tool_set?: string | null;
  is_active: boolean;
  checklist_version?: number;
  memory_version?: number;
  source_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CouncilReport {
  session_id: string;
  report: string;
  format: 'markdown';
}

export type CouncilRouteMode = 'auto' | 'domains' | 'experts';

export const DOMAIN_CREWS = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'content_and_creator', label: 'Content & Creator' },
  { value: 'copywriting', label: 'Copywriting' },
  { value: 'legal', label: 'Legal' },
] as const;
