import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface TenantOnboarding {
  is_complete: boolean;
  current_stage: number;
  ses_verified: boolean;
  domain_verified: boolean;
  workspace_provider: string;
  completion_pct: number;
  completed_stages: number[];
}

export interface TenantSummary {
  tenant_id: string;
  name: string;
  contact_email: string;
  source_email: string | null;
  is_active: boolean;
  plan_slug: string | null;
  onboarding_complete: boolean;
  workspace_provider: string | null;
  user_count: number;
  active_user_count: number;
  followup_count: number;
  content_count: number;
  message_count: number;
  deals_closed: number;
  last_user_at: string | null;
  onboarding: Partial<TenantOnboarding>;
  active_plans: { plan_slug: string; plan_name: string; module_num: string; activated_at: string }[];
}

export interface TenantDetail extends TenantSummary {
  social_counts: { instagram: number; whatsapp: number; tiktok: number };
}

export interface ManagerMetrics {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_followups_sent: number;
  total_content_jobs: number;
  total_messages: number;
  total_deals_closed: number;
  tenants_onboarded: number;
  tenants_with_active_plan: number;
}

export interface TenantUser {
  id: string;
  name: string;
  full_name: string;
  email: string;
  phone: string | null;
  chat_state: string | null;
  utm_persona: string | null;
  umeta_summary: string | null;
  has_meta: boolean;
  is_active: boolean;
}

export interface TenantFollowup {
  user_id: string;
  email: string;
  article_title: string | null;
  email_subject: string | null;
  status: string;
  sent_at: string | null;
  created_at: string | null;
}

export interface TenantContentJob {
  job_id: string;
  content_type: string | null;
  article_title: string | null;
  status: string;
  created_at: string | null;
  video_url: string | null;
}

export interface HealthCheck {
  status: string;
  checks: Record<string, { status: string; latency_ms?: number; connections?: number; error?: string }>;
  versions: Record<string, string>;
  checked_at: string;
}

export interface PingResult {
  ping_id: string;
  sent_via: string;
  sent_at: string;
}

@Injectable({ providedIn: 'root' })
export class ManagerService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  private readonly TIMEOUT = 25_000;

  getOverview(): Promise<{ metrics: ManagerMetrics; tenants: TenantSummary[] }> {
    return firstValueFrom(
      this.http.get<{ metrics: ManagerMetrics; tenants: TenantSummary[] }>(
        `${this.base}/manager/overview`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  getTenants(): Promise<{ items: TenantSummary[]; count: number }> {
    return firstValueFrom(
      this.http.get<{ items: TenantSummary[]; count: number }>(
        `${this.base}/manager/tenants`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  getTenant(tenantId: string): Promise<TenantDetail> {
    return firstValueFrom(
      this.http.get<TenantDetail>(
        `${this.base}/manager/tenants/${tenantId}`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  getTenantUsers(tenantId: string): Promise<{ items: TenantUser[]; count: number }> {
    return firstValueFrom(
      this.http.get<{ items: TenantUser[]; count: number }>(
        `${this.base}/manager/tenants/${tenantId}/users`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  getTenantFollowups(tenantId: string): Promise<{ items: TenantFollowup[]; count: number }> {
    return firstValueFrom(
      this.http.get<{ items: TenantFollowup[]; count: number }>(
        `${this.base}/manager/tenants/${tenantId}/followups`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  getTenantContent(tenantId: string): Promise<{ items: TenantContentJob[]; count: number }> {
    return firstValueFrom(
      this.http.get<{ items: TenantContentJob[]; count: number }>(
        `${this.base}/manager/tenants/${tenantId}/content`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  getHealth(): Promise<HealthCheck> {
    return firstValueFrom(
      this.http.get<HealthCheck>(
        `${this.base}/manager/health`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  pingAgent(): Promise<PingResult> {
    return firstValueFrom(
      this.http.post<PingResult>(
        `${this.base}/manager/health/ping-agent`, {},
      ).pipe(timeout(this.TIMEOUT)),
    );
  }
}
