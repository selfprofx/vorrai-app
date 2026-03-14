import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OnboardingProgress {
  onboarding_id: string;
  tenant_id: string;
  email: string;
  plan_slug: string;
  current_stage: number;
  completed_stages: string[];
  stage_data: Record<string, Record<string, any>>;
  ses_verified: boolean;
  domain_verified: boolean;
  workspace_provider: string;
  is_complete: boolean;
}

export interface SesStatusResponse {
  verified: boolean;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getProgress(token: string): Promise<OnboardingProgress> {
    return firstValueFrom(
      this.http.get<OnboardingProgress>(`${this.base}/onboarding/progress`, {
        params: { token },
      })
    );
  }

  saveProgress(token: string, stage: number, data: Record<string, any>): Promise<any> {
    return firstValueFrom(
      this.http.put(`${this.base}/onboarding/progress`, { token, stage, data })
    );
  }

  complete(token: string): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.base}/onboarding/complete`, { token })
    );
  }

  sesStatus(token: string): Promise<SesStatusResponse> {
    return firstValueFrom(
      this.http.get<SesStatusResponse>(`${this.base}/onboarding/ses-status`, {
        params: { token },
      })
    );
  }

  activateAccount(token: string, password: string): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.base}/onboarding/activate-account`, { token, password })
    );
  }

  registerInterest(token: string, featureSlug: string, featureName: string, message: string): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.base}/onboarding/feature-interest`, {
        token,
        feature_slug: featureSlug,
        feature_name: featureName,
        message,
      })
    );
  }

  // ── Knowledge Ingestion (Stage 5) ─────────────────────────────────────────

  uploadKnowledge(token: string, filename: string, sourceType: string, title: string): Promise<{ source_id: string; upload_url: string; s3_key: string }> {
    return firstValueFrom(
      this.http.post<{ source_id: string; upload_url: string; s3_key: string }>(
        `${this.base}/onboarding/upload-knowledge`,
        { token, filename, source_type: sourceType, title }
      )
    );
  }

  startIngestion(token: string, youtubeUrls: Array<{ url: string; title: string }>, textSources: Array<{ title: string; content: string }>): Promise<{ status: string; job_id: string }> {
    return firstValueFrom(
      this.http.post<{ status: string; job_id: string }>(
        `${this.base}/onboarding/start-ingestion`,
        { token, youtube_urls: youtubeUrls, text_sources: textSources }
      )
    );
  }

  ingestionStatus(token: string): Promise<{ sources: Array<{ source_id: string; title: string; status: string; source_type: string; chunk_count: number }>; overall_status: string }> {
    return firstValueFrom(
      this.http.get<any>(`${this.base}/onboarding/ingestion-status`, { params: { token } })
    );
  }
}
