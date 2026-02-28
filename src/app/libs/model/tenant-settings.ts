export interface TenantSettings {
  tenant_id?: string;
  max_chat_input_chars: number;
  max_agent_input_chars: number;
  updated_at?: string | null;
}
