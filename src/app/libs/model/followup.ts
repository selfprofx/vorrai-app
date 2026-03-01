export interface FollowupEmail {
  user_id: string;
  email?: string | null;
  article_title?: string | null;
  email_subject?: string | null;
  status?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
  image_urls?: Record<string, string | Record<string, string>> | null;
}

export interface ScheduledEpisode {
  episode_number: string;             // "01"–"07"
  subject_line?: string | null;
  scheduled_for: string;              // ISO datetime — delivery target
  status: string;                     // pending | sent | failed
  sent_at?: string | null;
  error?: string | null;
  cta_type?: string | null;           // reply_hook | soft_open_door | consultative | …
  copywriter_style?: string | null;   // brunson_epiphany_bridge | kern_casual_callback | …
  article_title?: string | null;
  open_count?: number | null;         // future: SES open tracking
  click_count?: number | null;        // future: SES click tracking
}

export interface NovelSequence {
  user_id: string;
  email?: string | null;
  protagonist_name?: string | null;
  article_title?: string | null;
  spin_completed_at?: string | null;
  status: string;                     // generated | scheduling | active | complete
  approval_status: string;            // pending_approval | approved | rejected | auto_approved
  approved_at?: string | null;
  day0_status?: string | null;        // pending | sent | failed
  day0_type?: string | null;          // prep | booking_reminder | booking_invite
  created_at: string;
  episodes: ScheduledEpisode[];
  episodes_sent: number;
  episodes_pending: number;
  episodes_failed: number;
}
