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
