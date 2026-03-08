export interface AvailableHour {
  day_of_week: string;
  start_time: string;
  end_time: string;
}

export interface TenantDetail {
  tenant_id?: string;
  brand_communication_style?: string | null;
  timezone?: string | null;
  langs?: string | null;
  available_hours?: AvailableHour[];
  instagram_handle?: string | null;
  facebook_page?: string | null;
  linkedin_url?: string | null;
  tiktok_handle?: string | null;
  youtube_channel?: string | null;
  updated_at?: string | null;
}
