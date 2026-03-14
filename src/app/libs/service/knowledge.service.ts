import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface KnowledgeSource {
  source_id: string;
  source_type: string;
  title: string;
  status: string;
  chunk_count: number;
  s3_key: string | null;
  source_url: string | null;
  created_at: string;
  error_message: string | null;
}

@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  listSources(): Promise<{ sources: KnowledgeSource[] }> {
    return firstValueFrom(
      this.http.get<{ sources: KnowledgeSource[] }>(`${this.base}/dashboard/knowledge/sources`)
    );
  }

  getUploadUrl(filename: string, sourceType: string, title: string): Promise<{ source_id: string; upload_url: string; s3_key: string }> {
    return firstValueFrom(
      this.http.post<{ source_id: string; upload_url: string; s3_key: string }>(
        `${this.base}/dashboard/knowledge/upload`,
        { filename, source_type: sourceType, title }
      )
    );
  }

  triggerIngestion(youtubeUrls: Array<{ url: string; title: string }> = [], textSources: Array<{ title: string; content: string }> = []): Promise<{ status: string; job_id: string }> {
    return firstValueFrom(
      this.http.post<{ status: string; job_id: string }>(
        `${this.base}/dashboard/knowledge/ingest`,
        { youtube_urls: youtubeUrls, text_sources: textSources }
      )
    );
  }

  deleteSource(sourceId: string): Promise<{ deleted: boolean; rebuild_job_id: string }> {
    return firstValueFrom(
      this.http.delete<{ deleted: boolean; rebuild_job_id: string }>(
        `${this.base}/dashboard/knowledge/source/${sourceId}`
      )
    );
  }

  getMemory(): Promise<{ memory: string | null }> {
    return firstValueFrom(
      this.http.get<{ memory: string | null }>(`${this.base}/dashboard/knowledge/memory`)
    );
  }

  getChecklist(): Promise<{ checklist: string | null }> {
    return firstValueFrom(
      this.http.get<{ checklist: string | null }>(`${this.base}/dashboard/knowledge/checklist`)
    );
  }
}
