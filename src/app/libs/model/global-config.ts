export interface GlobalConfig {
  config_key: string;
  max_content_jobs_per_month: number;
  max_chat_input_chars: number;
  max_agent_input_chars: number;
  updated_at?: string | null;
  has_override?: boolean;
}

export interface GlobalNotificationConfig {
  global_notif_leads: boolean;
  global_notif_chats: boolean;
  global_notif_content: boolean;
  global_notif_followups: boolean;
  global_notif_bookings: boolean;
}

export const DEFAULT_GLOBAL_NOTIF: GlobalNotificationConfig = {
  global_notif_leads: true,
  global_notif_chats: true,
  global_notif_content: true,
  global_notif_followups: true,
  global_notif_bookings: true,
};
