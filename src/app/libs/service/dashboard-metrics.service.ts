import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

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
  };
  active_plans: Array<{
    plan_slug: string;
    plan_name: string;
    module_num: string;
    activated_at: string;
  }>;
  ses_verified: boolean;
}

@Injectable({ providedIn: 'root' })
export class DashboardMetricsService {
  private http   = inject(HttpClient);
  private auth   = inject(AuthService);
  private base   = environment.apiUrl;

  getMetrics(): Promise<DashboardMetrics> {
    const headers = new HttpHeaders(this.auth.authHeader());
    return firstValueFrom(
      this.http.get<DashboardMetrics>(`${this.base}/dashboard/metrics`, { headers })
    );
  }
}
