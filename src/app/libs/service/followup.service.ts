import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { FollowupEmail } from '../model/followup';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FollowupService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  followups: WritableSignal<FollowupEmail[]> = signal<FollowupEmail[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await firstValueFrom(
        this.http.get<{ items: FollowupEmail[] }>(`${this.base}/dashboard/followups`)
      );
      this.followups.set(res?.items ?? []);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to load followup emails');
    } finally {
      this.loading.set(false);
    }
  }
}
