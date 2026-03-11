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
  custom_video_link?: string | null;
  booking_enabled?: boolean | null;
  meeting_type?: string | null;
  meeting_tool?: string | null;
  meeting_url?: string | null;
  meeting_address?: string | null;
  meeting_duration_minutes?: number | null;
  max_slots_to_show?: number | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  updated_at?: string | null;
}
