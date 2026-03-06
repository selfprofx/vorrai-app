import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { TenantSettings } from '../model/tenant-settings';

@Injectable({ providedIn: 'root' })
export class TenantSettingsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  settings = signal<TenantSettings | null>(null);
  loading  = signal(false);
  saving   = signal(false);
  error    = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.http
        .get<TenantSettings>(`${this.base}/dashboard/settings`)
        .toPromise();
      this.settings.set(res ?? null);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load settings');
    } finally {
      this.loading.set(false);
    }
  }

  async save(patch: Partial<Pick<TenantSettings, 'max_chat_input_chars' | 'max_agent_input_chars' | 'auto_approve_sequences'>>): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const res = await this.http
        .put<TenantSettings>(`${this.base}/dashboard/settings`, patch)
        .toPromise();
      this.settings.set(res ?? null);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to save settings');
      throw err;
    } finally {
      this.saving.set(false);
    }
  }
}
