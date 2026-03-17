import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { GlobalConfig, GlobalNotificationConfig } from '../model/global-config';
import { DEFAULT_GLOBAL_NOTIF } from '../model/global-config';

@Injectable({ providedIn: 'root' })
export class GlobalConfigService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  globalConfig = signal<GlobalConfig | null>(null);
  tenantOverride = signal<GlobalConfig | null>(null);
  globalNotifConfig = signal<GlobalNotificationConfig>(DEFAULT_GLOBAL_NOTIF);
  loading = signal(false);
  saving = signal(false);
  notifSaving = signal(false);
  error = signal<string | null>(null);

  async loadGlobal(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.http
        .get<GlobalConfig>(`${this.base}/manager/global-config`)
        .toPromise();
      this.globalConfig.set(res ?? null);
    } catch (err: any) {
      this.error.set(err?.error?.Message ?? err?.message ?? 'Failed to load global config');
    } finally {
      this.loading.set(false);
    }
  }

  async saveGlobal(patch: Partial<Omit<GlobalConfig, 'config_key' | 'updated_at' | 'has_override'>>): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const res = await this.http
        .put<GlobalConfig>(`${this.base}/manager/global-config`, patch)
        .toPromise();
      this.globalConfig.set(res ?? null);
    } catch (err: any) {
      this.error.set(err?.error?.Message ?? err?.message ?? 'Failed to save global config');
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  async loadTenantOverride(tenantId: string): Promise<void> {
    this.error.set(null);
    try {
      const res = await this.http
        .get<GlobalConfig>(`${this.base}/manager/tenant/${tenantId}/config-override`)
        .toPromise();
      this.tenantOverride.set(res ?? null);
    } catch (err: any) {
      this.error.set(err?.error?.Message ?? err?.message ?? 'Failed to load tenant override');
    }
  }

  async saveTenantOverride(
    tenantId: string,
    patch: Partial<Omit<GlobalConfig, 'config_key' | 'updated_at' | 'has_override'>>,
  ): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const res = await this.http
        .put<GlobalConfig>(`${this.base}/manager/tenant/${tenantId}/config-override`, patch)
        .toPromise();
      this.tenantOverride.set(res ?? null);
    } catch (err: any) {
      this.error.set(err?.error?.Message ?? err?.message ?? 'Failed to save tenant override');
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTenantOverride(tenantId: string): Promise<void> {
    this.error.set(null);
    try {
      await this.http
        .delete(`${this.base}/manager/tenant/${tenantId}/config-override`)
        .toPromise();
      this.tenantOverride.set(null);
    } catch (err: any) {
      this.error.set(err?.error?.Message ?? err?.message ?? 'Failed to delete tenant override');
    }
  }

  async loadGlobalNotifications(): Promise<void> {
    try {
      const res = await this.http
        .get<GlobalNotificationConfig>(`${this.base}/manager/global-config/notifications`)
        .toPromise();
      if (res) this.globalNotifConfig.set(res);
    } catch { /* use defaults */ }
  }

  async saveGlobalNotifications(patch: Partial<GlobalNotificationConfig>): Promise<void> {
    this.notifSaving.set(true);
    this.error.set(null);
    try {
      const res = await this.http
        .put<GlobalNotificationConfig>(`${this.base}/manager/global-config/notifications`, patch)
        .toPromise();
      if (res) this.globalNotifConfig.set(res);
    } catch (err: any) {
      this.error.set(err?.error?.Message ?? err?.message ?? 'Failed to save notification config');
      throw err;
    } finally {
      this.notifSaving.set(false);
    }
  }
}
