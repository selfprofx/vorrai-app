import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import type { NovelSequence } from '../model/followup';

@Injectable({ providedIn: 'root' })
export class SequenceService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = '/api';

  sequences: WritableSignal<NovelSequence[]> = signal<NovelSequence[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const headers = new HttpHeaders(this.auth.authHeader());
      const res = await this.http
        .get<{ items: NovelSequence[] }>(`${this.base}/dashboard/sequences`, { headers })
        .toPromise();
      this.sequences.set(res?.items ?? []);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load sequences');
    } finally {
      this.loading.set(false);
    }
  }

  async approve(userId: string): Promise<void> {
    const headers = new HttpHeaders(this.auth.authHeader());
    await this.http
      .post(`${this.base}/dashboard/sequences/${userId}/approve`, {}, { headers })
      .toPromise();
    // Optimistically update approval_status in the local signal
    this.sequences.update(seqs =>
      seqs.map(s => s.user_id === userId ? { ...s, approval_status: 'approved' } : s)
    );
  }

  async reject(userId: string): Promise<void> {
    const headers = new HttpHeaders(this.auth.authHeader());
    await this.http
      .post(`${this.base}/dashboard/sequences/${userId}/reject`, {}, { headers })
      .toPromise();
    this.sequences.update(seqs =>
      seqs.map(s => s.user_id === userId ? { ...s, approval_status: 'rejected' } : s)
    );
  }
}
