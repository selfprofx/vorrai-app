import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import type { TokenUsageResponse } from '../model/token-usage';

@Injectable({ providedIn: 'root' })
export class TokenUsageService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = '/api';

  data    = signal<TokenUsageResponse | null>(null);
  loading = signal(false);
  error   = signal<string | null>(null);

  async load(days?: number, source?: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const headers = new HttpHeaders(this.auth.authHeader());
      const params: Record<string, string> = {};
      if (days)   params['days']   = String(days);
      if (source) params['source'] = source;

      const res = await this.http
        .get<TokenUsageResponse>(`${this.base}/dashboard/usage`, { headers, params })
        .toPromise();
      this.data.set(res ?? null);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load usage data');
    } finally {
      this.loading.set(false);
    }
  }
}
