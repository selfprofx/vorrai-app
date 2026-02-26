export interface ContentJob {
  job_id: string;
  content_type?: string | null;
  article_title?: string | null;
  status?: string | null;
  created_at?: string | null;
  image_urls?: Record<string, string | Record<string, string>> | null;
  video_url?: string | null;
}
