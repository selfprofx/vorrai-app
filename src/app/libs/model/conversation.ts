export interface ConversationPreview {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  chat_state?: string | null;
  character?: string | null;
  last_message?: string | null;
  last_timestamp?: string | null;
}
