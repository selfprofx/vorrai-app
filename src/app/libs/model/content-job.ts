export interface ContentJob {
  job_id: string;
  content_type?: string | null;
  article_title?: string | null;
  status?: string | null;
  created_at?: string | null;
  image_urls?: Record<string, string | Record<string, string>> | null;
  video_url?: string | null;
  job_type?: string | null;
  delivery_mode?: string | null;
  editorial_type?: string | null;
  audience_state?: string | null;
  output_formats?: string[] | null;
  briefing?: string | null;
  article_body?: string | null;
  carousel_data?: any | null;
  video_script?: any | null;
  triggered_by?: string | null;
}

export interface ContentCreateRequest {
  job_type: 'default_hero' | 'premium_hero';
  delivery_mode: 'novel_sequence' | 'full';
  briefing?: string;
  editorial_type?: string;
  audience_state?: string;
  output_formats?: string[];
}
