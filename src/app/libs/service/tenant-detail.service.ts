import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { TenantDetail } from '../model/tenant-detail';

@Injectable({ providedIn: 'root' })
export class TenantDetailService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  detail  = signal<TenantDetail | null>(null);
  loading = signal(false);
  saving  = signal(false);
  error   = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.http
        .get<TenantDetail>(`${this.base}/dashboard/tenant-detail`)
        .toPromise();
      this.detail.set(res ?? null);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load tenant detail');
    } finally {
      this.loading.set(false);
    }
  }

  async save(patch: Partial<TenantDetail>): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const res = await this.http
        .put<TenantDetail>(`${this.base}/dashboard/tenant-detail`, patch)
        .toPromise();
      this.detail.set(res ?? null);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to save tenant detail');
      throw err;
    } finally {
      this.saving.set(false);
    }
  }
}
