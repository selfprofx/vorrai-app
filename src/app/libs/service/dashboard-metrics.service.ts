import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardMetrics {
  funnel: {
    forms_count: number;
    followup_count: number;
    deals_closed: number;
  };
  onboarding: {
    is_complete: boolean;
    current_stage: number;
    ses_verified: boolean;
    domain_verified: boolean;
    workspace_provider: string;
    completion_pct: number;
    completed_stages: string[];
    token?: string;
  };
  active_plans: Array<{
    plan_slug: string;
    plan_name: string;
    module_num: string;
    activated_at: string;
  }>;
  ses_verified: boolean;
  today?: {
    new_leads: number;
    active_conversations: number;
    followups_sent: number;
    bookings_today: number;
    content_completed: number;
  };
  pending?: {
    sequences_awaiting_approval: number;
    unread_chats: number;
  };
  recent_activity?: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    created_at: string;
    read: boolean;
    link?: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class DashboardMetricsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getMetrics(): Promise<DashboardMetrics> {
    return firstValueFrom(
      this.http.get<DashboardMetrics>(`${this.base}/dashboard/metrics`)
    );
  }
}
