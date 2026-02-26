import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import type { FollowupEmail } from '../model/followup';

@Injectable({ providedIn: 'root' })
export class FollowupService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = '/api';

  followups: WritableSignal<FollowupEmail[]> = signal<FollowupEmail[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const headers = new HttpHeaders(this.auth.authHeader());
      const res = await this.http
        .get<{ items: FollowupEmail[] }>(`${this.base}/dashboard/followups`, { headers })
        .toPromise();
      this.followups.set(res?.items ?? []);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load followup emails');
    } finally {
      this.loading.set(false);
    }
  }
}
