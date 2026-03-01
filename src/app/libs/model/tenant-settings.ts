export interface TenantSettings {
  tenant_id?: string;
  max_chat_input_chars: number;
  max_agent_input_chars: number;
  auto_approve_sequences?: boolean | null;
  updated_at?: string | null;
}
