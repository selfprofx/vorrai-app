export interface User {
  // Primary keys
  id: string; // canonical UUID

  // Social IDs
  insta_id?: string | null;
  whats_id?: string | null;
  tiktok_id?: string | null;

  // Personal info
  name?: string | null;
  email?: string | null;
  phone?: string | null;

  // UTM & meta
  utm_persona?: string | null;
  umeta_summary?: string | null;

  // Chat state
  chat_state?: string | null;
  prev_chat_state?: string | null;
  chat_state_history?: string[]; // default: []
  has_meta?: boolean | null;
}
