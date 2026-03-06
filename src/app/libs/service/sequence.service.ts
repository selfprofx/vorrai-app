import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { NovelSequence } from '../model/followup';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SequenceService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  sequences: WritableSignal<NovelSequence[]> = signal<NovelSequence[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await firstValueFrom(
        this.http.get<{ items: NovelSequence[] }>(`${this.base}/dashboard/sequences`)
      );
      this.sequences.set(res?.items ?? []);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to load sequences');
    } finally {
      this.loading.set(false);
    }
  }

  async approve(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/dashboard/sequences/${userId}/approve`, {})
    );
    this.sequences.update(seqs =>
      seqs.map(s => s.user_id === userId ? { ...s, approval_status: 'approved' } : s)
    );
  }

  async reject(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/dashboard/sequences/${userId}/reject`, {})
    );
    this.sequences.update(seqs =>
      seqs.map(s => s.user_id === userId ? { ...s, approval_status: 'rejected' } : s)
    );
  }
}
