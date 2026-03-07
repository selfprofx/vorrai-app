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

export interface EpisodeDetail {
  episode_number: string;
  subject_line?: string | null;
  status: string;
  scheduled_for?: string | null;
  sent_at?: string | null;
  open_count: number;
  click_count: number;
}

export interface UserExpandDetail {
  user_id: string;
  social?: UserSocial;
  followups?: UserFollowup[];
  sequence?: {
    status: string;
    approval_status: string;
    day0_status?: string | null;
    protagonist_name?: string | null;
    article_title?: string | null;
    created_at?: string | null;
    episodes: EpisodeDetail[];
  } | null;
  form_fields?: Record<string, any>;
  umeta?: {
    summary?: string | null;
    top_goals?: string[] | null;
    top_pain_points?: string[] | null;
    top_desires?: string[] | null;
    followup_priority?: string | null;
    audience_state?: string | null;
    archetype?: string | null;
  } | null;
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

  // Social media (kept for backward compat, expand detail uses full data)
  social?: UserSocial;

  // Followup emails (kept for backward compat)
  followups?: UserFollowup[];

  // Landing form extra fields
  form_fields?: Record<string, any>;

  is_active?: boolean | null;

  // Lead management (denormalized summary fields)
  followup_priority?: 'low' | 'medium' | 'high' | null;
  audience_state?: 'Urgency' | 'Awareness' | 'Opportunity' | null;
  sequence_status?: string | null;
  sequence_approval?: string | null;
  email_sent_count?: number;
  email_total_count?: number;
  email_open_count?: number;
  offer_purchased?: boolean;
  email_lifecycle?: string | null;
  has_social?: boolean;
  has_form?: boolean;
  has_appointment?: boolean;

  // Appointment
  appointment_at?: string | null;
  appointment_display?: string | null;
  appointment_video_link?: string | null;
}
