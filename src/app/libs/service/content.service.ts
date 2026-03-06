import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import type { ContentJob, ContentCreateRequest } from '../model/content-job';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = environment.apiUrl;

  jobs: WritableSignal<ContentJob[]> = signal<ContentJob[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const headers = new HttpHeaders(this.auth.authHeader());
      const res = await firstValueFrom(
        this.http.get<{ items: ContentJob[] }>(`${this.base}/dashboard/content`, { headers })
      );
      this.jobs.set(res?.items ?? []);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to load content jobs');
    } finally {
      this.loading.set(false);
    }
  }

  async getById(jobId: string): Promise<ContentJob | null> {
    try {
      const headers = new HttpHeaders(this.auth.authHeader());
      return await firstValueFrom(
        this.http.get<ContentJob>(`${this.base}/dashboard/content/${jobId}`, { headers })
      );
    } catch {
      return null;
    }
  }

  async create(request: ContentCreateRequest): Promise<{ job_id: string; status: string } | null> {
    try {
      const headers = new HttpHeaders(this.auth.authHeader());
      return await firstValueFrom(
        this.http.post<{ job_id: string; status: string }>(
          `${this.base}/dashboard/content/create`,
          request,
          { headers },
        )
      );
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to create content job');
      return null;
    }
  }
}
