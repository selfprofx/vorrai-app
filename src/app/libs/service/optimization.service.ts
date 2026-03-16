import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { OptimizationRecord, OptimizationListResponse, OptimizationTriggerResponse } from '../model/optimization';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OptimizationService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  records = signal<OptimizationRecord[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<OptimizationListResponse>(`${this.base}/dashboard/optimization`)
      );
      this.records.set(res?.items ?? []);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to load optimizations');
    } finally {
      this.loading.set(false);
    }
  }

  async getReport(crewName: string): Promise<OptimizationRecord | null> {
    try {
      return await firstValueFrom(
        this.http.get<OptimizationRecord>(`${this.base}/dashboard/optimization/${crewName}`)
      );
    } catch {
      return null;
    }
  }

  async updateSchedule(crewName: string, runFrequency: string): Promise<OptimizationRecord | null> {
    try {
      const res = await firstValueFrom(
        this.http.put<OptimizationRecord>(`${this.base}/dashboard/optimization/${crewName}`, {
          run_frequency: runFrequency,
        })
      );
      await this.load();
      return res;
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Failed to update schedule');
      return null;
    }
  }

  async toggleStatus(crewName: string, status: 'active' | 'paused'): Promise<OptimizationRecord | null> {
    try {
      const res = await firstValueFrom(
        this.http.put<OptimizationRecord>(`${this.base}/dashboard/optimization/${crewName}`, { status })
      );
      await this.load();
      return res;
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Failed to update status');
      return null;
    }
  }

  async updateReport(crewName: string, reportContent: string): Promise<OptimizationRecord | null> {
    try {
      const res = await firstValueFrom(
        this.http.put<OptimizationRecord>(`${this.base}/dashboard/optimization/${crewName}`, {
          report_content: reportContent,
        })
      );
      await this.load();
      return res;
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Failed to update report');
      return null;
    }
  }

  async triggerRun(periodDays: number = 7): Promise<OptimizationTriggerResponse | null> {
    try {
      return await firstValueFrom(
        this.http.post<OptimizationTriggerResponse>(`${this.base}/dashboard/optimization/trigger`, {
          period_days: periodDays,
        })
      );
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Failed to trigger optimization');
      return null;
    }
  }
}
