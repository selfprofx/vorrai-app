export interface AiActionButton {
  label: string;
  navUrl: string;
  icon?: string;
  actionType?: 'navigate' | 'confirm_mutation' | 'execute';
  actionPayload?: Record<string, unknown>;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  jobId?: string;
  navUrl?: string;
  actions?: AiActionButton[];
}

export interface AiChatSession {
  session_id: string;
  title: string | null;
  mode: AiChatMode;
  created_at: string;
  updated_at: string;
  message_count: number;
  is_archived: boolean;
}

export type AiChatMode = 'onboarding' | 'ai_employee' | 'upgrade';

export interface AiChatRequest {
  message: string;
  mode: AiChatMode;
  session_id?: string;
  source?: 'web' | 'whatsapp';
  // onboarding extras
  stage?: number;
  stage_data?: string;
  ses_verified?: boolean;
  domain_verified?: boolean;
  workspace_provider?: string;
}

export interface AiChatResponse {
  queued?: boolean;
  job_id?: string;
  session_id?: string;
  session_title?: string;
  upgrade_required?: boolean;
  message?: string;
  error?: string;
  strikes?: number;
}
