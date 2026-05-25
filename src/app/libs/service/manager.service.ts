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

// ── Regulations (clinical content engine, manager-only) ────────────────────

export interface RegulationMarket {
  market_key: string;
  country_code: string;
  vertical: string;
  display_name: string;
  active_version: string | null;
  active_since: string | null;
}

export interface RegulationVersionSummary {
  market_key: string;
  version: string;
  country_code: string;
  vertical: string;
  display_name: string;
  is_active: boolean;
  changelog: string;
  created_at: string;
  updated_at: string | null;
  activated_at: string | null;
  deactivated_at: string | null;
  created_by_hash: string;
  last_modified_by_hash: string;
  activated_by_hash: string | null;
}

export interface RegulationDetail extends RegulationVersionSummary {
  rules: Record<string, unknown>;
  sources: Array<{ citation?: string; url?: string; retrieved_at?: string }>;
}

export interface CreateRegulationPayload {
  country_code: string;
  vertical?: string;
  version: string;
  display_name?: string;
  rules: Record<string, unknown>;
  sources?: unknown[];
  changelog: string;
}

export interface UpdateRegulationPayload {
  rules?: Record<string, unknown>;
  sources?: unknown[];
  changelog?: string;
}

export interface ActivateRegulationResult {
  activated: RegulationVersionSummary;
  deactivated: RegulationVersionSummary | null;
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

  // ── Regulations CRUD (manager-only routes) ────────────────────────────────
  // The blueprint encodes immutability + monotonic-semver invariants; the UI
  // surfaces them via specific toasts on 409 with `code` keys
  // (`version_immutable`, `historical_version`, `major_bump_requires_confirm`).

  listRegulations(): Promise<{ items: RegulationMarket[] }> {
    return firstValueFrom(
      this.http.get<{ items: RegulationMarket[] }>(
        `${this.base}/manager/regulations`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  getRegulationVersions(marketKey: string): Promise<{
    market_key: string;
    versions: RegulationVersionSummary[];
  }> {
    return firstValueFrom(
      this.http.get<{ market_key: string; versions: RegulationVersionSummary[] }>(
        `${this.base}/manager/regulations/${encodeURIComponent(marketKey)}`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  getRegulationVersion(marketKey: string, version: string): Promise<RegulationDetail> {
    return firstValueFrom(
      this.http.get<RegulationDetail>(
        `${this.base}/manager/regulations/${encodeURIComponent(marketKey)}/${encodeURIComponent(version)}`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  createRegulationVersion(marketKey: string, payload: CreateRegulationPayload): Promise<RegulationDetail> {
    return firstValueFrom(
      this.http.post<RegulationDetail>(
        `${this.base}/manager/regulations/${encodeURIComponent(marketKey)}`, payload,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  updateRegulationVersion(
    marketKey: string, version: string, payload: UpdateRegulationPayload,
  ): Promise<RegulationDetail> {
    return firstValueFrom(
      this.http.put<RegulationDetail>(
        `${this.base}/manager/regulations/${encodeURIComponent(marketKey)}/${encodeURIComponent(version)}`,
        payload,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  activateRegulationVersion(
    marketKey: string, version: string, confirmMajorBump = false,
  ): Promise<ActivateRegulationResult> {
    return firstValueFrom(
      this.http.put<ActivateRegulationResult>(
        `${this.base}/manager/regulations/${encodeURIComponent(marketKey)}/${encodeURIComponent(version)}/activate`,
        { confirm_major_bump: confirmMajorBump },
      ).pipe(timeout(this.TIMEOUT)),
    );
  }

  deleteRegulationVersion(marketKey: string, version: string): Promise<{ deleted_at: string }> {
    return firstValueFrom(
      this.http.delete<{ deleted_at: string }>(
        `${this.base}/manager/regulations/${encodeURIComponent(marketKey)}/${encodeURIComponent(version)}`,
      ).pipe(timeout(this.TIMEOUT)),
    );
  }
}
