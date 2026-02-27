export interface UserSocial {
  insta_id?: string | null;
  insta_handle?: string | null;
  whats_id?: string | null;
  whats_handle?: string | null;
  tiktok_id?: string | null;
  tiktok_handle?: string | null;
}

export interface UserFollowup {
  article_title?: string | null;
  email_subject?: string | null;
  status?: string | null;
  sent_at?: string | null;
}

export interface User {
  // Primary key
  id: string;

  // Personal info
  name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;

  // Chat / SPIN state
  chat_state?: string | null;
  prev_chat_state?: string | null;
  chat_state_history?: string[];
  character?: string | null;

  // UTM & AI-generated meta
  utm_persona?: string | null;
  umeta_summary?: string | null;
  has_meta?: boolean | null;

  // Social media
  social?: UserSocial;

  // Followup emails sent to this user
  followups?: UserFollowup[];

  // Offer purchase
  offer_purchased?: boolean;
  offer_token?: string | null;

  // Landing form extra fields (UTM params, custom fields, etc.)
  form_fields?: Record<string, any>;

  is_active?: boolean | null;
}
