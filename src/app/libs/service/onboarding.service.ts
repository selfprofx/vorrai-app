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
}
