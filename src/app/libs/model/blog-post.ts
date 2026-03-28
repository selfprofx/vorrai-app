export interface BlogPost {
  post_id: string;
  title?: string | null;
  slug?: string | null;
  content?: string | null;
  description?: string | null;
  author?: string | null;
  tags?: string[] | null;
  status?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  date_display_mode?: string | null;
  email_status?: string | null;
  email_sent_count?: number | null;
  email_open_count?: number | null;
  briefing?: string | null;
}

export interface BlogPostCreateRequest {
  briefing?: string;
  title?: string;
  content?: string;
  description?: string;
  author?: string;
  tags?: string[];
  date_display_mode?: string;
  source_pdf_url?: string;
}

export interface BlogStats {
  subscriber_count: number;
  post_count: number;
  published_count: number;
  total_sent: number;
  total_opens: number;
}

export interface NewsletterSubscriber {
  email: string;
  full_name?: string | null;
  subscribed_at?: string | null;
  status?: string | null;
  source?: string | null;
}
