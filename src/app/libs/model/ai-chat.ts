export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  jobId?: string;
  /** App-relative navigation URL emitted by the AI crew, e.g. "/users". */
  navUrl?: string;
}

export type AiChatMode = 'onboarding' | 'ai_employee' | 'upgrade';

export interface AiChatRequest {
  message: string;
  mode: AiChatMode;
  chat_history?: string;
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
  upgrade_required?: boolean;
  message?: string;
  error?: string;
  strikes?: number;
}
