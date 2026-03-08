export interface GlobalConfig {
  config_key: string;
  max_content_jobs_per_month: number;
  max_chat_input_chars: number;
  max_agent_input_chars: number;
  updated_at?: string | null;
  has_override?: boolean;
}
