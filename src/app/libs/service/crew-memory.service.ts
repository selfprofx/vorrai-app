import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type {
  CrewMemoryRecord,
  CrewFlowInfo,
  CrewMemoriesResponse,
  CrewMemoryContentResponse,
} from '../model/crew-memory';

@Injectable({ providedIn: 'root' })
export class CrewMemoryService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  memories       = signal<CrewMemoryRecord[]>([]);
  availableFlows = signal<CrewFlowInfo[]>([]);
  loading        = signal(false);
  error          = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.http
        .get<CrewMemoriesResponse>(`${this.base}/dashboard/crew-memories`)
        .toPromise();
      this.memories.set(res?.memories ?? []);
      this.availableFlows.set(res?.available_flows ?? []);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load memories');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleEnabled(flowName: string, enabled: boolean): Promise<void> {
    this.error.set(null);
    try {
      await this.http
        .put(`${this.base}/dashboard/crew-memories/${flowName}`, { memory_enabled: enabled })
        .toPromise();
      // Update local state
      this.memories.update(mems =>
        mems.map(m => m.crew_flow_name === flowName ? { ...m, memory_enabled: enabled } : m)
      );
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to toggle memory');
      throw err;
    }
  }

  async getContent(flowName: string): Promise<string> {
    try {
      const res = await this.http
        .get<CrewMemoryContentResponse>(`${this.base}/dashboard/crew-memories/${flowName}/content`)
        .toPromise();
      return res?.content ?? '';
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load memory content');
      return '';
    }
  }

  async deleteMemory(flowName: string): Promise<void> {
    this.error.set(null);
    try {
      await this.http
        .delete(`${this.base}/dashboard/crew-memories/${flowName}`)
        .toPromise();
      // Remove from local state
      this.memories.update(mems => mems.filter(m => m.crew_flow_name !== flowName));
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to delete memory');
      throw err;
    }
  }
}
